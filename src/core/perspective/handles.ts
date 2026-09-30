// Perspective-tool handles and dragging with clamping (PS-03, §10.5).
import type { Vec2 } from '../math/vec';
import type { Family, PerspectiveSystem } from './types';
import { moveHorizon } from './eye';
import { isValid, minVerticalDistance } from './validity';

export type PerspectiveHandleId = 'vpL' | 'vpR' | 'vpV' | 'cv' | 'anchor' | 'horizon';

export interface PerspectiveHandle {
  id: PerspectiveHandleId;
  family?: Family;
  label: string;
  point: Vec2;
}

/** The point handles (horizon excluded: it is a line). VP-V only in 3pt. */
export function pointHandles(ps: PerspectiveSystem): PerspectiveHandle[] {
  const out: PerspectiveHandle[] = [
    { id: 'vpL', family: 'L', label: 'VP-L', point: { x: ps.vpLeftX, y: ps.horizonY } },
    { id: 'vpR', family: 'R', label: 'VP-R', point: { x: ps.vpRightX, y: ps.horizonY } },
  ];
  if (ps.mode === '3pt' && ps.vpVerticalY !== null) {
    out.push({ id: 'vpV', family: 'V', label: 'VP-V', point: { x: ps.verticalX, y: ps.vpVerticalY } });
  } else {
    // PS-11: in 2pt the centre of vision (principal point x) slides along the horizon.
    out.push({ id: 'cv', label: 'Centre', point: { x: ps.verticalX, y: ps.horizonY } });
  }
  // UI-09: the anchor's label on screen.
  out.push({ id: 'anchor', label: 'Ground point', point: ps.anchor });
  return out;
}

/** The system with handle `id` moved to `p` (before validation). */
function withHandleAt(ps: PerspectiveSystem, id: PerspectiveHandleId, p: Vec2): PerspectiveSystem {
  switch (id) {
    case 'vpL':
      return { ...ps, vpLeftX: p.x };
    case 'vpR':
      return { ...ps, vpRightX: p.x };
    case 'vpV':
      return { ...ps, verticalX: p.x, vpVerticalY: p.y };
    case 'anchor':
      return { ...ps, anchor: p };
    case 'cv':
      return { ...ps, verticalX: p.x };
    case 'horizon':
      // PS-08: the horizon is the eye level (ADR-0005).
      return moveHorizon(ps, p.y);
  }
}

function handlePoint(ps: PerspectiveSystem, id: PerspectiveHandleId, target: Vec2): Vec2 {
  switch (id) {
    case 'vpL':
      return { x: ps.vpLeftX, y: ps.horizonY };
    case 'vpR':
      return { x: ps.vpRightX, y: ps.horizonY };
    case 'vpV':
      return { x: ps.verticalX, y: ps.vpVerticalY ?? ps.horizonY };
    case 'cv':
      return { x: ps.verticalX, y: ps.horizonY };
    case 'anchor':
      return ps.anchor;
    case 'horizon':
      return { x: target.x, y: ps.horizonY };
  }
}

const BISECTION_STEPS = 48;

/**
 * Drags a handle toward `target`. When the target is invalid the handle stops
 * at the edge of the valid region along the drag (§10.5: clamps to its edge);
 * a valid target is taken as is, so the handle can jump across a forbidden
 * band once the pointer is past it. `ps` must be valid.
 */
export function dragHandle(
  ps: PerspectiveSystem,
  id: PerspectiveHandleId,
  target: Vec2,
): { ps: PerspectiveSystem; clamped: boolean } {
  if (!isValid(ps)) throw new Error('dragHandle: start from a valid system');
  const at = (t: number) => {
    const from = handlePoint(ps, id, target);
    return withHandleAt(ps, id, { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t });
  };
  const full = at(1);
  if (isValid(full)) return { ps: full, clamped: false };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (isValid(at(mid))) lo = mid;
    else hi = mid;
  }
  return { ps: lo === 0 ? ps : at(lo), clamped: true };
}

/** The PV-2 band around the horizon where VP-V may not go (3pt only), pp. */
export function forbiddenBand(ps: PerspectiveSystem): { top: number; bottom: number } | null {
  if (ps.mode !== '3pt') return null;
  const d = minVerticalDistance(ps);
  return { top: ps.horizonY - d, bottom: ps.horizonY + d };
}
