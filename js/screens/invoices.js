import { h, mount, toast, debounce, formatDateDisplay, formatCurrency, bytesToSize, ICONS } from "../utils.js";
import { t } from "../i18n.js";
import {
  listInvoices, getInvoice, createInvoice, updateInvoice, softDeleteInvoice,
  checkPossibleDuplicate, searchInvoicesLocal, listAttachments, addAttachment,
} from "../invoices.js";
import { listCompanies, getCompany } from "../companies.js";
import { openConfirmSheet, openActionSheet } from "./ui-helpers.js";
import { syncClass, syncLabel } from "./dashboard.js";

function titleBar(title, navigate, backHash = "#/invoices") {
  return h("div", { class: "screen-title-bar" }, [
    h("button", { class: "back-btn", attrs: { "aria-label": "رجوع" }, trustedHtml: `<svg class="rtl-flip" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`, on: { click: () => navigate(backHash) } }),
    h("h1", {}, title),
  ]);
}

// ---------------- List ----------------
export async function renderInvoicesList(container, navigate) {
  mount(container, h("div", { class: "skeleton", style: { height: "60px", margin: "12px 0" } }));

  const [invoices, companies] = await Promise.all([listInvoices(), listCompanies({ includeDeleted: true })]);
  const companiesById = Object.fromEntries(companies.map((c) => [c.id, c]));
  let query = "", filter = "all";

  const searchInput = h("input", { attrs: { type: "search", placeholder: t("search_placeholder") } });
  const listEl = h("div", {});
  const filters = [["all", "الكل"], ["pending", "بانتظار المزامنة"], ["synced", "تمت المزامنة"], ["failed", "فشلت المزامنة"]];
  const filterRow = h("div", { class: "filter-row" }, filters.map(([key, label]) =>
    h("button", { class: `filter-chip ${filter === key ? "active" : ""}`, on: { click: (e) => {
      filter = key; [...filterRow.children].forEach((c) => c.classList.remove("active")); e.target.classList.add("active"); renderList();
    } } }, label)
  ));

  function renderList() {
    let items = invoices;
    if (query) items = searchInvoicesLocal(items, companiesById, query);
    if (filter === "pending") items = items.filter((i) => i.sync_status === "pending" || i.sync_status === "local");
    if (filter === "synced") items = items.filter((i) => i.sync_status === "synced");
    if (filter === "failed") items = items.filter((i) => i.sync_status === "failed");

    if (!items.length) {
      mount(listEl, h("div", { class: "empty-state" }, [
        h("div", { class: "emoji" }, "🧾"),
        h("h3", {}, query ? t("no_results_title") : t("no_invoices_title")),
        h("p", {}, query ? t("no_results_sub") : t("no_invoices_sub")),
        !query ? h("button", { class: "btn btn-primary", on: { click: () => navigate("#/invoices/new") } }, t("add_invoice")) : null,
      ]));
      return;
    }
    mount(listEl, h("div", {}, items.map((inv) => invoiceCard(inv, companiesById[inv.company_id], navigate))));
  }

  searchInput.addEventListener("input", debounce((e) => { query = e.target.value; renderList(); }, 250));
  mount(container, h("div", {}, [h("div", { class: "search-bar" }, [searchInput]), filterRow, listEl]));
  renderList();
}

function invoiceCard(inv, company, navigate) {
  return h("div", { class: "invoice-card", on: { click: () => navigate(`#/invoices/${inv.id}`) } }, [
    h("div", { class: "invoice-thumb" }, thumb(inv)),
    h("div", { class: "grow" }, [
      h("h3", {}, company?.company_name || "—"),
      h("div", { class: "meta" }, [inv.invoice_number ? "#" + inv.invoice_number : null, formatDateDisplay(inv.invoice_date)].filter(Boolean).join(" · ")),
      h("span", { class: `sync-badge ${syncClass(inv.sync_status)}` }, syncLabel(inv.sync_status)),
    ]),
    h("div", { class: "amount" }, formatCurrency(inv.total)),
  ]);
}
function thumb(inv) {
  if (inv.file_blob && inv.file_type?.startsWith("image/")) {
    const img = h("img", { attrs: { alt: "" } });
    img.src = URL.createObjectURL(inv.file_blob);
    return img;
  }
  return h("span", { trustedHtml: ICONS.file });
}

