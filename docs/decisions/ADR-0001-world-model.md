# ADR-0001 — Objects are 3D world geometry; the screen is a projection

- **Status:** Accepted (M0, 2026-09-30)
- **Requirements:** §4, §5, §6

## Context

Perspective objects (cubes first, more shapes later) must stay exact when the
horizon or a vanishing point moves, keep consistent sizes, stack, and align.
A 2D construction model — corners found by intersecting rays toward the VPs —
matches how perspective is drawn by hand, but gives sizes no stable meaning
when a VP moves, makes stacking and alignment ambiguous, and needs a bespoke
construction for every new shape. (An early prototype, 0.2, used that model;
it was discarded before release.)

## Decision

- Entities that live in space (boxes, rects, later solids) are stored as world
  geometry: right-handed, Z up, units "u".
- The perspective system (horizon, VP-L, VP-R, VP-V, anchor, eye height, mode)
  defines a pinhole camera, derived with the exact formulas of §6.2 and never
  persisted.
- Everything on screen is a projection through that camera, computed only in
  `core/perspective`. Moving a VP changes the camera, never the entities.
- Sketch strokes are picture-plane data (§7.6); they do not re-project.
- Construction (rays to VPs) is a *display* of the projection, not storage.

## Consequences

- Exactness follows from projecting straight 3D edges through one camera; it
  is property-tested (§6.6).
- Adding a shape means defining its 3D vertices (entity-kind registry, §8.4).
- About 200 lines of vector / 3×3 / pinhole math in `core/`; no 3D engine.
- The solver constrains the PS (PV-1…PV-5): some VP placements have no real
  camera and are clamped (§6.3).
