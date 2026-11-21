// =========================================================
// backup.js — independent local backup/restore (brief section 34).
// Distinct from sync.js: a backup is a standalone export the owner
// can keep safe (USB drive, another device) and restore from later,
// even with no cloud account at all.
// =========================================================
import { dbGetAll, dbPut, setSetting, getSetting } from "./db.js";

const BACKUP_VERSION = 1;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data URL
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(dataUrl) {
  return fetch(dataUrl).then((r) => r.blob());
}

export async function exportBackup({ includeFiles = true } = {}) {
  const [companies, invoices, attachments] = await Promise.all([
    dbGetAll("companies"), dbGetAll("invoices"), dbGetAll("attachments"),
  ]);

  const invoicesOut = await Promise.all(invoices.map(async (inv) => {
    const { file_blob, ...rest } = inv;
    return { ...rest, file_data: includeFiles && file_blob ? await blobToBase64(file_blob) : null };
  }));
  const attachmentsOut = await Promise.all(attachments.map(async (a) => {
    const { file_blob, ...rest } = a;
    return { ...rest, file_data: includeFiles && file_blob ? await blobToBase64(file_blob) : null };
  }));

  const backup = {
    backup_version: BACKUP_VERSION,
    app: "Awlad Roshdy Manager",
    exported_at: new Date().toISOString(),
    companies, invoices: invoicesOut, attachments: attachmentsOut,
  };
  await setSetting("last_backup_time", backup.exported_at);
  return backup;
}

export function downloadBackupFile(backupObj) {
  const json = JSON.stringify(backupObj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AwladRoshdy-Backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function importBackup(fileOrJsonText) {
  const text = typeof fileOrJsonText === "string" ? fileOrJsonText : await fileOrJsonText.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("ملف النسخة الاحتياطية غير صالح"); }
  if (!data || data.app !== "Awlad Roshdy Manager" || !Array.isArray(data.companies)) {
    throw new Error("ملف النسخة الاحتياطية غير متوافق");
  }

  for (const c of data.companies) await dbPut("companies", c);
  for (const inv of data.invoices || []) {
    const { file_data, ...rest } = inv;
    const file_blob = file_data ? await base64ToBlob(file_data) : null;
    await dbPut("invoices", { ...rest, file_blob });
  }
  for (const a of data.attachments || []) {
    const { file_data, ...rest } = a;
    const file_blob = file_data ? await base64ToBlob(file_data) : null;
    await dbPut("attachments", { ...rest, file_blob });
  }
  return { companies: data.companies.length, invoices: (data.invoices || []).length };
}

export async function getLastBackupTime() {
  return getSetting("last_backup_time", null);
}
