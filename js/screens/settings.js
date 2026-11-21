import { h, mount, toast, bytesToSize, formatDateDisplay } from "../utils.js";
import { t, getLanguage, setLanguage } from "../i18n.js";
import { getSetting, setSetting, estimateStorageUsage } from "../db.js";
import { logout } from "../auth.js";
import { processQueue, getQueueSummary, retryFailed } from "../sync.js";
import { isFirebaseConfigured } from "../firebase-init.js";
import { exportBackup, downloadBackupFile, importBackup, getLastBackupTime } from "../backup.js";
import { openConfirmSheet } from "./ui-helpers.js";
import { hashPassword, verifyPassword } from "../security.js";

export async function renderSettingsScreen(container, navigate, onLogout, renderShell) {
  const [admin, theme, storageEst, queueSummary, lastSync, lastBackup] = await Promise.all([
    getSetting("admin_account"), getSetting("theme", "light"), estimateStorageUsage(), getQueueSummary(), getSetting("last_sync_time"), getLastBackupTime(),
  ]);

  const langSwitch = toggleRow(t("language") + " (English)", getLanguage() === "en", async (val) => {
    await setLanguage(val ? "en" : "ar");
    renderShell();
  });

  const darkSwitch = toggleRow(t("dark_mode"), theme === "dark", async (val) => {
    const next = val ? "dark" : "light";
    await setSetting("theme", next);
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
  });

  const cloudBanner = h("div", { class: `banner ${isFirebaseConfigured() ? "success" : "info"}` }, isFirebaseConfigured() ? "متصل بمشروع Firebase" : t("local_only_banner"));

  const syncNowBtn = h("button", { class: "btn btn-primary", on: { click: async (e) => {
    e.target.disabled = true;
    const res = await processQueue();
    if (!res.ok) toast(res.reason === "offline" ? t("err_offline") : t("local_only_banner"), "warning");
    else toast(`${t("saved_success")} (${res.done}/${res.total})`, "success");
    e.target.disabled = false;
    renderSettingsScreen(container, navigate, onLogout, renderShell);
  } } }, t("sync_now"));

  // Declared before `node` is built below, since the "import backup" row
  // constructs its hidden <input> via importInputEl() during that build —
  // `let` bindings are not usable before their own declaration executes
  // (temporal dead zone), so this must come first.
  let importInput;
  function importInputEl() {
    importInput = h("input", { attrs: { type: "file", accept: "application/json", class: "sr-only" } });
    importInput.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const res = await importBackup(f);
        toast(`${t("saved_success")} (${res.companies} شركة، ${res.invoices} فاتورة)`, "success");
        renderSettingsScreen(container, navigate, onLogout, renderShell);
      } catch (err) { toast(err.message || t("err_generic"), "error"); }
    });
    return importInput;
  }

  const node = h("div", {}, [
    h("div", { class: "screen-title-bar" }, [h("h1", {}, t("settings_title"))]),

    h("div", { class: "settings-group" }, [
      h("h2", {}, t("account")),
      h("div", { class: "settings-row" }, [h("span", {}, t("email")), h("span", { style: { color: "var(--c-text-muted)" } }, admin?.email || "—")]),
      h("div", { class: "settings-row", style: { cursor: "pointer" }, on: { click: () => openChangePassword(admin) } }, [h("span", {}, t("change_password")), chevron()]),
      h("div", { class: "settings-row", style: { cursor: "pointer", color: "var(--c-error)" }, on: { click: async () => {
        const ok = await openConfirmSheet("هل تريد تسجيل الخروج؟", { danger: false, confirmLabel: t("logout") });
        if (ok) { await logout(); onLogout(); }
      } } }, [h("span", {}, t("logout")), chevron()]),
    ]),

    h("div", { class: "settings-group" }, [
      h("h2", {}, t("appearance") + " / " + t("language")),
      darkSwitch,
      langSwitch,
    ]),

    h("div", { class: "settings-group" }, [
      h("h2", {}, t("sync")),
      cloudBanner,
      h("div", { class: "settings-row" }, [h("span", {}, t("last_sync")), h("span", { style: { color: "var(--c-text-muted)" } }, lastSync ? formatDateDisplay(lastSync) : "—")]),
      h("div", { class: "settings-row" }, [h("span", {}, t("pending_ops")), h("span", { style: { color: "var(--c-text-muted)" } }, String(queueSummary.total))]),
      h("div", { style: { padding: "10px 0" } }, [syncNowBtn]),
      queueSummary.failed > 0 ? h("button", { class: "btn btn-outline", on: { click: async () => { await retryFailed(); renderSettingsScreen(container, navigate, onLogout, renderShell); } } }, "إعادة محاولة الفواتير الفاشلة") : null,
    ]),

    h("div", { class: "settings-group" }, [
      h("h2", {}, t("storage")),
      h("div", { class: "settings-row" }, [h("span", {}, t("stat_storage")), h("span", { style: { color: "var(--c-text-muted)" } }, bytesToSize(storageEst.usage))]),
      h("div", { class: "settings-row", style: { cursor: "pointer" }, on: { click: async () => {
        const ok = await openConfirmSheet("سيتم مسح ملفات الكاش المؤقتة فقط (ليس بياناتك المحفوظة). متابعة؟", { danger: false, confirmLabel: t("clear_cache") });
        if (!ok) return;
        if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
        toast(t("saved_success"), "success");
      } } }, [h("span", {}, t("clear_cache")), chevron()]),
    ]),

    h("div", { class: "settings-group" }, [
      h("h2", {}, t("backup")),
      h("div", { class: "settings-row" }, [h("span", {}, "آخر نسخة احتياطية"), h("span", { style: { color: "var(--c-text-muted)" } }, lastBackup ? formatDateDisplay(lastBackup) : "—")]),
      h("div", { class: "btn-row", style: { padding: "10px 0" } }, [
        h("button", { class: "btn btn-outline", on: { click: async (e) => { e.target.disabled = true; const b = await exportBackup(); downloadBackupFile(b); toast(t("saved_success"), "success"); e.target.disabled = false; } } }, t("export_backup")),
        h("button", { class: "btn btn-outline", on: { click: () => importInput.click() } }, t("import_backup")),
      ]),
      importInputEl(),
    ]),

    h("div", { class: "settings-group" }, [
      h("div", { class: "settings-row", style: { cursor: "pointer" }, on: { click: () => navigate("#/about") } }, [h("span", {}, t("about_title")), chevron()]),
      h("div", { class: "settings-row", style: { cursor: "pointer" }, on: { click: () => navigate("#/trash") } }, [h("span", {}, t("trash_title")), chevron()]),
    ]),

    h("div", { class: "trust-note" }, [
      "🔒 ",
      h("span", {}, "كلمة مرورك مشفّرة محلياً (PBKDF2) ولا تُخزَّن كنص صريح. الملفات والفواتير محفوظة على جهازك فقط طالما لم تُفعَّل المزامنة السحابية."),
    ]),
  ]);

  mount(container, node);
}

