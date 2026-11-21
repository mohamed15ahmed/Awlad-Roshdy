import { h, mount, debounce, formatCurrency, formatDateDisplay, ICONS } from "../utils.js";
import { t } from "../i18n.js";
import { listCompanies, searchCompaniesLocal } from "../companies.js";
import { listInvoices, searchInvoicesLocal } from "../invoices.js";
import { syncClass, syncLabel } from "./dashboard.js";

export async function renderSearchScreen(container, navigate, presetQuery = "") {
  const [companies, invoices] = await Promise.all([listCompanies(), listInvoices()]);
  const companiesById = Object.fromEntries(companies.map((c) => [c.id, c]));

  const input = h("input", { attrs: { type: "search", placeholder: t("search_placeholder"), autofocus: true } });
  input.value = presetQuery;
  const resultsEl = h("div", {});
  const minAmountInput = h("input", { attrs: { type: "number", placeholder: "من" } });
  const maxAmountInput = h("input", { attrs: { type: "number", placeholder: "إلى" } });
  const clearBtn = h("button", { class: "link-btn", on: { click: () => { input.value = ""; minAmountInput.value = ""; maxAmountInput.value = ""; runSearch(); } } }, t("clear_filters"));

  function runSearch() {
    const q = input.value.trim();
    const min = Number(minAmountInput.value) || null;
    const max = Number(maxAmountInput.value) || null;

    let matchedCompanies = q ? searchCompaniesLocal(companies, q) : [];
    let matchedInvoices = q ? searchInvoicesLocal(invoices, companiesById, q) : invoices.slice(0, 0);
    if (min !== null) matchedInvoices = matchedInvoices.filter((i) => Number(i.total) >= min);
    if (max !== null) matchedInvoices = matchedInvoices.filter((i) => Number(i.total) <= max);

    if (!q && min === null && max === null) {
      mount(resultsEl, h("div", { class: "empty-state" }, [
        h("div", { class: "emoji" }, "🔎"),
        h("p", {}, "ابدأ الكتابة للبحث في الشركات والفواتير"),
      ]));
      return;
    }
    if (!matchedCompanies.length && !matchedInvoices.length) {
      mount(resultsEl, h("div", { class: "empty-state" }, [
        h("div", { class: "emoji" }, "🔎"),
        h("h3", {}, t("no_results_title")),
        h("p", {}, t("no_results_sub")),
      ]));
      return;
    }

    const node = h("div", {}, [
      matchedCompanies.length ? h("div", {}, [
        h("div", { class: "section-heading" }, [h("h2", {}, t("companies_title"))]),
        ...matchedCompanies.slice(0, 8).map((c) => h("div", { class: "list-item", on: { click: () => navigate(`#/companies/${c.id}`) } }, [
          h("strong", {}, c.company_name), h("div", { class: "meta", style: { fontSize: "12px", color: "var(--c-text-muted)" } }, c.phone || c.representative_name || ""),
        ])),
      ]) : null,
      matchedInvoices.length ? h("div", {}, [
        h("div", { class: "section-heading" }, [h("h2", {}, t("invoices_title"))]),
        ...matchedInvoices.slice(0, 30).map((inv) => h("div", { class: "invoice-card", on: { click: () => navigate(`#/invoices/${inv.id}`) } }, [
          h("div", { class: "invoice-thumb" }, h("span", { trustedHtml: ICONS.invoice })),
          h("div", { class: "grow" }, [
            h("h3", {}, companiesById[inv.company_id]?.company_name || "—"),
            h("div", { class: "meta" }, [inv.invoice_number ? "#" + inv.invoice_number : null, formatDateDisplay(inv.invoice_date)].filter(Boolean).join(" · ")),
            h("span", { class: `sync-badge ${syncClass(inv.sync_status)}` }, syncLabel(inv.sync_status)),
          ]),
          h("div", { class: "amount" }, formatCurrency(inv.total)),
        ])),
      ]) : null,
    ]);
    mount(resultsEl, node);
  }

  input.addEventListener("input", debounce(runSearch, 250));
  minAmountInput.addEventListener("input", debounce(runSearch, 250));
  maxAmountInput.addEventListener("input", debounce(runSearch, 250));

  mount(container, h("div", {}, [
    h("div", { class: "search-bar" }, [input]),
    h("div", { class: "section-heading", style: { margin: "0 0 8px" } }, [h("h2", {}, t("filters")), clearBtn]),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" } }, [minAmountInput, maxAmountInput]),
    resultsEl,
  ]));

  runSearch();
}
