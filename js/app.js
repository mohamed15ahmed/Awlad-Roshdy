// =========================================================
// app.js — bootstraps the PWA: splash → auth → shell → router.
// =========================================================
import { h, mount, clear, ICONS } from "./utils.js";
import { t, initLanguage } from "./i18n.js";
import { openDB, getSetting, setSetting } from "./db.js";
import { isAuthenticated, isSetupComplete } from "./auth.js";
import { initFirebase, isFirebaseConfigured } from "./firebase-init.js";
import { processQueue } from "./sync.js";

import { renderAuthScreen } from "./screens/auth.js";
import { renderDashboard } from "./screens/dashboard.js";
import { renderCompaniesList, renderCompanyForm, renderCompanyDetails } from "./screens/companies.js";
import { renderInvoicesList, renderInvoiceForm, renderInvoiceDetails } from "./screens/invoices.js";
import { renderSearchScreen } from "./screens/search.js";
import { renderSettingsScreen } from "./screens/settings.js";
import { renderAboutScreen } from "./screens/about.js";
import { renderTrashScreen } from "./screens/trash.js";

const els = {
  splash: document.getElementById("splash-screen"),
  authContainer: document.getElementById("auth-container"),
  appShell: document.getElementById("app-shell"),
  screenContainer: document.getElementById("screen-container"),
  bottomNav: document.getElementById("bottom-nav"),
  sidebar: document.getElementById("sidebar"),
  connPill: document.getElementById("conn-pill"),
  fab: document.getElementById("fab"),
  fabMenu: document.getElementById("fab-menu"),
  fabBackdrop: document.getElementById("fab-backdrop"),
  cloudBanner: document.getElementById("cloud-banner"),
};

const NAV_ITEMS = [
  { key: "dashboard", hash: "#/dashboard", icon: "home", labelKey: "nav_home" },
  { key: "companies", hash: "#/companies", icon: "building", labelKey: "nav_companies" },
  { key: "invoices", hash: "#/invoices", icon: "invoice", labelKey: "nav_invoices" },
  { key: "search", hash: "#/search", icon: "search", labelKey: "nav_search" },
  { key: "settings", hash: "#/settings", icon: "settings", labelKey: "nav_settings" },
];

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function setActiveNav(sectionKey) {
  [...els.bottomNav.children].forEach((btn) => btn.classList.toggle("active", btn.dataset.key === sectionKey));
  [...els.sidebar.querySelectorAll(".nav-link")].forEach((btn) => btn.classList.toggle("active", btn.dataset.key === sectionKey));
}

async function route() {
  const [pathPart, queryPart] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(queryPart || "");
  const segments = pathPart.split("/").filter(Boolean);
  window.scrollTo(0, 0);

  if (!isAuthenticated()) { showAuth(); return; }
  showShell();

  // Restart the screen-enter animation on every navigation (force a
  // reflow so re-adding the same class always replays it).
  els.screenContainer.classList.remove("screen-anim");
  void els.screenContainer.offsetWidth;
  els.screenContainer.classList.add("screen-anim");

  try {
    if (!segments.length || segments[0] === "dashboard") {
      setActiveNav("dashboard");
      await renderDashboard(els.screenContainer, navigate);
    } else if (segments[0] === "companies") {
      setActiveNav("companies");
      if (segments[1] === "new") await renderCompanyForm(els.screenContainer, navigate, null);
      else if (segments[2] === "edit") await renderCompanyForm(els.screenContainer, navigate, segments[1]);
      else if (segments[1]) await renderCompanyDetails(els.screenContainer, navigate, segments[1]);
      else await renderCompaniesList(els.screenContainer, navigate);
    } else if (segments[0] === "invoices") {
      setActiveNav("invoices");
      if (segments[1] === "new") await renderInvoiceForm(els.screenContainer, navigate, null, params.get("company"), params.get("capture") === "1");
      else if (segments[2] === "edit") await renderInvoiceForm(els.screenContainer, navigate, segments[1]);
      else if (segments[1]) await renderInvoiceDetails(els.screenContainer, navigate, segments[1]);
      else await renderInvoicesList(els.screenContainer, navigate);
    } else if (segments[0] === "search") {
      setActiveNav("search");
      await renderSearchScreen(els.screenContainer, navigate, params.get("q") || "");
    } else if (segments[0] === "settings") {
      setActiveNav("settings");
      await renderSettingsScreen(els.screenContainer, navigate, onLogout, renderShellChrome);
    } else if (segments[0] === "about") {
      setActiveNav("settings");
      renderAboutScreen(els.screenContainer, navigate);
    } else if (segments[0] === "trash") {
      setActiveNav("settings");
      await renderTrashScreen(els.screenContainer, navigate);
    } else {
      setActiveNav("dashboard");
      await renderDashboard(els.screenContainer, navigate);
    }
  } catch (err) {
    console.error(err);
    mount(els.screenContainer, h("div", { class: "banner error" }, t("err_generic")));
  }
}