function chevron() {
  return h("span", { trustedHtml: `<svg class="rtl-flip" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`, style: { color: "var(--c-text-muted)" } });
}

function toggleRow(label, checked, onChange) {
  const input = h("input", { attrs: { type: "checkbox", checked: checked || null } });
  input.addEventListener("change", (e) => onChange(e.target.checked));
  return h("div", { class: "settings-row" }, [
    h("span", {}, label),
    h("label", { class: "switch" }, [input, h("span", { class: "track" })]),
  ]);
}

function openChangePassword(admin) {
  import("./ui-helpers.js").then(({ openSheet, closeSheet }) => {
    const curr = h("input", { attrs: { type: "password", placeholder: "كلمة المرور الحالية" } });
    const next1 = h("input", { attrs: { type: "password", placeholder: "كلمة المرور الجديدة" } });
    const next2 = h("input", { attrs: { type: "password", placeholder: t("confirm_password") } });
    const err = h("div", { class: "banner error", style: { display: "none" } });
    const content = h("div", {}, [
      h("h2", {}, t("change_password")),
      err,
      h("div", { class: "form-field" }, [curr]),
      h("div", { class: "form-field" }, [next1]),
      h("div", { class: "form-field" }, [next2]),
      h("button", { class: "btn btn-primary", on: { click: async () => {
        const ok = await verifyPassword(curr.value, admin.hash, admin.salt);
        if (!ok) { err.textContent = t("err_invalid_password"); err.style.display = "flex"; return; }
        if (next1.value.length < 8) { err.textContent = t("weak_password"); err.style.display = "flex"; return; }
        if (next1.value !== next2.value) { err.textContent = t("passwords_no_match"); err.style.display = "flex"; return; }
        const { hash, salt, iterations } = await hashPassword(next1.value);
        await setSetting("admin_account", { ...admin, hash, salt, iterations });
        closeSheet();
        toast(t("saved_success"), "success");
      } } }, t("save")),
    ]);
    openSheet(content);
  });
}