// ---------------- Add / Edit form ----------------
export async function renderInvoiceForm(container, navigate, invoiceId, presetCompanyId, presetCapture) {
  const isEdit = !!invoiceId;
  const existing = isEdit ? await getInvoice(invoiceId) : null;
  if (isEdit && !existing) { navigate("#/invoices"); return; }

  const companies = await listCompanies();
  if (!companies.length) {
    mount(container, h("div", {}, [
      titleBar(t("add_invoice"), navigate),
      h("div", { class: "empty-state" }, [
        h("div", { class: "emoji" }, "🏬"),
        h("h3", {}, t("no_companies_title")),
        h("p", {}, "أضف شركة أولاً قبل إضافة فاتورة"),
        h("button", { class: "btn btn-primary", on: { click: () => navigate("#/companies/new") } }, t("add_company")),
      ]),
    ]));
    return;
  }

  const companySelect = h("select", { attrs: { required: true } }, [
    h("option", { attrs: { value: "" } }, "— اختر شركة —"),
    ...companies.map((c) => h("option", { attrs: { value: c.id } }, c.company_name)),
  ]);
  companySelect.value = existing?.company_id || presetCompanyId || "";

  const numberInput = h("input", { attrs: { maxlength: 40 } });
  const dateInput = h("input", { attrs: { type: "date" } });
  const subtotalInput = h("input", { attrs: { type: "number", step: "0.01", min: "0" } });
  const taxInput = h("input", { attrs: { type: "number", step: "0.01", min: "0" } });
  const totalInput = h("input", { attrs: { type: "number", step: "0.01", min: "0" } });
  const notesInput = h("textarea", {});

  if (existing) {
    numberInput.value = existing.invoice_number || "";
    dateInput.value = toDateInputValue(existing.invoice_date);
    subtotalInput.value = existing.subtotal || "";
    taxInput.value = existing.tax || "";
    totalInput.value = existing.total || "";
    notesInput.value = existing.notes || "";
  } else {
    dateInput.value = toDateInputValue(new Date().toISOString());
  }

  // auto-compute total from subtotal+tax unless user edits total manually
  let totalTouched = false;
  totalInput.addEventListener("input", () => { totalTouched = true; });
  const recompute = () => { if (!totalTouched) totalInput.value = ((Number(subtotalInput.value) || 0) + (Number(taxInput.value) || 0)).toFixed(2); };
  subtotalInput.addEventListener("input", recompute);
  taxInput.addEventListener("input", recompute);

  // ---- file selection / camera capture ----
  let selectedFile = null;
  const previewWrap = h("div", { class: "invoice-preview" }, existing?.file_blob ? [previewNode(existing.file_blob, existing.file_type)] : [h("span", { style: { color: "var(--c-text-muted)", fontSize: "13px" } }, "لا يوجد ملف بعد")]);
  const fileErrorEl = h("div", { class: "error-text", style: { display: "none" } });

  const fileInput = h("input", { attrs: { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,application/pdf", class: "sr-only" } });
  const cameraInput = h("input", { attrs: { type: "file", accept: "image/*", capture: "environment", class: "sr-only" } });

  async function handleFile(file) {
    selectedFile = file;
    fileErrorEl.style.display = "none";
    mount(previewWrap, previewNode(file, file.type));
  }
  fileInput.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  cameraInput.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  const dupBanner = h("div", { class: "banner warning", style: { display: "none" } });

  const saveBtn = h("button", { class: "btn btn-primary", attrs: { type: "submit" } }, t("save_invoice"));

  async function doSave(e) {
    e.preventDefault();
    document.querySelectorAll(".form-field.invalid").forEach((f) => f.classList.remove("invalid"));
    fileErrorEl.style.display = "none";

    if (!companySelect.value) { toast(t("required_field"), "error"); return; }
    if (!selectedFile && !existing?.file_blob) { fileErrorEl.textContent = t("file_required"); fileErrorEl.style.display = "block"; return; }

    const company = await getCompany(companySelect.value);
    const data = {
      company_id: companySelect.value,
      invoice_number: numberInput.value,
      invoice_date: dateInput.value ? new Date(dateInput.value + "T00:00:00").toISOString() : new Date().toISOString(),
      subtotal: subtotalInput.value, tax: taxInput.value, total: totalInput.value,
      notes: notesInput.value,
    };

    const dup = await checkPossibleDuplicate({ companyId: data.company_id, invoiceNumber: data.invoice_number, invoiceDate: data.invoice_date, total: data.total });
    if (dup && dup.id !== invoiceId && dupBanner.dataset.acknowledged !== "1") {
      dupBanner.style.display = "flex";
      dupBanner.textContent = "⚠ " + t("dup_warning_title") + " — اضغط حفظ مرة أخرى للتأكيد";
      dupBanner.dataset.acknowledged = "1";
      return;
    }

    saveBtn.disabled = true;
    const spinner = h("span", { class: "spinner" });
    saveBtn.appendChild(spinner);
    try {
      const saved = isEdit
        ? await updateInvoice(invoiceId, data, selectedFile)
        : await createInvoice(data, selectedFile, company.company_name);
      toast(t("saved_success"), "success");
      navigate(`#/invoices/${saved.id}`);
    } catch (err) {
      if (err.fileErrors) { fileErrorEl.textContent = err.fileErrors.join(" — "); fileErrorEl.style.display = "block"; }
      else toast(t("err_generic"), "error");
    } finally {
      saveBtn.disabled = false;
      spinner.remove();
    }
  }

  const form = h("form", { on: { submit: doSave } }, [
    h("div", { class: "form-field" }, [h("label", {}, "الملف *"), previewWrap, fileErrorEl,
      h("div", { class: "btn-row", style: { marginTop: "8px" } }, [
        h("button", { class: "btn btn-outline", attrs: { type: "button" }, on: { click: () => fileInput.click() } }, [h("span", { trustedHtml: ICONS.file }), " ", t("upload_file")]),
        h("button", { class: "btn btn-outline", attrs: { type: "button" }, on: { click: () => cameraInput.click() } }, [h("span", { trustedHtml: ICONS.camera }), " ", t("take_photo")]),
      ]),
      fileInput, cameraInput,
    ]),
    dupBanner,
    h("div", { class: "form-field" }, [h("label", {}, t("company_name") + " *"), companySelect]),
    h("div", { class: "form-field" }, [h("label", {}, t("invoice_number")), numberInput, h("div", { class: "hint" }, t("invoice_number_hint"))]),
    h("div", { class: "form-field" }, [h("label", {}, t("invoice_date") + " *"), dateInput]),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } }, [
      h("div", { class: "form-field" }, [h("label", {}, t("subtotal")), subtotalInput]),
      h("div", { class: "form-field" }, [h("label", {}, t("tax")), taxInput]),
    ]),
    h("div", { class: "form-field" }, [h("label", {}, t("total")), totalInput]),
    h("div", { class: "form-field" }, [h("label", {}, t("notes")), notesInput]),
    saveBtn,
  ]);

  mount(container, h("div", {}, [titleBar(isEdit ? "تعديل الفاتورة" : t("add_invoice"), navigate), form]));

  if (presetCapture && !isEdit) cameraInput.click();
}

