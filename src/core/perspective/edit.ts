// Perspective-system edits whose behaviour §6.4 fixes.
import type { PerspectiveMode, PerspectiveSystem } from './types';
import { clampPerspective, minVerticalDistance } from './validity';

/** How far below the horizon VP-V goes when switching to 3pt, in multiples of the PV-2 minimum. */
const DEFAULT_VERTICAL_FACTOR = 2.5;

/**
 * Moves the horizon: VP-L and VP-R move with it; VP-V keeps its position
 * unless PV-2 forbids it, in which case it is pushed away (§6.4).
 */
export function setHorizon(ps: PerspectiveSystem, horizonY: number): PerspectiveSystem {
  return clampPerspective({ ...ps, horizonY });
}

/** Switches 3pt ⇄ 2pt (§6.4). */
export function setMode(ps: PerspectiveSystem, mode: PerspectiveMode): PerspectiveSystem {
  if (mode === ps.mode) return ps;
  if (mode === '2pt') return clampPerspective({ ...ps, mode, vpVerticalY: null });
  const d = minVerticalDistance(ps) * DEFAULT_VERTICAL_FACTOR;
  return clampPerspective({ ...ps, mode, vpVerticalY: ps.horizonY + d });
}
