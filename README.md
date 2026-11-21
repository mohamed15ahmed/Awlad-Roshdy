# Awlad Roshdy Manager | أولاد رشدي

A mobile-first, installable, offline-first PWA for archiving supplier
companies and invoices for a supermarket business. Plain HTML/CSS/JS —
no framework, no build step, no third-party CDNs.

## What's actually working in this build

This delivers a **complete, working local-first app** — everything in
the brief's MVP list (section 48) except cloud sync, which is
scaffolded but deliberately not wired to a live backend (see below).

- Full Arabic RTL UI (English toggle in Settings), Material-style design
  using the brief's exact palette, self-hosted Cairo font (works offline,
  no Google Fonts request)
- Splash → first-run admin setup → login, with hashed local credentials
  and brute-force lockout
- Companies: add / edit / soft-delete / favorite / search / filter,
  detail screen with invoice timeline grouped by year/month
- Invoices: add via file picker or camera capture, PDF or image preview,
  duplicate-invoice warning, search, filters, attachments, share/download
- Dashboard with live stats, quick actions, alerts (pending sync, low
  storage, etc.)
- Trash / recycle bin with restore and permanent delete
- Settings: dark mode, language, sync status, storage usage, cache
  clearing, JSON backup export/import, change password, logout
- About screen with the clickable management contact numbers
- Installable PWA: manifest, Service Worker, offline app-shell caching,
  offline fallback page, live connection indicator
- IndexedDB schema exactly as specified in brief section 29, with every
  record carrying a honest `sync_status` (Local Only / Pending / Synced
  / Failed / Deleted) — never fakes a sync that didn't happen

## Running it

Any static file server works (the app makes no server-side calls):

```bash
cd awlad-roshdy
python3 -m http.server 8080
# open http://localhost:8080
```

Or `npx serve`, or drop the folder onto Firebase Hosting / Netlify /
any static host later. **Serve over HTTPS (or localhost) in production**
— Service Workers require a secure context.

First run asks you to create the admin account (email + password,
section 7 — "no public registration, admin account only"). That's it;
there's no seed data, no demo login.

## Why cloud sync isn't wired to a live Firebase project

The brief's own suggested development order (section 50) says: build
local-first (steps 1–10), *then* add Firebase (steps 11–14), and "do
not move to the next step until the current step works correctly."
That's what this build does. Wiring real Firebase keys into a
downloadable template would mean either shipping a project I control
(useless to you, and a way for anyone who opens dev tools to write into
*my* database) or shipping fake keys that silently fail. Neither is
actually useful, and neither is safe. Instead:

- `js/sync.js` implements the full sync **queue** (section 27) — every
  create/update/delete is recorded, retried, and status-tracked. It's
  just not uploading anywhere yet.
- `js/firebase-init.js` is the single place that would initialize a
  real Firebase app; right now `isFirebaseConfigured()` always returns
  `false`, so the UI honestly shows "Not connected to the cloud —
  running locally only" instead of pretending to sync.
- `firebase/firestore.rules` and `firebase/storage.rules` implement the
  full owner-based access control from sections 30–33 (a user can only
  ever read/write their own data, file type/size are validated
  server-side too, nothing is public).
- `firebase/firebase-config.example.js` documents exactly what to fill
  in once you have a project.

### Enabling cloud sync (Firebase)

1. Create a Firebase project → enable Authentication (Email/Password),
   Firestore, and Storage.
2. Copy `firebase/firebase-config.example.js` → `firebase/firebase-config.js`
   and fill in your project's web config. **Don't commit real keys to a
   public repo.**