function toDateInputValue(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function previewNode(blob, type) {
  if (!blob) return h("span", { style: { color: "var(--c-text-muted)", fontSize: "13px" } }, "لا يوجد ملف");
  const url = URL.createObjectURL(blob);
  if ((type || "").startsWith("image/")) return h("img", { attrs: { src: url, alt: "" } });
  if (type === "application/pdf") {
    // <iframe> (governed by CSP frame-src) rather than <embed>/<object>
    // (governed by object-src, which this app keeps at 'none' to block
    // legacy plugin content) — this is the safer way to preview a PDF.
    return h("iframe", { attrs: { src: url, title: "invoice-pdf", height: "320" }, style: { width: "100%", border: "none" } });
  }
  return h("span", { trustedHtml: ICONS.file });
}

// ---------------- Details ----------------
export async function renderInvoiceDetails(container, navigate, invoiceId) {
  const inv = await getInvoice(invoiceId);
  if (!inv) { navigate("#/invoices"); return; }
  const company = await getCompany(inv.company_id);
  const attachments = await listAttachments(invoiceId);

  const attachInput = h("input", { attrs: { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,application/pdf", class: "sr-only" } });
  attachInput.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { await addAttachment(invoiceId, f); toast(t("saved_success"), "success"); renderInvoiceDetails(container, navigate, invoiceId); }
    catch (err) { toast(err.fileErrors ? err.fileErrors.join(" — ") : t("err_generic"), "error"); }
  });

  const node = h("div", {}, [
    titleBar(t("details"), navigate),
    h("div", { class: "invoice-preview" }, [previewNode(inv.file_blob, inv.file_type)]),

    h("div", { class: "detail-hero" }, [
      row(t("company_name"), company?.company_name || "—"),
      row(t("invoice_number"), inv.invoice_number || "—"),
      row(t("invoice_date"), formatDateDisplay(inv.invoice_date)),
      row(t("subtotal"), formatCurrency(inv.subtotal)),
      row(t("tax"), formatCurrency(inv.tax)),
      row(t("total"), formatCurrency(inv.total)),
      inv.notes ? row(t("notes"), inv.notes) : null,
      row("حجم الملف", bytesToSize(inv.file_size)),
      h("div", { class: "detail-row" }, [h("span", { class: "k" }, "حالة المزامنة"), h("span", { class: `sync-badge ${syncClass(inv.sync_status)}` }, syncLabel(inv.sync_status))]),
    ]),

    h("div", { class: "action-grid" }, [
      actionBtn("edit", t("edit_data"), () => navigate(`#/invoices/${invoiceId}/edit`)),
      actionBtn("share", "مشاركة", () => shareInvoice(inv)),
      actionBtn("download", "تنزيل", () => downloadInvoice(inv)),
      actionBtn("trash", "حذف", async () => {
        const ok = await openConfirmSheet(t("confirm_delete"));
        if (ok) { await softDeleteInvoice(invoiceId); toast(t("saved_success"), "success"); navigate("#/invoices"); }
      }),
    ]),

    h("div", { class: "section-heading" }, [h("h2", {}, "المرفقات"), h("button", { class: "link-btn", on: { click: () => attachInput.click() } }, "+ إضافة")]),
    attachInput,
    attachments.length
      ? h("div", {}, attachments.map((a) => h("div", { class: "list-item" }, [
          h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
            h("span", { trustedHtml: ICONS.file }), h("span", {}, a.file_name), h("span", { style: { marginInlineStart: "auto", fontSize: "11px", color: "var(--c-text-muted)" } }, bytesToSize(a.file_size)),
          ]),
        ])))
      : h("p", { style: { fontSize: "12.5px", color: "var(--c-text-muted)" } }, "لا توجد مرفقات"),
  ]);

  mount(container, node);
}

function row(k, v) { return h("div", { class: "detail-row" }, [h("span", { class: "k" }, k), h("span", {}, v)]); }
function actionBtn(icon, label, onClick) {
  return h("button", { on: { click: onClick } }, [h("span", { trustedHtml: ICONS[icon] }), h("span", {}, label)]);
}

function shareInvoice(inv) {
  if (!inv.file_blob) { toast("لا يوجد ملف للمشاركة", "error"); return; }
  const file = new File([inv.file_blob], inv.file_name || "invoice", { type: inv.file_type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: inv.file_name || "Invoice" }).catch(() => {});
  } else {
    downloadInvoice(inv);
  }
}
function downloadInvoice(inv) {
  if (!inv.file_blob) { toast("لا يوجد ملف للتنزيل", "error"); return; }
  const url = URL.createObjectURL(inv.file_blob);
  const a = document.createElement("a");
  a.href = url; a.download = inv.file_name || "invoice";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
