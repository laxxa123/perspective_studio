# ADR-0010 — PUBLISH: WP Studio rebuilt as a CREATIVE module, sharing SKETCH's brush engine

- **Status:** Accepted (0.16.0, 2026-10-01)
- **Requirements:** `docs/modules/publish/REQUIREMENTS.md`, CREATIVE.md CR-OD-4

## Context

WP Studio is a separate Flutter app (with the `studioview` WordPress theme).
The developer chose to rebuild it fully as the PUBLISH module of CREATIVE
(React / TypeScript / Capacitor) rather than embed Flutter or launch the
other app, and asked that its painting be "the same as SKETCH". CREATIVE's
rule is that modules never import each other.

## Decision

- PUBLISH lives in `src/modules/publish/`, lazy-loaded from its home tile.
- **Shared engine:** PUBLISH may import SKETCH's UI-free parts —
  `sketch/core` (pure) and `sketch/engine` + `sketch/input` (WebGL2 and
  Pointer Events, no React) — and nothing else of SKETCH. Lint enforces it
  (`publish` → `sketch-engine`, `sketch-core`; `publish-core` →
  `sketch-core`). SKETCH's engine therefore stays UI-free and keeps a stable
  API (`RasterEngine`, `PointerInput`, `StoredTile`).
- The tile editor uses Konva (already a dependency) for hit testing and
  handles; all drawing goes through one Canvas 2D renderer shared with
  thumbnails and publishing.
- **New runtime dependencies (fonts only):** `@fontsource-variable/roboto`
  and `@fontsource/ms-madi` — the two fonts of the WP Studio protocol,
  bundled (OFL licence) so text works offline and matches WordPress, where
  the theme serves the same families.
- WP Studio's local data and canvas are not migrated; its theme and its
  manifest v3 posts stay as they are.

## Consequences

- One app, one look; PUBLISH's paint gets SKETCH's brushes for free and
  improves with them.
- A change to SKETCH's engine API must keep PUBLISH working (both modules'
  tests and checks run on every build).
- The fonts add about 300 kB to the APK (12 WOFF2 subset files; a device downloads only the subsets its text uses).
- WordPress access (PUBLISH / WP / SETTINGS tabs) will need a native plugin
  for encrypted credentials: a separate ADR when those tabs are built.
