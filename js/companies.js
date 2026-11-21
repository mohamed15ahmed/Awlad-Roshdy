// =========================================================
// companies.js — supplier company CRUD (brief sections 14-16).
// =========================================================
import { dbPut, dbGet, dbGetAll, addAuditLog } from "./db.js";
import { uuid, nowIso, isValidPhone } from "./utils.js";
import { sanitizeText } from "./security.js";
import { enqueueOperation, OP_TYPES } from "./sync.js";

export async function listCompanies({ includeDeleted = false } = {}) {
  const all = await dbGetAll("companies");
  return all.filter((c) => includeDeleted || !c.deleted_at).sort((a, b) => (a.company_name || "").localeCompare(b.company_name || "", "ar"));
}

export async function getCompany(id) {
  return dbGet("companies", id);
}

export function validateCompany(data) {
  const errors = {};
  if (!sanitizeText(data.company_name)) errors.company_name = "company_required";
  if (data.phone && !isValidPhone(data.phone)) errors.phone = "phone_invalid";
  if (data.whatsapp && !isValidPhone(data.whatsapp)) errors.whatsapp = "phone_invalid";
  return errors;
}

export async function findPossibleDuplicate(name, excludeId = null) {
  const normalized = sanitizeText(name).toLowerCase().replace(/\s+/g, "");
  if (!normalized) return null;
  const all = await listCompanies();
  return all.find((c) => c.id !== excludeId && (c.company_name || "").toLowerCase().replace(/\s+/g, "") === normalized) || null;
}

export async function createCompany(data) {
  const now = nowIso();
  const company = {
    id: uuid(),
    company_name: sanitizeText(data.company_name),
    representative_name: sanitizeText(data.representative_name),
    phone: sanitizeText(data.phone),
    whatsapp: sanitizeText(data.whatsapp),
    address: sanitizeText(data.address),
    category: sanitizeText(data.category),
    notes: sanitizeText(data.notes),
    is_favorite: !!data.is_favorite,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_status: "local", // Local Only until synced
  };
  await dbPut("companies", company);
  await enqueueOperation(OP_TYPES.CREATE_COMPANY, "company", company.id, company);
  await addAuditLog("CREATE_COMPANY", "company", company.id);
  return company;
}

export async function updateCompany(id, data) {
  const existing = await dbGet("companies", id);
  if (!existing) throw new Error("Company not found");
  const updated = {
    ...existing,
    company_name: sanitizeText(data.company_name),
    representative_name: sanitizeText(data.representative_name),
    phone: sanitizeText(data.phone),
    whatsapp: sanitizeText(data.whatsapp),
    address: sanitizeText(data.address),
    category: sanitizeText(data.category),
    notes: sanitizeText(data.notes),
    is_favorite: !!data.is_favorite,
    updated_at: nowIso(),
    sync_status: existing.sync_status === "synced" ? "pending" : existing.sync_status,
  };
  await dbPut("companies", updated);
  await enqueueOperation(OP_TYPES.UPDATE_COMPANY, "company", id, updated);
  await addAuditLog("UPDATE_COMPANY", "company", id);
  return updated;
}

export async function toggleFavorite(id) {
  const c = await dbGet("companies", id);
  if (!c) return null;
  c.is_favorite = !c.is_favorite;
  c.updated_at = nowIso();
  await dbPut("companies", c);
  return c;
}

export async function softDeleteCompany(id) {
  const c = await dbGet("companies", id);
  if (!c) return null;
  c.deleted_at = nowIso();
  c.sync_status = "pending";
  await dbPut("companies", c);
  await enqueueOperation(OP_TYPES.DELETE_COMPANY, "company", id, {});
  await addAuditLog("DELETE_COMPANY", "company", id);
  return c;
}

export async function restoreCompany(id) {
  const c = await dbGet("companies", id);
  if (!c) return null;
  c.deleted_at = null;
  c.sync_status = "pending";
  await dbPut("companies", c);
  await addAuditLog("RESTORE_COMPANY", "company", id);
  return c;
}

export function searchCompaniesLocal(list, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) =>
    (c.company_name || "").toLowerCase().includes(q) ||
    (c.representative_name || "").toLowerCase().includes(q) ||
    (c.phone || "").includes(q) ||
    (c.category || "").toLowerCase().includes(q)
  );
}

export const CATEGORIES = ["مشروبات", "ألبان", "مجمدات", "منظفات", "حلويات", "أدوات منزلية", "مياه", "أغذية", "أخرى"];
