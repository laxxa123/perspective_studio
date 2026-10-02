# ADR-0011 — PUBLISH: WordPress credentials in the Android Keystore; plain REST over fetch

- **Status:** Accepted (0.17.0, 2026-10-02)
- **Requirements:** `docs/modules/publish/REQUIREMENTS.md` §10, §12

## Context

PUBLISH now posts to the developer's WordPress site. That needs the site
address, a user name and a WordPress **Application Password** stored on the
phone, and a way to talk to the WordPress REST API from the app's web view.
ADR-0010 deferred both to this record.

## Decision

- **New runtime dependency:** `@aparajita/capacitor-secure-storage` (8.x,
  MIT, Capacitor 8). The Application Password is stored through it, encrypted
  with a key held by the Android Keystore; in a browser (development only)
  the plugin falls back to `localStorage`. CREATIVE wraps it in
  `src/platform/secrets.ts` so modules never import the plugin directly.
- The site address and user name are not secret; they live in PUBLISH's
  IndexedDB `kv` store with the rest of its state.
- **Transport:** plain `fetch` with Basic auth (`user:application-password`).
  WordPress core answers REST requests with CORS headers that echo the
  app's origin and allow `Authorization` and `Content-Disposition`, so no
  native HTTP plugin is needed. Uploaded files themselves have no CORS
  headers; pulling a picture back goes through a small route the studioview
  theme adds (`creative/v1/file/<id>`, base64 JSON, `upload_files` users
  only).
- Nothing is cleared on the phone until WordPress has confirmed a post.

## Consequences

- The password never appears in IndexedDB, backups, exports or logs.
- `android:allowBackup` stays on (it covers tiles and media). A restored
  backup cannot decrypt the Keystore-encrypted password on a new phone; it
  then reads as unset and Settings asks for it again.
- A host or security plugin that strips the `Authorization` header (some
  Apache CGI set-ups) makes sign-in fail with "refused"; WordPress's own
  Application Password checks have the same requirement, and the message
  says so.
- The `studioview` theme becomes a requirement for PUBLISH posts (it
  registers `_creative_post`, renders it and serves files back). Without it,
  publishing stops before anything is uploaded, with "update the studioview
  theme".
