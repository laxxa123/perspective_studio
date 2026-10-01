# ADR-0008 — CUBE: an in-app module on the web stack, with Three.js and SQLite

- **Status:** Accepted (0.13.0, 2026-10-01)
- **Requirements:** `docs/modules/cube/REQUIREMENTS.md` (Phase 1), CREATIVE.md CR-OD-1 / CR-OD-2
- **Supersedes:** the React Native · Skia · Filament stack first proposed for CUBE

## Context

CUBE was first proposed on React Native, Skia, Filament and SQLite. CREATIVE
is a Capacitor + React web app; a React Native module could not live inside
it. The developer chose one app with independent modules, and the CUBE
specification (§3, §5) fixes the stack: React, TypeScript, Konva, Three.js /
WebGL, SQLite via `@capacitor-community/sqlite`; no React Native, Skia or
Filament.

## Decision

- CUBE lives in `src/modules/cube/`, opened from its home tile, loaded as a
  separate chunk. It shares only the platform layer (files, lifecycle) and the
  design tokens with the app; it never imports PERSPECTIVE (lint-enforced).
- New runtime dependencies:
  - `three` — the live 3D cube (WebGL), CUBE only.
  - `@capacitor-community/sqlite` — CUBE's database on Android (SQLCipher is
    pulled in by the plugin; the app packaging excludes its duplicate
    `build-data.properties`).
  - `@types/three` (dev).
- In a browser (development) the native plugin is unavailable, so the same
  tables are kept in IndexedDB (`idb`, already a dependency) behind one
  interface; both backends pass the same tests.
- The CubeModel is the only truth; question figures, textures and exports are
  rendered from it by one pure SVG renderer.

## Consequences

- One APK, same app id and signing key; installed copies update as before.
- The APK grows by the SQLite plugin and SQLCipher; PERSPECTIVE's start-up is
  unaffected (CUBE is lazy-loaded).
- Phase 2 / 3 add their tables by migrating `cube` (schema version in
  `cube_meta`).
