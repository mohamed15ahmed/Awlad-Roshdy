// =========================================================
// invoices.js — invoice CRUD, file handling, search & stats
// (brief sections 17-26, 38).
// =========================================================
import { dbPut, dbGet, dbGetAll, dbGetAllByIndex, addAuditLog } from "./db.js";
import { uuid, nowIso } from "./utils.js";
import { sanitizeText, validateFile, safeFileName } from "./security.js";
import { enqueueOperation, OP_TYPES } from "./sync.js";

export async function listInvoices({ includeDeleted = false } = {}) {
  const all = await dbGetAll("invoices");
  return all
    .filter((i) => includeDeleted || !i.deleted_at)
    .sort((a, b) => new Date(b.invoice_date || b.created_at) - new Date(a.invoice_date || a.created_at));
}

export async function listInvoicesForCompany(companyId) {
  const all = await dbGetAllByIndex("invoices", "company_id", companyId);
  return all.filter((i) => !i.deleted_at).sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
}

export async function getInvoice(id) {
  return dbGet("invoices", id);
}

export function validateInvoiceForm(data, file) {
  const errors = {};
  if (!data.company_id) errors.company_id = "required_field";
  if (!file && !data.existing_file) errors.file = "file_required";
  return errors;
}

export async function checkPossibleDuplicate({ companyId, invoiceNumber, invoiceDate, total }) {
  if (!companyId) return null;
  const companyInvoices = await listInvoicesForCompany(companyId);
  return companyInvoices.find((inv) => {
    const sameNumber = invoiceNumber && inv.invoice_number && inv.invoice_number.trim() === invoiceNumber.trim();
    const sameDateAndTotal = inv.invoice_date === invoiceDate && Number(inv.total) === Number(total) && Number(total) > 0;
    return sameNumber || sameDateAndTotal;
  }) || null;
}

export async function createInvoice(data, file, companyName) {
  if (file) {
    const check = await validateFile(file);
    if (!check.ok) {
      const err = new Error(check.errors.join(" — "));
      err.fileErrors = check.errors;
      throw err;
    }
  }
  const now = nowIso();
  const id = uuid();
  const displayName = file ? safeFileName(companyName, data.invoice_date, data.invoice_number, file.name) : null;

  const invoice = {
    id,
    company_id: data.company_id,
    invoice_number: sanitizeText(data.invoice_number),
    invoice_date: data.invoice_date || now,
    upload_date: now,
    subtotal: Number(data.subtotal) || 0,
    tax: Number(data.tax) || 0,
    total: Number(data.total) || 0,
    notes: sanitizeText(data.notes),
    file_blob: file || null,
    file_name: displayName,
    file_type: file ? file.type : null,
    file_size: file ? file.size : 0,
    ai_status: "not_processed",
    ocr_confidence: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_status: "local",
  };
  await dbPut("invoices", invoice);
  await enqueueOperation(OP_TYPES.CREATE_INVOICE, "invoice", id, { id, company_id: invoice.company_id, total: invoice.total });
  await addAuditLog("CREATE_INVOICE", "invoice", id);
  return invoice;
}

export async function updateInvoice(id, data, newFile) {
  const existing = await dbGet("invoices", id);
  if (!existing) throw new Error("Invoice not found");

  if (newFile) {
    const check = await validateFile(newFile);
    if (!check.ok) {
      const err = new Error(check.errors.join(" — "));
      err.fileErrors = check.errors;
      throw err;
    }
  }

  const updated = {
    ...existing,
    invoice_number: sanitizeText(data.invoice_number),
    invoice_date: data.invoice_date || existing.invoice_date,
    subtotal: Number(data.subtotal) || 0,
    tax: Number(data.tax) || 0,
    total: Number(data.total) || 0,
    notes: sanitizeText(data.notes),
    updated_at: nowIso(),
    sync_status: existing.sync_status === "synced" ? "pending" : existing.sync_status,
  };
  if (newFile) {
    updated.file_blob = newFile;
    updated.file_type = newFile.type;
    updated.file_size = newFile.size;
  }
  await dbPut("invoices", updated);
  await enqueueOperation(OP_TYPES.UPDATE_INVOICE, "invoice", id, { id });
  await addAuditLog("UPDATE_INVOICE", "invoice", id);
  return updated;
}

export async function softDeleteInvoice(id) {
  const inv = await dbGet("invoices", id);
  if (!inv) return null;
  inv.deleted_at = nowIso();
  inv.sync_status = "pending";
  await dbPut("invoices", inv);
  await enqueueOperation(OP_TYPES.DELETE_INVOICE, "invoice", id, {});
  await addAuditLog("DELETE_INVOICE", "invoice", id);
  return inv;
}

export async function restoreInvoice(id) {
  const inv = await dbGet("invoices", id);
  if (!inv) return null;
  inv.deleted_at = null;
  inv.sync_status = "pending";
  await dbPut("invoices", inv);
  await addAuditLog("RESTORE_INVOICE", "invoice", id);
  return inv;
}

export async function addAttachment(invoiceId, file) {
  const check = await validateFile(file);
  if (!check.ok) {
    const err = new Error(check.errors.join(" — "));
    err.fileErrors = check.errors;
    throw err;
  }
  const attachment = {
    id: uuid(),
    invoice_id: invoiceId,
    file_name: safeFileName("attachment", nowIso(), "", file.name),
    file_blob: file,
    file_type: file.type,
    file_size: file.size,
    created_at: nowIso(),
    sync_status: "local",
  };
  await dbPut("attachments", attachment);
  await enqueueOperation(OP_TYPES.UPLOAD_FILE, "attachment", attachment.id, { invoice_id: invoiceId });
  return attachment;
}

export async function listAttachments(invoiceId) {
  return dbGetAllByIndex("attachments", "invoice_id", invoiceId);
}

export function searchInvoicesLocal(list, companiesById, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((inv) => {
    const company = companiesById[inv.company_id];
    return (
      (company?.company_name || "").toLowerCase().includes(q) ||
      (inv.invoice_number || "").toLowerCase().includes(q) ||
      String(inv.total || "").includes(q) ||
      (inv.notes || "").toLowerCase().includes(q) ||
      (inv.file_name || "").toLowerCase().includes(q)
    );
  });
}

export async function computeStats() {
  const invoices = await listInvoices();
  const companies = await (await import("./companies.js")).listCompanies();
  const now = new Date();
  const thisMonth = invoices.filter((i) => {
    const d = new Date(i.invoice_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalPurchasesMonth = thisMonth.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const pendingSync = invoices.filter((i) => i.sync_status === "pending" || i.sync_status === "local").length;

  return {
    totalCompanies: companies.length,
    totalInvoices: invoices.length,
    invoicesThisMonth: thisMonth.length,
    totalPurchasesMonth,
    pendingSync,
  };
}
