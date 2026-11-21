import { h, mount } from "../utils.js";
import { t } from "../i18n.js";

export function renderAboutScreen(container, navigate) {
  const node = h("div", {}, [
    h("div", { class: "screen-title-bar" }, [
      h("button", { class: "back-btn", trustedHtml: `<svg class="rtl-flip" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`, on: { click: () => navigate("#/settings") } }),
      h("h1", {}, t("about_title")),
    ]),
    h("div", { class: "card", style: { textAlign: "center", padding: "26px 16px" } }, [
      h("img", { attrs: { src: "icons/icon-192.png", alt: "", width: "72", height: "72" }, style: { borderRadius: "18px", margin: "0 auto 12px" } }),
      h("div", { style: { fontWeight: "700", fontSize: "17px" } }, "Awlad Roshdy Manager"),
      h("div", { style: { fontSize: "13px", color: "var(--c-text-muted)", margin: "2px 0" } }, "أولاد رشدي | Awlad Roshdy"),
      h("div", { style: { fontSize: "12.5px", color: "var(--c-text-muted)" } }, t("tagline")),
      h("div", { style: { fontSize: "11.5px", color: "var(--c-secondary-dark)", marginTop: "4px" } }, t("powered_by_ai")),
      h("div", { style: { fontSize: "11px", color: "var(--c-text-muted)", marginTop: "14px" } }, `${t("version")} 1.0.0`),
    ]),

    h("div", { class: "card", style: { marginTop: "14px" } }, [
      h("h2", { style: { fontSize: "13px", color: "var(--c-text-muted)", margin: "0 0 4px" } }, t("management")),
      h("div", { class: "about-contact" }, [h("span", {}, "الحاج / محمد رشدي"), h("a", { attrs: { href: "tel:01271712929" } }, "01271712929")]),
      h("div", { class: "about-contact" }, [h("span", {}, "الحاج / أحمد رشدي"), h("a", { attrs: { href: "tel:01030831446" } }, "01030831446")]),
    ]),
  ]);
  mount(container, node);
}
