import { h, mount, toast, formatDateDisplay, formatCurrency, ICONS } from "../utils.js";
import { t } from "../i18n.js";
import { listCompanies, restoreCompany } from "../companies.js";
import { listInvoices, restoreInvoice } from "../invoices.js";
import { getCompany } from "../companies.js";
import { dbDelete } from "../db.js";
import { openConfirmSheet } from "./ui-helpers.js";

export async function renderTrashScreen(container, navigate) {
  const [companies, invoices] = await Promise.all([
    listCompanies({ includeDeleted: true }), listInvoices({ includeDeleted: true }),
  ]);
  const deletedCompanies = companies.filter((c) => c.deleted_at);
  const deletedInvoices = invoices.filter((i) => i.deleted_at);

  if (!deletedCompanies.length && !deletedInvoices.length) {
    mount(container, h("div", {}, [
      titleBar(navigate),
      h("div", { class: "empty-state" }, [h("div", { class: "emoji" }, "🗑️"), h("h3", {}, t("empty_trash_title"))]),
    ]));
    return;
  }

  const node = h("div", {}, [
    titleBar(navigate),
    deletedCompanies.length ? h("div", {}, [
      h("div", { class: "section-heading" }, [h("h2", {}, t("companies_title"))]),
      ...deletedCompanies.map((c) => trashRow(c.company_name, formatDateDisplay(c.deleted_at), async () => {
        await restoreCompany(c.id); toast(t("saved_success"), "success"); renderTrashScreen(container, navigate);
      }, async () => {
        const ok = await openConfirmSheet(t("confirm_delete_forever"));
        if (ok) { await dbDelete("companies", c.id); toast(t("saved_success"), "success"); renderTrashScreen(container, navigate); }
      })),
    ]) : null,
    deletedInvoices.length ? h("div", {}, [
      h("div", { class: "section-heading" }, [h("h2", {}, t("invoices_title"))]),
      ...deletedInvoices.map((inv) => trashRow(
        (inv.invoice_number ? "#" + inv.invoice_number : "فاتورة") + " — " + formatCurrency(inv.total),
        formatDateDisplay(inv.deleted_at),
        async () => { await restoreInvoice(inv.id); toast(t("saved_success"), "success"); renderTrashScreen(container, navigate); },
        async () => {
          const ok = await openConfirmSheet(t("confirm_delete_forever"));
          if (ok) { await dbDelete("invoices", inv.id); toast(t("saved_success"), "success"); renderTrashScreen(container, navigate); }
        }
      )),
    ]) : null,
    h("p", { style: { fontSize: "11.5px", color: "var(--c-text-muted)", marginTop: "10px" } }, "العناصر المحذوفة تُحذف نهائياً تلقائياً بعد 30 يوماً."),
  ]);
  mount(container, node);
}

function titleBar(navigate) {
  return h("div", { class: "screen-title-bar" }, [
    h("button", { class: "back-btn", trustedHtml: `<svg class="rtl-flip" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`, on: { click: () => navigate("#/settings") } }),
    h("h1", {}, t("trash_title")),
  ]);
}

function trashRow(title, deletedAt, onRestore, onDeleteForever) {
  return h("div", { class: "list-item" }, [
    h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
      h("span", { trustedHtml: ICONS.trash, style: { color: "var(--c-text-muted)" } }),
      h("div", { style: { flex: "1" } }, [
        h("div", { style: { fontSize: "13.5px" } }, title),
        h("div", { style: { fontSize: "11px", color: "var(--c-text-muted)" } }, "حُذف في " + deletedAt),
      ]),
      h("button", { class: "icon-link-btn", attrs: { title: t("restore") }, on: { click: onRestore } }, "↩"),
      h("button", { class: "icon-link-btn", attrs: { title: t("delete_forever") }, style: { color: "var(--c-error)" }, on: { click: onDeleteForever } }, "✕"),
    ]),
  ]);
}
