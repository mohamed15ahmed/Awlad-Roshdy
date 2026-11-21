// =========================================================
// db.js — IndexedDB wrapper implementing the schema from
// project brief section 29. All data (including invoice files,
// stored as Blobs) stays on-device until explicitly synced.
// =========================================================

const DB_NAME = "awladRoshdyDB";
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      const companies = db.createObjectStore("companies", { keyPath: "id" });
      companies.createIndex("company_name", "company_name", { unique: false });
      companies.createIndex("is_favorite", "is_favorite", { unique: false });
      companies.createIndex("sync_status", "sync_status", { unique: false });
      companies.createIndex("deleted_at", "deleted_at", { unique: false });

      const invoices = db.createObjectStore("invoices", { keyPath: "id" });
      invoices.createIndex("company_id", "company_id", { unique: false });
      invoices.createIndex("invoice_date", "invoice_date", { unique: false });
      invoices.createIndex("sync_status", "sync_status", { unique: false });
      invoices.createIndex("deleted_at", "deleted_at", { unique: false });

      const attachments = db.createObjectStore("attachments", { keyPath: "id" });
      attachments.createIndex("invoice_id", "invoice_id", { unique: false });

      const voiceNotes = db.createObjectStore("voiceNotes", { keyPath: "id" });
      voiceNotes.createIndex("invoice_id", "invoice_id", { unique: false });

      const syncQueue = db.createObjectStore("syncQueue", { keyPath: "id" });
      syncQueue.createIndex("status", "status", { unique: false });
      syncQueue.createIndex("entity_type", "entity_type", { unique: false });

      db.createObjectStore("settings", { keyPath: "key" });

      const auditLogs = db.createObjectStore("auditLogs", { keyPath: "id" });
      auditLogs.createIndex("created_at", "created_at", { unique: false });
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked — close other tabs of this app."));
  });
  return dbPromise;
}

function tx(db, storeNames, mode = "readonly") {
  return db.transaction(storeNames, mode);
}

export async function dbPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, [storeName], "readwrite");
    t.objectStore(storeName).put(value);
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
  });
}

export async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, [storeName]);
    const r = t.objectStore(storeName).get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, [storeName], "readwrite");
    t.objectStore(storeName).delete(key);
    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error);
  });
}

export async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, [storeName]);
    const r = t.objectStore(storeName).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function dbGetAllByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, [storeName]);
    const idx = t.objectStore(storeName).index(indexName);
    const r = idx.getAll(value);
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function dbCount(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = tx(db, [storeName]);
    const r = t.objectStore(storeName).count();
    r.onsuccess = () => resolve(r.result || 0);
    r.onerror = () => reject(r.error);
  });
}

export async function getSetting(key, fallback = null) {
  const row = await dbGet("settings", key);
  return row ? row.value : fallback;
}
export async function setSetting(key, value) {
  return dbPut("settings", { key, value, updated_at: new Date().toISOString() });
}

export async function addAuditLog(action, entityType, entityId) {
  return dbPut("auditLogs", {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    user_id: await getSetting("current_user_email", "unknown"),
    action, entity_type: entityType, entity_id: entityId,
    device_id: await getDeviceId(),
    created_at: new Date().toISOString(),
  });
}

export async function getDeviceId() {
  let id = await getSetting("device_id");
  if (!id) {
    id = "dev-" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    await setSetting("device_id", id);
  }
  return id;
}

/** Rough estimate of local storage usage (Storage API where available). */
export async function estimateStorageUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage: usage || 0, quota: quota || 0 };
    } catch { /* ignore */ }
  }
  return { usage: 0, quota: 0 };
}
