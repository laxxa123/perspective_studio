# ADR-0005 — The horizon is the eye level: dragging it changes eye height

- **Status:** Proposed (v1.5, 2026-09-30) — accepted when M8 implements it
- **Supersedes:** the horizon bullet of §6.4
- **Requirements:** PS-07 (revised), PS-08, OD-3

## Context

§6.4 kept the eye height (u) and the anchor fixed while the horizon moved,
and kept VP-V in place. Under §6.2 the distance to the world origin is then
set by how far the anchor sits below the horizon on paper. On the device,
dragging the horizon up made a box balloon and dragging it down shrank it into
the anchor: the horizon acted as a camera-distance control. In perspective
drawing the horizon *is* the eye level: moving it relative to an object means
looking from higher or lower, not walking toward it. A tall box showed it most
clearly — the horizon could never slide along it.

## Decision

- A horizon drag is a vertical move of the eye. VP-L, VP-R and (3pt) VP-V
  translate by the same Δy, so the camera's rotation `M` and focal length `f`
  are unchanged and only the principal point shifts (a view-camera rise/fall).
- The anchor stays pinned; the camera keeps its horizontal distance to the
  world origin; `eyeHeight` is re-derived from the new anchor ray (§6.2 run
  backwards). Lowering the horizon to the anchor lowers the eye to the floor,
  clamped by PV-4 / PV-5.
- Editing eye height numerically (PS-07) is the same operation in reverse: it
  moves the horizon.
- Camera distance changes only through the anchor (drag toward / away from the
  horizon).
- OD-3: default eye height 1.6 u; default cube size reached through the anchor.

## Consequences

- PV-2 cannot be violated by a horizon drag (horizon–VP-V distance unchanged).
- Invariants PS-T1…T6 are unaffected (the solver is unchanged; only the
  drag's parameter update changes). New tests: a horizon drag keeps `M`, `f`
  and the camera's horizontal distance to the origin; the eye-level plane
  projects onto the new horizon.
- Documents keep their stored values; only interaction changes (no schema
  change).
