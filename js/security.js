// =========================================================
// security.js — password hashing, file validation, safe naming,
// and brute-force login protection.
//
// IMPORTANT: this local password hashing is a safeguard for the
// single-device demo/offline auth described in the brief (section 7 —
// "Admin account only"). It is NOT a replacement for a real identity
// provider. Before shipping to real users, wire js/firebase-init.js to
// a live Firebase project and switch auth.js to Firebase Authentication,
// which is already the login screen's intended long-term backend.
// =========================================================

const PBKDF2_ITERATIONS = 210000; // OWASP 2024+ recommended minimum for PBKDF2-SHA256

export async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const salt = saltB64 ? b64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bytesToB64(new Uint8Array(bits)), salt: bytesToB64(salt), iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(password, storedHashB64, storedSaltB64) {
  const { hash } = await hashPassword(password, storedSaltB64);
  return timingSafeEqual(hash, storedHashB64);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToB64(bytes) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------- Login throttling ----------------
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minute, doubles per repeated lockout

export function getLoginState() {
  try {
    return JSON.parse(sessionStorage.getItem("__login_throttle__") || "null") || { attempts: 0, lockUntil: 0, lockoutMs: LOCKOUT_MS };
  } catch { return { attempts: 0, lockUntil: 0, lockoutMs: LOCKOUT_MS }; }
}
export function registerFailedAttempt() {
  const s = getLoginState();
  s.attempts += 1;
  if (s.attempts >= MAX_ATTEMPTS) {
    s.lockUntil = Date.now() + s.lockoutMs;
    s.lockoutMs = Math.min(s.lockoutMs * 2, 30 * 60_000); // exponential backoff, capped 30 min
    s.attempts = 0;
  }
  sessionStorage.setItem("__login_throttle__", JSON.stringify(s));
  return s;
}
export function clearLoginThrottle() {
  sessionStorage.removeItem("__login_throttle__");
}
export function isLockedOut() {
  const s = getLoginState();
  return s.lockUntil > Date.now() ? s.lockUntil : 0;
}

// ---------------- File validation ----------------
export const ALLOWED_FILE_TYPES = {
  "image/jpeg": { ext: ["jpg", "jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: ["png"], magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/webp": { ext: ["webp"], magic: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF....WEBP
  "image/heic": { ext: ["heic", "heif"], magic: null }, // limited browser support for magic sniff
  "application/pdf": { ext: ["pdf"], magic: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
};
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export async function validateFile(file) {
  const errors = [];
  if (!file) { errors.push("لم يتم اختيار ملف"); return { ok: false, errors }; }

  if (file.size > MAX_FILE_SIZE) errors.push("حجم الملف أكبر من الحد المسموح (15 ميجابايت)");
  if (file.size === 0) errors.push("الملف فارغ أو تالف");

  const typeInfo = ALLOWED_FILE_TYPES[file.type];
  const extFromName = (file.name.split(".").pop() || "").toLowerCase();
  const extOk = Object.values(ALLOWED_FILE_TYPES).some((t) => t.ext.includes(extFromName));

  if (!typeInfo && !extOk) {
    errors.push("نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP, HEIC, PDF");
  } else if (typeInfo?.magic) {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const matches = typeInfo.magic.some((sig) => sig.every((b, i) => head[i] === b));
    if (!matches) errors.push("محتوى الملف لا يطابق نوعه المعلن — قد يكون الملف غير سليم");
  }
  return { ok: errors.length === 0, errors };
}

/** Strip control chars, path separators, and quotes; never trust the original filename (section 20 & 33). */
export function safeFileName(companyName, isoDate, invoiceNumber, originalName) {
  const cleanPart = (s) => (s || "")
    .toString()
    .replace(/[\/\\:*?"<>|\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .trim()
    .slice(0, 40);

  const d = isoDate ? new Date(isoDate) : new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const company = cleanPart(companyName) || "Company";
  const num = cleanPart(invoiceNumber) || "001";
  const extMatch = /\.([a-zA-Z0-9]{2,5})$/.exec(originalName || "");
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  return `${company}_${dateStr}_${num}.${ext}`;
}

/** Remove control characters from free-text fields before storing (defense in depth; DOM builder already escapes on render). */
export function sanitizeText(str) {
  return (str ?? "").toString().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}
