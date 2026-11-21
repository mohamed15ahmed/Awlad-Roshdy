// =========================================================
// service-worker.js — app-shell caching + offline fallback.
// Bump CACHE_VERSION whenever any precached file changes so the new
// shell is fetched and old caches are cleaned up on activate.
// =========================================================
const CACHE_VERSION = "v1";
const CACHE_NAME = `awlad-roshdy-shell-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/utils.js",
  "./js/security.js",
  "./js/db.js",
  "./js/i18n.js",
  "./js/auth.js",
  "./js/firebase-init.js",
  "./js/sync.js",
  "./js/companies.js",
  "./js/invoices.js",
  "./js/backup.js",
  "./js/screens/auth.js",
  "./js/screens/dashboard.js",
  "./js/screens/companies.js",
  "./js/screens/invoices.js",
  "./js/screens/search.js",
  "./js/screens/settings.js",
  "./js/screens/about.js",
  "./js/screens/trash.js",
  "./js/screens/ui-helpers.js",
  "./fonts/cairo-arabic-400-normal.woff2",
  "./fonts/cairo-arabic-500-normal.woff2",
  "./fonts/cairo-arabic-600-normal.woff2",
  "./fonts/cairo-arabic-700-normal.woff2",
  "./fonts/cairo-latin-400-normal.woff2",
  "./fonts/cairo-latin-500-normal.woff2",
  "./fonts/cairo-latin-600-normal.woff2",
  "./fonts/cairo-latin-700-normal.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutating requests
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // same-origin only — this app makes no cross-origin calls

  // Navigations: try network first (fresh shell when online), fall back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return resp;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./offline.html")))
    );
    return;
  }

  // Static assets: cache-first, then network, then update cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
