// Perspective snapping for strokes (SK-04).
import { finite, type HPoint } from '../math/homogeneous';
import type { Vec2 } from '../math/vec';
import type { Family, PerspectiveSystem } from '../perspective/types';

/** Soft-snap threshold (OD-7). */
export const SOFT_SNAP_DEGREES = 6;
/** Screen distance before a locked stroke picks its family, px. */
export const LOCK_AFTER_PX = 12;

/** The stored VPs as homogeneous points (VP-V at infinity in 2pt → vertical). */
export function familyVp(ps: PerspectiveSystem, f: Family): HPoint {
  if (f === 'L') return finite({ x: ps.vpLeftX, y: ps.horizonY });
  if (f === 'R') return finite({ x: ps.vpRightX, y: ps.horizonY });
  return ps.mode === '3pt' && ps.vpVerticalY !== null ? finite({ x: ps.verticalX, y: ps.vpVerticalY }) : { x: 0, y: 1, w: 0 };
}

/** All three families snap; in 2pt family V is vertical. */
export const families = (_ps: PerspectiveSystem): Family[] => ['L', 'R', 'V'];

/** Unit direction of the guide line from `start` toward the family's VP. */
export function guideDirection(ps: PerspectiveSystem, f: Family, start: Vec2): Vec2 | null {
  const vp = familyVp(ps, f);
  const dx = vp.w ? vp.x / vp.w - start.x : vp.x;
  const dy = vp.w ? vp.y / vp.w - start.y : vp.y;
  const l = Math.hypot(dx, dy);
  return l < 1e-9 ? null : { x: dx / l, y: dy / l };
}

/** Angle in degrees between the line through start–p and the family's guide line (0–90). */
export function angleToGuide(ps: PerspectiveSystem, f: Family, start: Vec2, dir: Vec2): number {
  const g = guideDirection(ps, f, start);
  const l = Math.hypot(dir.x, dir.y);
  if (!g || l < 1e-9) return 90;
  const c = Math.abs((g.x * dir.x + g.y * dir.y) / l);
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

/** The family whose guide through `start` best matches direction `dir`. */
export function nearestFamily(ps: PerspectiveSystem, start: Vec2, dir: Vec2): Family {
  let best: Family = 'L';
  let bestA = Infinity;
  for (const f of families(ps)) {
    const a = angleToGuide(ps, f, start, dir);
    if (a < bestA) {
      bestA = a;
      best = f;
    }
  }
  return best;
}

/** Projection of p onto the guide line from `start` of family f. */
export function onGuide(ps: PerspectiveSystem, f: Family, start: Vec2, p: Vec2): Vec2 {
  const g = guideDirection(ps, f, start);
  if (!g) return p;
  const t = (p.x - start.x) * g.x + (p.y - start.y) * g.y;
  return { x: start.x + g.x * t, y: start.y + g.y * t };
}

/** Principal direction of a point set (best-fit line, total least squares). */
export function bestFitDirection(pts: Vec2[]): Vec2 | null {
  if (pts.length < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx + syy < 1e-12) return null;
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { x: Math.cos(theta), y: Math.sin(theta) };
}

/**
 * Soft snap (SK-04): if the stroke's best-fit line is within 6° of a family's
 * guide through its start point, every point is projected onto that guide.
 */
export function softSnap(ps: PerspectiveSystem, pts: Vec2[]): { family: Family; points: Vec2[] } | null {
  const dir = bestFitDirection(pts);
  if (!dir) return null;
  const start = pts[0];
  const f = nearestFamily(ps, start, dir);
  if (angleToGuide(ps, f, start, dir) > SOFT_SNAP_DEGREES) return null;
  return { family: f, points: pts.map((p) => onGuide(ps, f, start, p)) };
}
