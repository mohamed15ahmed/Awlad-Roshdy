// =========================================================
// auth.js — Admin-only local authentication (brief section 7:
// "First Version: Login screen, no public registration, admin
// account only"). Credentials are hashed with PBKDF2 (security.js)
// and never leave the device. When firebase-init.js reports a
// configured project, this module should be swapped for Firebase
// Authentication — the login UI and session flow are already built
// to make that swap a drop-in change (see README).
// =========================================================
import { getSetting, setSetting, addAuditLog } from "./db.js";
import { hashPassword, verifyPassword, registerFailedAttempt, clearLoginThrottle, isLockedOut } from "./security.js";

const SESSION_KEY = "__session__";

export async function isSetupComplete() {
  const admin = await getSetting("admin_account");
  return !!admin;
}

export async function setupAdmin(email, password) {
  const { hash, salt, iterations } = await hashPassword(password);
  await setSetting("admin_account", { email: email.trim().toLowerCase(), hash, salt, iterations, created_at: new Date().toISOString() });
  await setSetting("current_user_email", email.trim().toLowerCase());
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: email.trim().toLowerCase(), at: Date.now() }));
  await addAuditLog("ADMIN_SETUP", "user", email.trim().toLowerCase());
  clearLoginThrottle();
}

export async function login(email, password) {
  const lockUntil = isLockedOut();
  if (lockUntil) {
    const secs = Math.ceil((lockUntil - Date.now()) / 1000);
    return { ok: false, code: "locked", secondsLeft: secs };
  }
  const admin = await getSetting("admin_account");
  if (!admin) return { ok: false, code: "unauthorized" };

  const emailOk = email.trim().toLowerCase() === admin.email;
  const passOk = emailOk && (await verifyPassword(password, admin.hash, admin.salt));

  if (!emailOk || !passOk) {
    registerFailedAttempt();
    await addAuditLog("LOGIN_FAILED", "user", email.trim().toLowerCase());
    return { ok: false, code: "invalid" };
  }

  clearLoginThrottle();
  await setSetting("current_user_email", admin.email);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: admin.email, at: Date.now() }));
  await addAuditLog("LOGIN_SUCCESS", "user", admin.email);
  return { ok: true };
}

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

export function isAuthenticated() {
  return !!getSession();
}

export async function logout() {
  const s = getSession();
  if (s) await addAuditLog("LOGOUT", "user", s.email);
  sessionStorage.removeItem(SESSION_KEY);
}