function onLogout() {
  showAuth();
}

function showAuth() {
  els.appShell.classList.remove("active");
  els.authContainer.style.display = "block";
  clear(els.authContainer);
  renderAuthScreen(els.authContainer, () => {
    els.authContainer.style.display = "none";
    clear(els.authContainer);
    navigate("#/dashboard");
  });
}

function showShell() {
  els.authContainer.style.display = "none";
  els.appShell.classList.add("active");
}

function renderShellChrome() {
  clear(els.bottomNav);
  clear(els.sidebar);

  NAV_ITEMS.forEach((item) => {
    els.bottomNav.appendChild(h("button", { attrs: { "data-key": item.key }, on: { click: () => navigate(item.hash) } }, [
      h("span", { trustedHtml: ICONS[item.icon] }), h("span", {}, t(item.labelKey)),
    ]));
  });

  els.sidebar.appendChild(h("div", { class: "brand" }, [
    h("img", { attrs: { src: "icons/icon-192.png", alt: "" } }),
    h("strong", {}, t("app_name") + " " + t("app_manager")),
  ]));
  NAV_ITEMS.forEach((item) => {
    els.sidebar.appendChild(h("button", { class: "nav-link", attrs: { "data-key": item.key }, on: { click: () => navigate(item.hash) } }, [
      h("span", { trustedHtml: ICONS[item.icon] }), h("span", {}, t(item.labelKey)),
    ]));
  });
  els.sidebar.appendChild(h("button", { class: "sidebar-add", on: { click: () => navigate("#/invoices/new") } }, "+ " + t("quick_add_invoice")));

  updateConnectionUI();
}

function updateConnectionUI() {
  const online = navigator.onLine;
  els.connPill.innerHTML = "";
  els.connPill.appendChild(h("span", { class: `conn-dot ${online ? "online" : "offline"}` }));
  els.connPill.appendChild(document.createTextNode(online ? t("online") : t("offline")));

  if (els.cloudBanner) {
    els.cloudBanner.style.display = isFirebaseConfigured() ? "none" : "block";
    els.cloudBanner.textContent = t("local_only_banner");
  }
}

function wireFab() {
  const menuItems = [
    { icon: "building", label: t("quick_add_company"), hash: "#/companies/new" },
    { icon: "invoice", label: t("quick_add_invoice"), hash: "#/invoices/new" },
    { icon: "camera", label: t("quick_scan_invoice"), hash: "#/invoices/new?capture=1" },
  ];
  clear(els.fabMenu);
  menuItems.forEach((item) => {
    els.fabMenu.appendChild(h("div", { class: "fab-item", on: { click: () => { closeFab(); navigate(item.hash); } } }, [
      h("span", { class: "dot", trustedHtml: ICONS[item.icon] }),
      h("span", {}, item.label),
    ]));
  });

  els.fab.innerHTML = "";
  els.fab.appendChild(h("span", { trustedHtml: ICONS.plus }));
  els.fab.addEventListener("click", () => {
    const open = els.fabMenu.classList.toggle("open");
    els.fabBackdrop.classList.toggle("open", open);
    els.fab.style.transform = open ? "rotate(45deg)" : "rotate(0deg)";
  });
  els.fabBackdrop.addEventListener("click", closeFab);
}
function closeFab() {
  els.fabMenu.classList.remove("open");
  els.fabBackdrop.classList.remove("open");
  els.fab.style.transform = "rotate(0deg)";
}

async function bootstrap() {
  await openDB();
  await initLanguage();
  await initFirebase();

  const theme = await getSetting("theme", "light");
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "";

  renderShellChrome();
  wireFab();

  window.addEventListener("online", () => { updateConnectionUI(); processQueue().catch(() => {}); });
  window.addEventListener("offline", updateConnectionUI);
  window.addEventListener("hashchange", route);

  // Splash: verify auth + local DB readiness, then continue.
  const setupDone = await isSetupComplete();
  await new Promise((r) => setTimeout(r, 700));
  els.splash.classList.add("hidden");
  setTimeout(() => { els.splash.style.display = "none"; }, 400);

  if (!location.hash) location.hash = "#/dashboard";
  route();

  if (navigator.onLine) processQueue().catch(() => {});

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.warn("SW registration failed", err));
  }
}

bootstrap();
