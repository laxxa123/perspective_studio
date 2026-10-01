# ADR-0006 — The eye is the stored setting

- **Status:** Accepted (0.10.0, 2026-10-01)
- **Builds on:** ADR-0001 (world model), ADR-0005 (horizon = eye level)
- **Requirements:** PS-12, PS-13, PS-14, §6.1, §7.2, §7.8, OD-15

## Context

Until 0.9.0 the document stored the perspective system (§6.1): horizon,
VP-L, VP-R, VP-V, anchor, eye height. Every stored VP is a finite point on
the paper. The developer asked for a View control that turns and tilts the
eye, down to a straight top view and to face-on views. In those views a VP
is at infinity (a family parallel to the paper; in a top view the horizon
itself), which the stored form cannot hold. The developer also asked to talk
about the eye, as drawing books do, rather than a camera.

Classical perspective assumes one still eye looking at a flat picture plane:
exactly a pinhole camera. The two are the same thing:

| Drawing term | Model |
| :-- | :-- |
| Station point, eye height | `position`, `position.z` |
| Line of sight (head level) | `turn`, `tilt` (roll 0) |
| Centre of vision | `cv` (principal point) |
| Viewing distance | `distance` (focal length) |
| Horizon | derived: the image of the eye-level plane (always eye level) |

## Decision

- Persist the eye (`SceneDocument.eye`, schema 2). The horizon, the centre of
  vision and all VPs are derived, as homogeneous points, so VPs at infinity
  are exact.
- Keep the perspective system as the *VP-handle form*, derived from the eye
  whenever every VP it stores is finite and the origin is in front of the eye
  below the horizon. The Perspective tool, ADR-0005's horizon drag, scale lock
  and pin run on it unchanged; the result is stored back as the eye. Views
  without that form keep their VP handles hidden.
- Migration 001 converts schema 1 files (repairing the PS first, §6.3); the
  picture is unchanged.
- The View orbit keeps the pivot's position in eye space, so the pivot stays
  on its paper spot at the same size; the viewing distance is fixed and the
  eye height follows. It never takes the eye below the floor.
- The UI uses drawing words (Eye, Turn, Tilt, View); code keeps `Camera` for
  the derived projection.

## Consequences

- One stored form covers 1-, 2- and 3-point views and the top view.
- §6.2's formulas, PV-1…PV-5 and PS-T1…T6 still define the VP handles; new
  property tests check PS → eye → camera and the orbit.
- The turn is limited to 0°…90° (face-on L ↔ corner ↔ face-on R): beyond
  either face-on view the X and Y families swap sides of the centre of vision,
  which the VP-handle form (VP-L left of VP-R) cannot express (§16.5).
