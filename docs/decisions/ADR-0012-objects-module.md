# ADR-0012 — OBJECTS: an in-app module, blocks first, figures from a pure SVG renderer

- **Status:** Accepted (0.23.0, 2026-10-03)
- **Requirements:** `docs/modules/objects/REQUIREMENTS.md` (v1.2, Part A), CREATIVE.md CR-OD-5

## Context

OBJECTS authors visualisation and spatial-reasoning questions (2D and 3D
transformations, spatial relationships). Its v1.0 specification described a
general 3D construction tool (primitives, booleans, extrusion). The design
review (v1.1) chose blocks first, 2D figures in the same module and
isometric line drawings for every question figure, so that correctness and
option sameness are exact.

## Decision

- OBJECTS lives in `src/modules/objects/`, lazy-loaded from its home tile,
  on the existing stack. It imports no other module (lint: `objects` →
  `objects`, `objects-core`, `platform`).
- `core/` is pure TypeScript (no React, Three.js, Konva or storage; lint
  forbids `three` and `@capacitor-community/*` there). It owns the block
  model and the **isometric SVG renderer**: question figures, previews,
  exports and thumbnails all come from it, so they are identical and
  reproducible.
- **Three.js** (already a dependency, used by CUBE) draws only the
  interactive authoring viewport (`render/BlockScene.ts`); it holds no
  state.
- **No new runtime dependency** for Phase 1a. Questions and drafts are
  stored through repositories in SQLite (`objects` database,
  @capacitor-community/sqlite) on Android and IndexedDB (`idb`) in a
  browser, as CUBE does (0.24.0); M0's localStorage draft is read once.
- Phase 1c (add / subtract / intersect, extrusion) will need a geometry
  library; it gets its own ADR after its own device spike.

## Consequences

- Questions on blocks and grid figures can be checked exactly (symmetry
  groups, canonical forms) without a mesh library.
- The figure style is fixed by one renderer; changing it changes every
  figure consistently.
