// =========================================================
// firebase-init.js — optional cloud layer (brief sections 4, 30-33).
//
// This build ships "local-first" (steps 1-10 of the brief's suggested
// development order, section 50): everything works fully offline via
// IndexedDB. Cloud sync (Firebase Auth + Firestore + Storage, steps
// 11-14) is scaffolded but intentionally NOT wired to a live project,
// because doing so safely requires:
//   1) a real Firebase project the business owner controls,
//   2) the security rules in /firebase/firestore.rules and
//      storage.rules deployed and tested against that project,
//   3) a bundler step (npm + esbuild/Vite) to pull in the Firebase
//      SDK, since this app intentionally ships with zero build tools.
//
// To enable it: copy firebase/firebase-config.example.js to
// firebase/firebase-config.js with your project's keys, add a bundler,
// import the Firebase modular SDK, and implement the upload/download
// calls marked TODO in js/sync.js. Until then, isFirebaseConfigured()
// returns false and the whole app runs in local-only mode.
// =========================================================
import { setSetting, getSetting } from "./db.js";

let configured = false;

export function isFirebaseConfigured() {
  return configured;
}

export async function initFirebase() {
  // No bundler/SDK present in this build — always local-only.
  // (Kept async + exported so swapping in a real init is a one-file change.)
  configured = false;
  await setSetting("firebase_configured", false);
  return configured;
}

export async function getLastSyncTime() {
  return getSetting("last_sync_time", null);
}
