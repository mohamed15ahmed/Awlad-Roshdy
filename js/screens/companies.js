import { h, mount, toast, initials, debounce, formatDateDisplay, formatCurrency, ICONS } from "../utils.js";
import { t } from "../i18n.js";
import {
  listCompanies, getCompany, createCompany, updateCompany, softDeleteCompany,
  validateCompany, findPossibleDuplicate, toggleFavorite, searchCompaniesLocal, CATEGORIES,
} from "../companies.js";
import { listInvoicesForCompany } from "../invoices.js";
import { openConfirmSheet } from "./ui-helpers.js";
import { syncClass, syncLabel } from "./dashboard.js";

// ---------------- List ----------------
export async function renderCompaniesList(container, navigate) {
  mount(container, h("div", { class: "skeleton", style: { height: "60px", margin: "12px 0" } }));

  let all = await listCompanies();
  let query = "";
  let filter = "all";

  const searchInput = h("input", { attrs: { type: "search", placeholder: t("search_placeholder") } });
  const listEl = h("div", {});

  const filters = [
    ["all", "الكل"], ["favorite", "المفضلة"], ["with_invoices", "لديها فواتير"], ["without_invoices", "بدون فواتير"],
  ];
  const filterRow = h("div", { class: "filter-row" }, filters.map(([key, label]) =>
    h("button", {
      class: `filter-chip ${filter === key ? "active" : ""}`,
      on: { click: (e) => { filter = key; [...filterRow.children].forEach((c) => c.classList.remove("active")); e.target.classList.add("active"); renderList(); } },
    }, label)
  ));

  async function renderList() {
    let items = all;
    if (query) items = searchCompaniesLocal(items, query);
    if (filter === "favorite") items = items.filter((c) => c.is_favorite);
    if (filter === "with_invoices" || filter === "without_invoices") {
      const counts = await Promise.all(items.map(async (c) => [c.id, (await listInvoicesForCompany(c.id)).length]));
      const countMap = Object.fromEntries(counts);
      items = items.filter((c) => (filter === "with_invoices" ? countMap[c.id] > 0 : countMap[c.id] === 0));
    }

    if (!items.length) {
      mount(listEl, h("div", { class: "empty-state" }, [
        h("div", { class: "emoji" }, "🏬"),
        h("h3", {}, query ? t("no_results_title") : t("no_companies_title")),
        h("p", {}, query ? t("no_results_sub") : t("no_companies_sub")),
        !query ? h("button", { class: "btn btn-primary", on: { click: () => navigate("#/companies/new") } }, t("add_company")) : null,
      ]));
      return;
    }
    mount(listEl, h("div", {}, items.map((c) => companyCard(c, navigate))));
  }

  searchInput.addEventListener("input", debounce((e) => { query = e.target.value; renderList(); }, 250));

  mount(container, h("div", {}, [
    h("div", { class: "search-bar" }, [searchInput]),
    filterRow,
    listEl,
  ]));
  await renderList();
}

function companyCard(c, navigate) {
  return h("div", { class: "company-card", on: { click: () => navigate(`#/companies/${c.id}`) } }, [
    h("div", { class: "avatar-badge" }, initials(c.company_name)),
    h("div", { class: "grow" }, [
      h("h3", {}, c.company_name),
      h("div", { class: "meta" }, [c.representative_name, c.phone].filter(Boolean).join(" · ") || "—"),
      h("div", { class: "chip-row" }, [
        c.category ? h("span", { class: "chip" }, c.category) : null,
        c.is_favorite ? h("span", { class: "chip fav" }, "★ " + t("favorite")) : null,
        h("span", { class: `sync-badge ${syncClass(c.sync_status)}` }, syncLabel(c.sync_status)),
      ]),
    ]),
    h("span", { trustedHtml: ICONS.chevron, style: { color: "var(--c-text-muted)", flexShrink: "0" } }),
  ]);
}

