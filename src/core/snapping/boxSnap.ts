// Object snapping for boxes: stacking on top faces (BX-06) and flush
// alignment with neighbours (§10.6).
import { add3, sub3, type Vec2, type Vec3 } from '../math/vec';
import { unproject } from '../perspective/camera';
import type { Camera } from '../perspective/types';
import type { BoxEntity, Entity } from '../document/types';

/** How close (u) a face must come to another to snap flush / to rest on it. */
export const FLUSH_TOLERANCE = 0.12;
const REST_EPS = 1e-6;

const boxesOf = (entities: Entity[]): BoxEntity[] =>
  entities.filter((e): e is BoxEntity => e.kind === 'box' && !('unknown' in e));

const topOf = (b: BoxEntity) => b.position.z + b.size.z;

/**
 * Where a tap / drag at picture point q lands: the highest box top face under
 * it, else the ground (when q is below the horizon). Null above the horizon
 * with nothing under it (BX-02).
 */
export function surfaceAt(
  entities: Entity[],
  cam: Camera,
  q: Vec2,
  excludeId?: string,
): { point: Vec3; supportId: string | null } | null {
  let best: { point: Vec3; supportId: string | null } | null = null;
  for (const b of boxesOf(entities)) {
    if (b.id === excludeId) continue;
    const P = unproject(cam, q, topOf(b));
    if (!P) continue;
    const inside =
      P.x >= b.position.x && P.x <= b.position.x + b.size.x && P.y >= b.position.y && P.y <= b.position.y + b.size.y;
    if (inside && (!best || P.z > best.point.z)) best = { point: P, supportId: b.id };
  }
  if (best) return best;
  const G = unproject(cam, q, 0);
  return G ? { point: G, supportId: null } : null;
}

/** Does the box rest on the ground or on another box's top face? */
export function isResting(b: BoxEntity, others: Entity[]): boolean {
  if (Math.abs(b.position.z) < REST_EPS) return true;
  return boxesOf(others).some((o) => o.id !== b.id && Math.abs(topOf(o) - b.position.z) < REST_EPS);
}

function flushAxis(b: BoxEntity, others: BoxEntity[], axis: 'x' | 'y'): number {
  const lo = b.position[axis];
  const hi = lo + b.size[axis];
  const other = axis === 'x' ? 'y' : 'x';
  let best = 0;
  let bestAbs = FLUSH_TOLERANCE;
  for (const o of others) {
    // Only neighbours overlapping in the other horizontal direction and in height.
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
 * The position a moved box snaps to: onto the top face under the pointer (or
 * the ground) when it rests on something, keeping its offset from the pointer;
 * then flush with a neighbour's face when within FLUSH_TOLERANCE.
 */
export function boxSnapTarget(moved: BoxEntity, entities: Entity[], cam: Camera, pointer: Vec2): Vec3 {
  const others = boxesOf(entities).filter((o) => o.id !== moved.id);
  let position = moved.position;
  if (isResting(moved, others)) {
    const surface = surfaceAt(others, cam, pointer);
    const onPlane = unproject(cam, pointer, moved.position.z);
    if (surface && onPlane && Math.abs(surface.point.z - moved.position.z) > REST_EPS) {
      const offset = sub3(moved.position, onPlane);
      const P = unproject(cam, pointer, surface.point.z);
      if (P) position = { ...add3(P, offset), z: surface.point.z };
    }
  }
  const at = { ...moved, position };
  const dx = flushAxis(at, others, 'x');
  const dy = flushAxis(at, others, 'y');
  return { x: position.x + dx, y: position.y + dy, z: position.z };
}
