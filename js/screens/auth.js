import { h, mount, toast, ICONS } from "../utils.js";
import { t } from "../i18n.js";
import { isSetupComplete, setupAdmin, login } from "../auth.js";

export async function renderAuthScreen(container, onSuccess) {
  const setupDone = await isSetupComplete();
  mount(container, setupDone ? loginForm(onSuccess) : setupForm(onSuccess));
}

function pwField(id, labelKey, autocomplete) {
  const input = h("input", { attrs: { type: "password", id, autocomplete, required: true, minlength: 8 } });
  const toggle = h("button", {
    attrs: { type: "button", "aria-label": "إظهار كلمة المرور" },
    trustedHtml: ICONS.eye,
    on: { click: () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      toggle.innerHTML = showing ? ICONS.eye : ICONS.eyeOff;
    } },
  });
  const field = h("div", { class: "form-field" }, [
    h("label", { attrs: { for: id } }, t(labelKey)),
    h("div", { class: "pw-wrap" }, [input, toggle]),
    h("div", { class: "error-text" }, ""),
  ]);
  return { field, input };
}

function setupForm(onSuccess) {
  const emailField = h("input", { attrs: { type: "email", required: true, autocomplete: "email" } });
  const pw1 = pwField("setup-pw1", "password", "new-password");
  const pw2 = pwField("setup-pw2", "confirm_password", "new-password");
  const errorBanner = h("div", { class: "banner error", style: { display: "none" } });
  const submitBtn = h("button", { class: "btn btn-primary", attrs: { type: "submit" } }, t("setup_btn"));

  const form = h("form", { class: "auth-card", on: { submit: async (e) => {
    e.preventDefault();
    errorBanner.style.display = "none";
    const email = emailField.value.trim();
    const p1 = pw1.input.value, p2 = pw2.input.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return showErr(t("err_invalid_email"));
    if (p1.length < 8) return showErr(t("weak_password"));
    if (p1 !== p2) return showErr(t("passwords_no_match"));

    submitBtn.disabled = true;
    submitBtn.textContent = "...";
    try {
      await setupAdmin(email, p1);
      toast(t("saved_success"), "success");
      onSuccess();
    } catch (err) {
      showErr(t("err_generic"));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("setup_btn");
    }
  } } }, [
    h("div", { class: "auth-logo" }, [
      h("img", { attrs: { src: "icons/icon-192.png", alt: "" } }),
      h("strong", {}, t("app_name") + " " + t("app_manager")),
      h("span", {}, t("tagline")),
    ]),
    h("h1", { style: { fontSize: "17px", margin: "0 0 4px" } }, t("setup_title")),
    h("p", { style: { fontSize: "12.5px", color: "var(--c-text-muted)", margin: "0 0 16px" } }, t("setup_desc")),
    errorBanner,
    h("div", { class: "form-field" }, [h("label", {}, t("email")), emailField]),
    pw1.field,
    pw2.field,
    submitBtn,
  ]);

  function showErr(msg) { errorBanner.textContent = msg; errorBanner.style.display = "flex"; }

  return h("div", { class: "auth-wrap" }, form);
}

function loginForm(onSuccess) {
  const emailField = h("input", { attrs: { type: "email", required: true, autocomplete: "email" } });
  const pw = pwField("login-pw", "password", "current-password");
  const errorBanner = h("div", { class: "banner error", style: { display: "none" } });
  const offlineBanner = h("div", { class: "banner info", style: { display: navigator.onLine ? "none" : "flex" } }, t("err_offline"));
  const submitBtn = h("button", { class: "btn btn-primary", attrs: { type: "submit" } }, [
    h("span", {}, t("login_btn")),
  ]);

  const form = h("form", { class: "auth-card", on: { submit: async (e) => {
    e.preventDefault();
    errorBanner.style.display = "none";
    submitBtn.disabled = true;
    const spinner = h("span", { class: "spinner" });
    submitBtn.appendChild(spinner);
    try {
      const res = await login(emailField.value, pw.input.value);
      if (res.ok) {
        onSuccess();
        return;
      }
      if (res.code === "locked") showErr(`${t("err_locked")} (${res.secondsLeft}s)`);
      else if (res.code === "unauthorized") showErr(t("err_unauthorized"));
      else showErr(t("err_invalid_password"));
    } catch {
      showErr(t("err_generic"));
    } finally {
      submitBtn.disabled = false;
      spinner.remove();
    }
  } } }, [
    h("div", { class: "auth-logo" }, [
      h("img", { attrs: { src: "icons/icon-192.png", alt: "" } }),
      h("strong", {}, t("app_name") + " " + t("app_manager")),
      h("span", {}, t("tagline")),
    ]),
    h("h1", { style: { fontSize: "17px", margin: "0 0 14px", textAlign: "center" } }, t("login_title")),
    errorBanner,
    offlineBanner,
    h("div", { class: "form-field" }, [h("label", {}, t("email")), emailField]),
    pw.field,
    submitBtn,
  ]);

  function showErr(msg) { errorBanner.textContent = msg; errorBanner.style.display = "flex"; }

  window.addEventListener("online", () => offlineBanner.style.display = "none");
  window.addEventListener("offline", () => offlineBanner.style.display = "flex");

  return h("div", { class: "auth-wrap" }, form);
}