// ---------------- Add / Edit form ----------------
export async function renderCompanyForm(container, navigate, companyId) {
  const isEdit = !!companyId;
  const existing = isEdit ? await getCompany(companyId) : null;
  if (isEdit && !existing) { navigate("#/companies"); return; }

  const fields = {
    company_name: h("input", { attrs: { required: true, maxlength: 120 } }),
    representative_name: h("input", { attrs: { maxlength: 80 } }),
    phone: h("input", { attrs: { type: "tel", maxlength: 20 } }),
    whatsapp: h("input", { attrs: { type: "tel", maxlength: 20 } }),
    address: h("input", { attrs: { maxlength: 160 } }),
    notes: h("textarea", { attrs: { maxlength: 500 } }),
  };
  const categorySelect = h("select", {}, [
    h("option", { attrs: { value: "" } }, "— بدون —"),
    ...CATEGORIES.map((cat) => h("option", { attrs: { value: cat } }, cat)),
  ]);
  const favCheck = h("input", { attrs: { type: "checkbox" } });

  if (existing) {
    fields.company_name.value = existing.company_name || "";
    fields.representative_name.value = existing.representative_name || "";
    fields.phone.value = existing.phone || "";
    fields.whatsapp.value = existing.whatsapp || "";
    fields.address.value = existing.address || "";
    fields.notes.value = existing.notes || "";
    categorySelect.value = existing.category || "";
    favCheck.checked = !!existing.is_favorite;
  }

  const dupBanner = h("div", { class: "banner warning", style: { display: "none" } });
  const errText = (key) => { const f = fieldWrap[key]; if (f) { f.classList.add("invalid"); f.querySelector(".error-text").textContent = t("company_required"); } };

  const fieldWrap = {
    company_name: field(t("company_name"), fields.company_name, true),
    representative_name: field(t("representative_name"), fields.representative_name),
    phone: field(t("phone"), fields.phone),
    whatsapp: field(t("whatsapp"), fields.whatsapp),
    address: field(t("address"), fields.address),
    category: field(t("category"), categorySelect),
    notes: field(t("notes"), fields.notes),
  };

  async function collectData() {
    return {
      company_name: fields.company_name.value,
      representative_name: fields.representative_name.value,
      phone: fields.phone.value,
      whatsapp: fields.whatsapp.value,
      address: fields.address.value,
      category: categorySelect.value,
      notes: fields.notes.value,
      is_favorite: favCheck.checked,
    };
  }

  async function validateAndWarn() {
    Object.values(fieldWrap).forEach((f) => f.classList.remove("invalid"));
    const data = await collectData();
    const errors = validateCompany(data);
    for (const [key, code] of Object.entries(errors)) {
      const f = fieldWrap[key];
      if (f) { f.classList.add("invalid"); f.querySelector(".error-text").textContent = t(code); }
    }
    if (Object.keys(errors).length) return null;

    const dup = await findPossibleDuplicate(data.company_name, companyId || null);
    dupBanner.style.display = dup ? "flex" : "none";
    dupBanner.textContent = dup ? t("possible_duplicate_company") : "";
    return data;
  }

  async function doSave(andAddInvoice) {
    const data = await validateAndWarn();
    if (!data) return;
    saveBtn.disabled = true;
    try {
      const saved = isEdit ? await updateCompany(companyId, data) : await createCompany(data);
      toast(t("saved_success"), "success");
      if (andAddInvoice) navigate(`#/invoices/new?company=${saved.id}`);
      else navigate(`#/companies/${saved.id}`);
    } catch (err) {
      toast(t("err_generic"), "error");
    } finally {
      saveBtn.disabled = false;
    }
  }

  const saveBtn = h("button", { class: "btn btn-primary", attrs: { type: "submit" } }, t("save"));
  const saveAddBtn = !isEdit ? h("button", { class: "btn btn-outline", attrs: { type: "button" }, on: { click: () => doSave(true) } }, t("save_and_add_invoice")) : null;

  const form = h("form", { on: { submit: (e) => { e.preventDefault(); doSave(false); } } }, [
    dupBanner,
    fieldWrap.company_name,
    fieldWrap.representative_name,
    fieldWrap.phone,
    fieldWrap.whatsapp,
    fieldWrap.address,
    fieldWrap.category,
    fieldWrap.notes,
    h("div", { class: "form-field checkbox-row" }, [favCheck, h("label", {}, t("favorite"))]),
    h("div", { class: "btn-row", style: { marginTop: "18px" } }, [saveAddBtn, saveBtn].filter(Boolean)),
  ]);

  mount(container, h("div", {}, [
    titleBar(isEdit ? t("edit_company") : t("add_company"), navigate),
    form,
  ]));
}

function field(label, input, required = false) {
  return h("div", { class: "form-field" }, [
    h("label", {}, label + (required ? " *" : "")),
    input,
    h("div", { class: "error-text" }, ""),
  ]);
}

