import { h } from "../utils.js";
import { t } from "../i18n.js";

let backdrop, sheet;
function ensureSheetHost() {
  if (backdrop) return;
  sheet = h("div", { class: "sheet" });
  backdrop = h("div", { class: "sheet-backdrop" }, [sheet]);
  document.body.appendChild(backdrop);

  // Clicking the backdrop itself (not the sheet) closes it. Listening on
  // the backdrop and checking the click target (rather than relying on
  // event bubbling stopping) keeps this reliable even if sheet content
  // changes between opens.
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSheet();
  });
}

export function closeSheet() {
  if (!backdrop) return;
  backdrop.classList.remove("open");
}

export function openSheet(contentNode) {
  ensureSheetHost();
  sheet.replaceChildren(contentNode);
  // Force a reflow before adding "open" so the enter transition always
  // plays, even if a sheet was just closed a moment ago.
  void backdrop.offsetHeight;
  backdrop.classList.add("open");
}

/** Returns a Promise<boolean> resolved true if the user confirms. */
export function openConfirmSheet(message, { danger = true, confirmLabel, cancelLabel } = {}) {
  return new Promise((resolve) => {
    const content = h("div", {}, [
      h("h2", {}, "تأكيد"),
      h("p", { style: { fontSize: "13.5px", color: "var(--c-text-muted)", margin: "0 0 18px" } }, message),
      h("div", { class: "btn-row" }, [
        h("button", { class: "btn btn-outline", attrs: { type: "button" }, on: { click: () => { closeSheet(); resolve(false); } } }, cancelLabel || t("no_cancel")),
        h("button", { class: danger ? "btn btn-danger" : "btn btn-primary", attrs: { type: "button" }, on: { click: () => { closeSheet(); resolve(true); } } }, confirmLabel || t("yes_delete")),
      ]),
    ]);
    openSheet(content);
  });
}

/** Simple action sheet: list of {icon, label, onClick} */
export function openActionSheet(title, actions) {
  const content = h("div", {}, [
    h("h2", {}, title),
    ...actions.map((a) => h("button", {
      class: "btn btn-outline", attrs: { type: "button" }, style: { marginBottom: "8px", justifyContent: "flex-start" },
      on: { click: () => { closeSheet(); a.onClick(); } },
    }, [h("span", { trustedHtml: a.icon || "" }), " ", a.label])),
  ]);
  openSheet(content);
}