3. Deploy the security rules and test them with the Firebase Emulator
   Suite before pointing at production data:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```
4. This app ships with zero build tooling on purpose. To pull in the
   Firebase modular SDK you'll need a bundler — `npm init`, install
   `firebase`, and add `esbuild` or `Vite`. That's a deliberate, separate
   step (brief section 50, step 11) rather than something to bolt on
   silently.
5. In `js/firebase-init.js`, initialize the app from the config and flip
   `isFirebaseConfigured()` to reflect it. In `js/auth.js`, swap the
   local `login`/`setupAdmin` functions for
   `signInWithEmailAndPassword`/`createUserWithEmailAndPassword`. In
   `js/sync.js`, implement the `TODO` inside `processQueue()` to actually
   write to Firestore/Storage, keeping the same
   queued → syncing → done/failed lifecycle.
6. Update the CSP `connect-src` in `index.html` to include Firebase's
   domains (already listed in a comment right above the policy).

Once that's done, `getLastSyncTime()`, the "Sync now" button, and every
`sync_status` badge in the UI keep working exactly as they do now —
they just start meaning it.

## Security — what's implemented, and what to add before going live

**Implemented in this build:**
- Local admin password is never stored in plain text: PBKDF2-SHA256,
  210,000 iterations, random per-user salt (`js/security.js`). Login is
  rate-limited with exponential backoff after 5 failed attempts.
- Every uploaded file is validated: extension **and** MIME type
  whitelist, 15 MB size cap, and a magic-byte check (the file's actual
  first bytes, not just its claimed type) for JPEG/PNG/PDF/WebP.
  Original filenames are never trusted or used as storage
  keys — a safe name is generated from company + date + invoice number
  (section 20).
- All dynamic UI content is built with `document.createElement`/
  `textContent` (see the `h()` helper in `js/utils.js`), never
  `innerHTML` with user data — the standard way to prevent stored XSS
  from a company name, note, or invoice number.
- Strict Content-Security-Policy (see the comment block above the `<meta>`
  tag in `index.html`): `script-src 'self'` with **no** `unsafe-inline`/
  `unsafe-eval`, `object-src 'none'`, no external origins at all. The one
  relaxation is `style-src 'unsafe-inline'`, needed because the UI toggles
  `element.style` a lot — every such style is a fixed value from this
  app's own code, never built from user input, so it doesn't carry the
  risk inline *script* would.
- Firestore/Storage rules enforce per-user ownership and file
  type/size limits server-side (defense in depth — never trust
  client-side validation alone).
- Soft delete everywhere (Trash, section 35) — nothing is destroyed
  until the user explicitly confirms permanent deletion from Trash.

**Recommended before real users touch this (beyond the brief's own
scope, but worth doing given what this app stores):**
- **Firebase App Check** once Firestore/Storage are live, so only your
  actual app build can call your backend — blocks abuse from scripted
  clients hitting your API directly.
- **Multi-factor auth** (e.g. Firebase's phone/TOTP second factor) for
  the admin account once it moves to Firebase Authentication — this app
  holds financial records for a real business, so a second factor on
  the one account that can read everything is cheap insurance.
- Turn `frame-ancestors` (clickjacking protection) into a real HTTP
  response header at your hosting layer — `<meta>` CSP silently ignores
  it (documented in `index.html`). Example for Firebase Hosting's
  `firebase.json`:
  ```json
  { "hosting": { "headers": [ { "source": "**", "headers": [
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" }
  ] } ] } }
  ```
- Rotate/scope Firebase API keys per environment (dev/staging/prod) and
  keep `firebase/firebase-config.js` out of version control.

## Project structure

```
index.html              app shell (splash, header, nav, CSP)
manifest.webmanifest     PWA manifest
service-worker.js        app-shell caching, offline fallback
offline.html             shown if a navigation truly can't be served
css/styles.css            design tokens, RTL layout, all components
fonts/                    self-hosted Cairo (Arabic + Latin), offline-safe
icons/                    generated app icons (192/512/maskable/apple/favicon)
js/
  app.js                  bootstrap + hash router + shell chrome
  utils.js                DOM builder (h()), formatting, icons, toasts
  security.js              hashing, file validation, safe filenames, lockout
  db.js                    IndexedDB schema + generic CRUD (section 29)
  i18n.js                  Arabic/English dictionary + RTL switching
  auth.js                  local admin auth (swap for Firebase Auth later)
  firebase-init.js         cloud bootstrap stub — see "cloud sync" above
  sync.js                  sync queue (section 27)
  companies.js / invoices.js   domain CRUD
  backup.js                 independent JSON export/import (section 34)
  screens/                  one render function per screen (sections 11-47)
firebase/
  firebase-config.example.js
  firestore.rules            owner-based access control (sections 30, 32)
  storage.rules               path + type + size rules (sections 31, 33)
```

## Known limitations / good next steps

- OCR, the AI assistant, voice notes, and a document scanner are all
  intentionally out of scope for this build (brief section 49 — "do not
  make the first version unnecessarily complicated"). The `ai_status`
  field on every invoice and the `ai_extractions` Firestore collection
  in the rules are already there so OCR can slot in later without a
  schema change.
- HEIC files are accepted by extension/MIME but not magic-byte-verified
  (browser support for parsing HEIC headers client-side is inconsistent).
- Object URLs created for image/PDF previews (`URL.createObjectURL`)
  aren't explicitly revoked on navigation — fine for normal session
  lengths, but a long-running single session with hundreds of previews
  would slowly grow memory. Worth adding a small cleanup-on-route-change
  helper if that becomes a real usage pattern.
- Conflict resolution is "last write wins" as the brief specifies for
  v1 (section 28) — the fields it says to keep for a future proper
  merge UI (`updated_at`, device id) are already being recorded.
