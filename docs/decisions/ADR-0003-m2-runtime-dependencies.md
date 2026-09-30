# ADR-0003 — Runtime dependencies added in M2

- **Status:** Accepted (M2, 2026-09-30)
- **Requirements:** §13, NFR-M-04

## Context

NFR-M-04: no new runtime dependency without an ADR. M2 (canvas & perspective
setup) is the first milestone with editor UI and state.

## Decision

Add, at the versions pinned in `package-lock.json`, only what M2 uses — all
named in §13:

| Package | Why (M2) |
| :-- | :-- |
| `zustand` 5 | `documentStore` (perspective, paper) and `uiStore` (viewport, tool, lock, drag feedback), §7.1. |
| `lucide-react` 1 | The single outline icon set (§10.9) for toolbar and top-bar buttons. |
| `@capacitor/haptics` 8 | Light tick when a perspective drag starts clamping (§10.5, §10.9), behind `platform/haptics.ts`. |

Not yet added (their milestones will): Immer (commands / history, M3–M4),
Zod and idb (documents, M4), `@capacitor/app`, Filesystem, Share (M4),
perfect-freehand (M6, after its spike).

## Consequences

- `core/` stays free of all three (lint-enforced, §8.2).
- Haptics degrade to a no-op where vibration is unavailable (desktop browser).
