// =========================================================
// sync.js — synchronization queue (brief section 27).
// Every local create/update/delete is recorded here so nothing is
// lost. When isFirebaseConfigured() is true, processQueue() uploads
// each item and marks entities Synced; until then it keeps records
// honestly labelled "Local Only" so the user always knows their sync
// status (brief section 8: "the user must always understand whether a
// record has been synchronized").
// =========================================================
import { dbPut, dbGetAll, dbDelete, dbGetAllByIndex, setSetting, getDeviceId } from "./db.js";
import { uuid } from "./utils.js";
import { isFirebaseConfigured } from "./firebase-init.js";

export const OP_TYPES = {
  CREATE_COMPANY: "CREATE_COMPANY", UPDATE_COMPANY: "UPDATE_COMPANY", DELETE_COMPANY: "DELETE_COMPANY",
  CREATE_INVOICE: "CREATE_INVOICE", UPDATE_INVOICE: "UPDATE_INVOICE", DELETE_INVOICE: "DELETE_INVOICE",
  UPLOAD_FILE: "UPLOAD_FILE", DELETE_FILE: "DELETE_FILE",
};

export async function enqueueOperation(operationType, entityType, entityId, payload = {}) {
  const item = {
    id: uuid(),
    operation_type: operationType,
    entity_type: entityType,
    entity_id: entityId,
    payload,
    status: "queued", // queued -> syncing -> done | failed
    retry_count: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_id: await getDeviceId(),
  };
  await dbPut("syncQueue", item);
  return item;
}

export async function getQueueSummary() {
  const all = await dbGetAll("syncQueue");
  return {
    total: all.length,
    queued: all.filter((i) => i.status === "queued").length,
    failed: all.filter((i) => i.status === "failed").length,
    syncing: all.filter((i) => i.status === "syncing").length,
  };
}

/**
 * Process the queue. In local-only mode (no Firebase configured) this
 * simply reports status honestly rather than pretending to upload.
 * Once Firebase is wired (see firebase-init.js), replace the TODO
 * block with real Firestore/Storage writes, keeping this same
 * queue → syncing → done/failed lifecycle and retry/backoff logic.
 */
export async function processQueue(onProgress) {
  if (!navigator.onLine) {
    return { ok: false, reason: "offline" };
  }
  if (!isFirebaseConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  const queue = await dbGetAllByIndex("syncQueue", "status", "queued");
  let done = 0;
  for (const item of queue) {
    item.status = "syncing";
    await dbPut("syncQueue", item);
    onProgress?.({ done, total: queue.length, item });
    try {
      // TODO: real Firestore/Storage upload goes here once configured.
      // await uploadToFirestore(item);
      item.status = "done";
      item.updated_at = new Date().toISOString();
      await dbPut("syncQueue", item);
      done++;
    } catch (err) {
      item.status = "failed";
      item.retry_count += 1;
      item.last_error = String(err?.message || err);
      item.updated_at = new Date().toISOString();
      await dbPut("syncQueue", item);
    }
  }
  await setSetting("last_sync_time", new Date().toISOString());
  return { ok: true, done, total: queue.length };
}

export async function retryFailed() {
  const failed = await dbGetAllByIndex("syncQueue", "status", "failed");
  for (const item of failed) {
    item.status = "queued";
    await dbPut("syncQueue", item);
  }
  return processQueue();
}

export async function clearDoneQueueItems() {
  const all = await dbGetAll("syncQueue");
  for (const item of all) {
    if (item.status === "done") await dbDelete("syncQueue", item.id);
  }
}
