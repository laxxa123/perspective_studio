# ADR-0004 — Dependencies for M3–M6 and the stroke renderer

- **Status:** Accepted (0.8.0, 2026-09-30)
- **Requirements:** §13, NFR-M-04, §9 (stroke rendering), SK-02, M6 spike

## Context

The developer asked for M3–M6 in one delivery. Each needs dependencies that §13
already names; NFR-M-04 requires an ADR before adding runtime dependencies.
§13 lists perfect-freehand as a *candidate* for M6, to be adopted only after a
spike.

## Decision

| Package | Milestone | Use |
| :-- | :-- | :-- |
| `immer` 11 | M3 | Commands with `produceWithPatches`; undo / redo by patches (§8.5). Used in `core/commands` (pure, no DOM). |
| `zod` 4 | M4 | Validation of loaded / imported documents after migration (§7.8). |
| `idb` 8 | M4 | IndexedDB stores `documents` and `thumbnails` (§7.9), in `platform/storage.ts`. |
| `@capacitor/app` 8 | M4 | Save on app pause (NFR-R-01); Android back button. |
| `@capacitor/filesystem` 8, `@capacitor/share` 8 | M4 | Export / share files; backup to the Documents folder (DOC-03, DOC-05). |
| `perfect-freehand` 1.2 | M6 | Stroke outlines (§9). |

**Stroke renderer spike (M6).** Evidence: ADR-0002 — on the developer's phone
finger input arrives within one frame but with constant pressure (1.0) and no
extra coalesced samples; no stylus was available. perfect-freehand turns a
point list into a variable-width outline polygon in pure TypeScript (no DOM),
takes real pressure when present and can *simulate* it from speed when
pressure is constant, which gives finger strokes a natural taper. The outline
is a plain polygon, so the same data renders in Konva and in the SVG export.
Adopted: pressure is used when it varies (stylus), simulated when it is
constant.

## Consequences

- `core/entities/stroke` depends on perfect-freehand (allowed in core: no
  DOM / React / Konva).
- Stroke width is stored in pp (§7.6); the UI's width setting is in screen px
  and converted when a stroke starts, so a stroke looks the width chosen.
- NFR-P-02 (5,000 strokes smooth) is not yet verified on the device; if it
  fails, cache the sketch layer as a bitmap (§9 "strokes pre-rendered").
