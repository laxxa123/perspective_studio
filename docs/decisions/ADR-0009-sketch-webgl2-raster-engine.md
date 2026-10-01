# ADR-0009 — SKETCH: a custom WebGL2 tiled raster engine inside the React app

- **Status:** Accepted (0.14.0, 2026-10-01)
- **Requirements:** `docs/modules/sketch/REQUIREMENTS.md` (§3, §7, §17, §25, §26, §30)
- **Supersedes:** the Flutter + Impeller stack first floated for SKETCH

## Context

SKETCH is a freehand painting module whose first priorities are stroke
quality, low latency and smooth zoom (§2). A Flutter + Impeller engine was
discussed, but a Flutter module cannot live inside CREATIVE (Capacitor +
React). The SKETCH specification fixes the stack: React for the UI, a custom
WebGL2 raster engine with tiled GPU textures for the artwork, Pointer Events,
IndexedDB; no Konva or Canvas 2D for painting.

## Decision

- SKETCH lives in `src/modules/sketch/`, lazy-loaded from its home tile like
  CUBE, and shares only `src/platform/` and the design tokens.
- Three layers, lint-enforced: `core/` (pure: document, presets, stroke
  sampling, geometry, history — unit-tested), `engine/` + `input/` (WebGL2
  and Pointer Events, no React), and the React UI (`ui/`, `state/`,
  `storage/`). The engine owns the pixels; React mirrors only the document
  metadata and history flags.
- Rendering: premultiplied RGBA8 tiles (256 px) per layer, allocated on first
  paint and pooled; instanced dab quads; a per-stroke coverage buffer;
  per-tile compositing into a document-size composite (fixed-function blending
  for Normal / Screen / Erase, a backdrop-reading shader for Multiply /
  Overlay); the screen pass draws the composite with the view transform.
  Frames are rendered on demand.
- Undo: GPU tile snapshots under a 96 MB budget plus document states for
  layer commands.
- Storage: IndexedDB through `idb` (already a dependency); tiles compressed
  with the platform's `CompressionStream('deflate-raw')`.
- **No new runtime or dev dependency.**

## Consequences

- Same APK, app id and signing key; PERSPECTIVE and CUBE are unaffected
  (SKETCH is its own chunk, ~100 kB).
- Needs WebGL 2 (every current Android WebView has it); without it SKETCH
  shows a message instead of the canvas.
- GPU context loss is recoverable from the last autosave.
- The pure core is tested in Node; the GPU parts are checked in a browser
  (SwiftShader) and on the device checklist.