function titleBar(title, navigate, backHash = "#/companies") {
  return h("div", { class: "screen-title-bar" }, [
    h("button", { class: "back-btn", attrs: { "aria-label": "رجوع" }, trustedHtml: dir_chevron(), on: { click: () => navigate(backHash) } }),
    h("h1", {}, title),
  ]);
}
function dir_chevron() {
  return `<svg class="rtl-flip" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
}

// ---------------- Details ----------------
export async function renderCompanyDetails(container, navigate, companyId) {
  const company = await getCompany(companyId);
  if (!company) { navigate("#/companies"); return; }
  const invoices = await listInvoicesForCompany(companyId);
  const totalValue = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const groups = groupByYearMonth(invoices);

  const node = h("div", {}, [
    titleBar(t("details"), navigate),
    h("div", { class: "detail-hero" }, [
      h("div", { style: { display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" } }, [
        h("div", { class: "avatar-badge", style: { width: "52px", height: "52px", fontSize: "18px" } }, initials(company.company_name)),
        h("div", { style: { flex: "1" } }, [
          h("h2", { style: { margin: "0 0 3px", fontSize: "16px" } }, company.company_name),
          company.category ? h("span", { class: "chip" }, company.category) : null,
        ]),
        h("button", {
          class: "icon-link-btn", attrs: { "aria-label": t("favorite") },
          trustedHtml: company.is_favorite ? ICONS.star : ICONS.starOutline,
          on: { click: async (e) => { const c = await toggleFavorite(companyId); e.currentTarget.innerHTML = c.is_favorite ? ICONS.star : ICONS.starOutline; } },
        }),
      ]),
      row(t("representative_name"), company.representative_name || "—"),
      row(t("phone"), company.phone || "—"),
      row(t("address"), company.address || "—"),
      row(t("invoices_count"), String(invoices.length)),
      row("إجمالي المشتريات", formatCurrency(totalValue)),
      company.notes ? row(t("notes"), company.notes) : null,
    ]),

    h("div", { class: "action-grid" }, [
      actionBtn("phone", t("call"), company.phone ? () => window.location.href = `tel:${company.phone}` : null),
      actionBtn("whatsapp", t("open_whatsapp"), company.whatsapp ? () => window.open(`https://wa.me/${company.whatsapp.replace(/\D/g, "")}`, "_blank", "noopener") : null),
      actionBtn("plus", t("add_invoice"), () => navigate(`#/invoices/new?company=${companyId}`)),
      actionBtn("edit", t("edit_company"), () => navigate(`#/companies/${companyId}/edit`)),
    ]),

    h("button", { class: "btn btn-outline", style: { marginBottom: "16px" }, on: { click: async () => {
      const ok = await openConfirmSheet(t("confirm_delete"));
      if (ok) { await softDeleteCompany(companyId); toast(t("saved_success"), "success"); navigate("#/companies"); }
    } } }, [h("span", { trustedHtml: ICONS.trash }), " ", t("delete_forever").replace("نهائي", "")]),

    h("div", { class: "section-heading" }, [h("h2", {}, t("invoices_title"))]),
    groups.length
      ? h("div", {}, groups.map((g) => yearGroup(g, navigate)))
      : h("div", { class: "empty-state" }, [h("p", {}, t("no_invoices_sub"))]),
  ]);

  mount(container, node);
}

function row(k, v) {
  return h("div", { class: "detail-row" }, [h("span", { class: "k" }, k), h("span", {}, v)]);
}
function actionBtn(icon, label, onClick) {
  return h("button", { attrs: { disabled: !onClick }, on: onClick ? { click: onClick } : {} }, [
    h("span", { trustedHtml: ICONS[icon] }), h("span", {}, label),
  ]);
}

function groupByYearMonth(invoices) {
  const map = {};
  for (const inv of invoices) {
    const d = new Date(inv.invoice_date);
    const y = d.getFullYear(), m = d.getMonth();
    map[y] = map[y] || {};
    map[y][m] = map[y][m] || [];
    map[y][m].push(inv);
  }
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return Object.keys(map).sort((a, b) => b - a).map((y) => ({
    year: y,
    months: Object.keys(map[y]).sort((a, b) => b - a).map((m) => ({ name: monthNames[m], invoices: map[y][m] })),
  }));
}

function yearGroup(g, navigate) {
  return h("div", { class: "timeline-group" }, [
    h("div", { class: "year" }, g.year),
    ...g.months.map((m) => h("div", {}, [
      h("div", { class: "month" }, m.name),
      ...m.invoices.map((inv) => h("div", { class: "invoice-card", on: { click: () => navigate(`#/invoices/${inv.id}`) } }, [
        h("div", { class: "invoice-thumb" }, h("span", { trustedHtml: ICONS.invoice })),
        h("div", { class: "grow" }, [
          h("h3", {}, inv.invoice_number ? `#${inv.invoice_number}` : formatDateDisplay(inv.invoice_date)),
          h("div", { class: "meta" }, formatDateDisplay(inv.invoice_date)),
        ]),
        h("div", { class: "amount" }, formatCurrency(inv.total)),
      ])),
    ])),
  ]);
}
