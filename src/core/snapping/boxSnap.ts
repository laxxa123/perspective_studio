// Placement and object snapping: surfaces facing the eye (BX-02 revised),
// resting and hanging (BX-06, BX-08), the working plane (PL-01), and flush
// alignment with neighbours (§10.6).
import { add3, scale3, sub3, type Vec2, type Vec3 } from '../math/vec';
import { pictureRay, unproject } from '../perspective/camera';
import type { Camera } from '../perspective/types';
import type { BoxEntity, Entity, RectEntity } from '../document/types';

/** How close (u) a face must come to another to snap flush / to rest on it. */
export const FLUSH_TOLERANCE = 0.12;
/** A working plane must stay this far (u) from the eye (it is edge-on at eye level). */
export const WORKING_PLANE_MIN_GAP = 0.05;
const TOUCH_EPS = 1e-6;

export interface Placement {
  point: Vec3;
  /** rest: the new object stands on it; hang: it hangs below it. */
  mode: 'rest' | 'hang';
  supportId: string | null;
}

interface Surface {
  id: string;
  z: number;
  /** up: seen from above (tops); down: seen from below (undersides). */
  facing: 'up' | 'down';
  contains: (x: number, y: number) => boolean;
}

const boxesOf = (entities: Entity[]): BoxEntity[] =>
  entities.filter((e): e is BoxEntity => e.kind === 'box' && !('unknown' in e));
const groundRectsOf = (entities: Entity[]): RectEntity[] =>
  entities.filter((e): e is RectEntity => e.kind === 'rect' && !('unknown' in e) && (e as RectEntity).plane === 'ground');

const topOf = (b: BoxEntity) => b.position.z + b.size.z;
const footprint = (x0: number, y0: number, w: number, d: number) => (x: number, y: number) =>
  x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + d;

function surfaces(entities: Entity[], excludeId?: string): Surface[] {
  const out: Surface[] = [];
  for (const b of boxesOf(entities)) {
    if (b.id === excludeId || !b.visible) continue;
    const inside = footprint(b.position.x, b.position.y, b.size.x, b.size.y);
    out.push({ id: b.id, z: topOf(b), facing: 'up', contains: inside });
    out.push({ id: b.id, z: b.position.z, facing: 'down', contains: inside });
  }
  for (const r of groundRectsOf(entities)) {
    if (r.id === excludeId || !r.visible) continue;
    const inside = footprint(r.position.x, r.position.y, r.size.x, r.size.y);
    out.push({ id: r.id, z: r.position.z, facing: 'up', contains: inside });
    out.push({ id: r.id, z: r.position.z, facing: 'down', contains: inside });
  }
  return out;
}

/**
 * Where a tap at picture point q places an object (BX-02 revised): the first
 * horizontal surface along the viewing ray that faces the eye — tops below
 * eye level (rest on them), undersides above it (hang from them) — else the
 * ground, else the working plane, else null. Faces the eye cannot see are
 * never targets.
 */
export function placementAt(
  entities: Entity[],
  cam: Camera,
  q: Vec2,
  opts: { excludeId?: string; workingPlane?: number | null } = {},
): Placement | null {
  const { origin: C, dir } = pictureRay(cam, q);
  const hit = (z: number) => {
    if (Math.abs(dir.z) < 1e-12) return null;
    const t = (z - C.z) / dir.z;
    return t > 0 ? { t, P: add3(C, scale3(dir, t)) } : null;
  };
  let best: (Placement & { t: number }) | null = null;
  for (const s of surfaces(entities, opts.excludeId)) {
    // Facing the eye: tops below the eye, undersides above it.
    if (s.facing === 'up' ? !(s.z < C.z) : !(s.z > C.z)) continue;
    const h = hit(s.z);
    if (!h || !s.contains(h.P.x, h.P.y)) continue;
    if (!best || h.t < best.t) best = { point: h.P, mode: s.facing === 'up' ? 'rest' : 'hang', supportId: s.id, t: h.t };
  }
  const ground = hit(0);
  if (ground && (!best || ground.t < best.t)) best = { point: ground.P, mode: 'rest', supportId: null, t: ground.t };
  if (best) return { point: best.point, mode: best.mode, supportId: best.supportId };
  const wp = opts.workingPlane;
  if (wp !== null && wp !== undefined && Math.abs(wp - C.z) >= WORKING_PLANE_MIN_GAP) {
    const h = hit(wp);
    if (h) return { point: h.P, mode: wp < C.z ? 'rest' : 'hang', supportId: null };
  }
  return null;
}

const near = (a: number, b: number) => Math.abs(a - b) < TOUCH_EPS;

/** Does the box rest on the ground, a box top or a ground rect? */
export function isResting(b: BoxEntity, others: Entity[]): boolean {
  if (near(b.position.z, 0)) return true;
  return (
    boxesOf(others).some((o) => o.id !== b.id && near(topOf(o), b.position.z)) ||
    groundRectsOf(others).some((r) => near(r.position.z, b.position.z))
  );
}

/** Does the box hang from a box underside or a ground-plane rect (ceiling)? (BX-08) */
export function isHanging(b: BoxEntity, others: Entity[]): boolean {
  const top = topOf(b);
  return (
    boxesOf(others).some((o) => o.id !== b.id && near(o.position.z, top)) ||
    groundRectsOf(others).some((r) => near(r.position.z, top))
  );
}

function flushAxis(b: BoxEntity, others: BoxEntity[], axis: 'x' | 'y'): number {
  const lo = b.position[axis];
  const hi = lo + b.size[axis];
  const other = axis === 'x' ? 'y' : 'x';
  let best = 0;
  let bestAbs = FLUSH_TOLERANCE;
  for (const o of others) {
    const oLo = o.position[other];
    const oHi = oLo + o.size[other];
    if (b.position[other] > oHi + FLUSH_TOLERANCE || b.position[other] + b.size[other] < oLo - FLUSH_TOLERANCE) continue;
    if (b.position.z > topOf(o) || topOf(b) < o.position.z) continue;
    const a0 = o.position[axis];
    const a1 = a0 + o.size[axis];
    for (const d of [a0 - hi, a1 - lo, a0 - lo, a1 - hi]) {
      if (Math.abs(d) < bestAbs) {
        bestAbs = Math.abs(d);
        best = d;
      }
    }
  }
  return best;
}

/**
 * Where a moved box snaps to: a resting box re-seats onto the top face under
 * the pointer (or the ground); a hanging box re-attaches under the underside
 * under the pointer (BX-06, BX-08), keeping its offset from the pointer; then
 * it snaps flush with a neighbour within FLUSH_TOLERANCE.
 */
export function boxSnapTarget(moved: BoxEntity, entities: Entity[], cam: Camera, pointer: Vec2): Vec3 {
  const others = entities.filter((o) => o.id !== moved.id);
  let position = moved.position;
  const resting = isResting(moved, others);
  const hanging = !resting && isHanging(moved, others);
  if (resting || hanging) {
    const place = placementAt(others, cam, pointer);
    const onPlane = unproject(cam, pointer, moved.position.z);
    if (place && onPlane && place.mode === (resting ? 'rest' : 'hang')) {
      const z = resting ? place.point.z : place.point.z - moved.size.z;
      if (!near(z, moved.position.z)) {
        const offset = sub3(moved.position, onPlane);
        const P = unproject(cam, pointer, z);
        if (P) position = { ...add3(P, offset), z };
      }
    }
  }
  const boxes = boxesOf(others);
  const at = { ...moved, position };
  return { x: position.x + flushAxis(at, boxes, 'x'), y: position.y + flushAxis(at, boxes, 'y'), z: position.z };
}
