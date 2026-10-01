// Perspective snapping for strokes (SK-04).
import type { HPoint } from '../math/homogeneous';
import type { Vec2 } from '../math/vec';
import { vanishingPoint } from '../perspective/camera';
import type { Camera, Family } from '../perspective/types';

/** Soft-snap threshold (OD-7). */
export const SOFT_SNAP_DEGREES = 6;
/** Screen distance before a locked stroke picks its family, px. */
export const LOCK_AFTER_PX = 12;

/** The family's VP as a homogeneous point (at infinity: a direction, e.g. vertical in 2pt). */
export const familyVp = (cam: Camera, f: Family): HPoint => vanishingPoint(cam, f);

/** All three families snap; a family whose VP is at infinity snaps to parallels. */
const FAMILIES: Family[] = ['L', 'R', 'V'];

/** Unit direction of the guide line from `start` toward the family's VP. */
export function guideDirection(cam: Camera, f: Family, start: Vec2): Vec2 | null {
  const vp = familyVp(cam, f);
  const dx = vp.w ? vp.x / vp.w - start.x : vp.x;
  const dy = vp.w ? vp.y / vp.w - start.y : vp.y;
  const l = Math.hypot(dx, dy);
  return l < 1e-9 ? null : { x: dx / l, y: dy / l };
}

/** Angle in degrees between the line through start–p and the family's guide line (0–90). */
export function angleToGuide(cam: Camera, f: Family, start: Vec2, dir: Vec2): number {
  const g = guideDirection(cam, f, start);
  const l = Math.hypot(dir.x, dir.y);
  if (!g || l < 1e-9) return 90;
  const c = Math.abs((g.x * dir.x + g.y * dir.y) / l);
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

/** The family whose guide through `start` best matches direction `dir`. */
export function nearestFamily(cam: Camera, start: Vec2, dir: Vec2): Family {
  let best: Family = 'L';
  let bestA = Infinity;
  for (const f of FAMILIES) {
    const a = angleToGuide(cam, f, start, dir);
    if (a < bestA) {
      bestA = a;
      best = f;
    }
  }
  return best;
}

/** Projection of p onto the guide line from `start` of family f. */
export function onGuide(cam: Camera, f: Family, start: Vec2, p: Vec2): Vec2 {
  const g = guideDirection(cam, f, start);
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
export function softSnap(cam: Camera, pts: Vec2[]): { family: Family; points: Vec2[] } | null {
  const dir = bestFitDirection(pts);
  if (!dir) return null;
  const start = pts[0];
  const f = nearestFamily(cam, start, dir);
  if (angleToGuide(cam, f, start, dir) > SOFT_SNAP_DEGREES) return null;
  return { family: f, points: pts.map((p) => onGuide(cam, f, start, p)) };
}
