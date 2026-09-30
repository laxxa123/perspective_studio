// Helpers shared by world-space entity kinds.
import { add3, scale3, type Vec3 } from '../math/vec';
import { closestOnAxis, projectSegment, project } from '../perspective/camera';
import type { Camera, Family } from '../perspective/types';
import type { RenderItem } from '../derive/renderModel';
import { boundsOf, type Rect } from '../viewport/viewport';

export const AXES: Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];
/** World axis → family (§5: +X toward VP-R, +Y toward VP-L, +Z up). */
export const AXIS_FAMILY: Family[] = ['R', 'L', 'V'];

export const get = (v: Vec3, axis: number): number => (axis === 0 ? v.x : axis === 1 ? v.y : v.z);
export const withAxis = (v: Vec3, axis: number, value: number): Vec3 =>
  axis === 0 ? { ...v, x: value } : axis === 1 ? { ...v, y: value } : { ...v, z: value };

export function segmentItem(
  cam: Camera,
  key: string,
  entityId: string,
  role: RenderItem['role'],
  family: Family | undefined,
  a: Vec3,
  b: Vec3,
): RenderItem | null {
  const seg = projectSegment(cam, a, b);
  if (!seg) return null;
  return { key, entityId, role, family, points: [seg[0].x, seg[0].y, seg[1].x, seg[1].y] };
}

/** A face polygon, only when every corner is in front of the camera. */
export function polygonItem(cam: Camera, key: string, entityId: string, family: Family, pts: Vec3[], filled: boolean): RenderItem | null {
  const out: number[] = [];
  for (const P of pts) {
    const q = project(cam, P);
    if (!q) return null;
    out.push(q.x, q.y);
  }
  return { key, entityId, role: 'face', family, points: out, closed: true, data: { filled: filled ? 1 : 0 } };
}

export function projectedBounds(cam: Camera, pts: Vec3[]): Rect | null {
  const q = pts.map((P) => project(cam, P)).filter((p): p is NonNullable<typeof p> => p !== null);
  return q.length ? boundsOf(q) : null;
}

/** How far (u) a pointer moved along a world axis through A since the drag started. */
export function axisDelta(cam: Camera, A: Vec3, axis: number, startPp: { x: number; y: number }, pp: { x: number; y: number }): number {
  const s0 = closestOnAxis(cam, startPp, A, AXES[axis]);
  const s1 = closestOnAxis(cam, pp, A, AXES[axis]);
  return s0 === null || s1 === null ? 0 : s1 - s0;
}

export const centreOf = (pts: Vec3[]): Vec3 => scale3(pts.reduce(add3, { x: 0, y: 0, z: 0 }), 1 / pts.length);
