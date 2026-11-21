import { h, mount, formatCurrency, formatDateDisplay, bytesToSize, ICONS } from "../utils.js";
import { t } from "../i18n.js";
import { computeStats, listInvoices } from "../invoices.js";
import { listCompanies } from "../companies.js";
import { getQueueSummary } from "../sync.js";
import { estimateStorageUsage, getSetting } from "../db.js";

function greeting() {
  const h24 = new Date().getHours();
  if (h24 < 12) return t("good_morning");
  if (h24 < 18) return t("good_afternoon");
  return t("good_evening");
}

export async function renderDashboard(container, navigate) {
  const skeleton = h("div", {}, [
    h("div", { class: "skeleton", style: { height: "18px", width: "140px", margin: "10px 0" } }),
    h("div", { class: "stat-grid" }, Array.from({ length: 4 }, () => h("div", { class: "skeleton", style: { height: "72px" } }))),
  ]);
  mount(container, skeleton);

  const [stats, companies, invoices, queueSummary, storageEst] = await Promise.all([
    computeStats(), listCompanies(), listInvoices(), getQueueSummary(), estimateStorageUsage(),
  ]);

  const companiesById = Object.fromEntries(companies.map((c) => [c.id, c]));
  const recent = invoices.slice(0, 5);

  const alerts = [];
  if (stats.pendingSync > 0) alerts.push({ type: "warning", text: t("alert_pending_sync") });
  if (queueSummary.failed > 0) alerts.push({ type: "error", text: t("alert_sync_failed") });
  if (storageEst.quota && storageEst.usage / storageEst.quota > 0.85) alerts.push({ type: "warning", text: t("alert_low_storage") });

  const node = h("div", {}, [
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "10px 0 2px" } }, [
      h("div", {}, [
        h("div", { style: { fontSize: "13px", color: "var(--c-text-muted)" } }, greeting()),
        h("div", { style: { fontSize: "16px", fontWeight: "700" } }, t("app_name") + " " + t("app_manager")),
      ]),
    ]),
    ...alerts.map((a) => h("div", { class: `banner ${a.type}` }, a.text)),

    h("div", { class: "stat-grid" }, [
      statCard(stats.totalCompanies, t("stat_companies")),
      statCard(stats.totalInvoices, t("stat_invoices")),
      statCard(stats.invoicesThisMonth, t("stat_invoices_month")),
      statCard(formatCurrency(stats.totalPurchasesMonth), t("stat_purchases_month")),
      statCard(stats.pendingSync, t("stat_pending_sync")),
      statCard(bytesToSize(storageEst.usage), t("stat_storage")),
    ]),

    h("div", { class: "section-heading" }, [h("h2", {}, "إجراءات سريعة")]),
    h("div", { class: "quick-actions" }, [
      quickBtn("building", t("quick_add_company"), () => navigate("#/companies/new")),
      quickBtn("invoice", t("quick_add_invoice"), () => navigate("#/invoices/new")),
      quickBtn("camera", t("quick_scan_invoice"), () => navigate("#/invoices/new?capture=1")),
      quickBtn("search", t("quick_search"), () => navigate("#/search")),
    ]),

    h("div", { class: "section-heading" }, [
      h("h2", {}, t("recent_invoices")),
      recent.length ? h("button", { class: "link-btn", on: { click: () => navigate("#/invoices") } }, t("view_all")) : null,
    ]),
    recent.length
      ? h("div", {}, recent.map((inv) => invoiceRow(inv, companiesById[inv.company_id], navigate)))
      : h("div", { class: "empty-state card" }, [
          h("div", { class: "emoji" }, "🧾"),
          h("h3", {}, t("no_invoices_title")),
          h("p", {}, t("no_invoices_sub")),
          h("button", { class: "btn btn-primary", on: { click: () => navigate("#/invoices/new") } }, t("add_invoice")),
        ]),
  ]);

  mount(container, node);
}

function statCard(value, label) {
  return h("div", { class: "card stat-card" }, [
    h("div", { class: "stat-value" }, String(value)),
    h("div", { class: "stat-label" }, label),
  ]);
}

function quickBtn(icon, label, onClick) {
  return h("button", { on: { click: onClick } }, [
    h("span", { trustedHtml: ICONS[icon] || "" }),
    h("span", {}, label),
  ]);
}

function invoiceRow(inv, company, navigate) {
  return h("div", { class: "invoice-card", on: { click: () => navigate(`#/invoices/${inv.id}`) } }, [
    h("div", { class: "invoice-thumb" }, thumbContent(inv)),
    h("div", { class: "grow" }, [
      h("h3", {}, company?.company_name || "—"),
      h("div", { class: "meta" }, `${inv.invoice_number ? "#" + inv.invoice_number + " · " : ""}${formatDateDisplay(inv.invoice_date)}`),
      h("span", { class: `sync-badge ${syncClass(inv.sync_status)}` }, syncLabel(inv.sync_status)),
    ]),
    h("div", { class: "amount" }, formatCurrency(inv.total)),
  ]);
}

function thumbContent(inv) {
  if (inv.file_blob && inv.file_type?.startsWith("image/")) {
    const img = h("img", { attrs: { alt: "" } });
    img.src = URL.createObjectURL(inv.file_blob);
    return img;
  }
  return h("span", { trustedHtml: ICONS.file });
}

export function syncClass(status) {
  return { local: "local", pending: "pending", syncing: "syncing", synced: "synced", failed: "failed", deleted: "deleted" }[status] || "local";
}
export function syncLabel(status) {
  return { local: t("sync_local"), pending: t("sync_pending"), syncing: t("sync_syncing"), synced: t("sync_synced"), failed: t("sync_failed"), deleted: t("sync_deleted") }[status] || t("sync_local");
}
