// PS-10 / PS-13: the points of an entity that pin selection and the View orbit use.
import type { KnownEntity } from '../document/types';
import type { Vec3 } from '../math/vec';
import type { Camera } from '../perspective/types';
import { boxCorners } from './box/box';
import { rectCorners } from './rect/rect';

/** The entity's bottom corner nearest the eye (front-bottom corner); null for picture-plane kinds. */
export function pinPointOf(e: KnownEntity, cam: Camera): Vec3 | null {
  const corners = e.kind === 'box' ? boxCorners(e).slice(0, 4) : e.kind === 'rect' ? rectCorners(e) : null;
  if (!corners) return null;
  const d = (P: Vec3) => Math.hypot(P.x - cam.C.x, P.y - cam.C.y, P.z - cam.C.z);
  return corners.reduce((a, b) => (d(b) < d(a) ? b : a));
}

/** PS-13: the point the View orbit turns around — the entity's centre; null for picture-plane kinds. */
export function orbitPivotOf(e: KnownEntity): Vec3 | null {
  const corners = e.kind === 'box' ? boxCorners(e) : e.kind === 'rect' ? rectCorners(e) : null;
  if (!corners) return null;
  const n = corners.length;
  return corners.reduce((a, c) => ({ x: a.x + c.x / n, y: a.y + c.y / n, z: a.z + c.z / n }), { x: 0, y: 0, z: 0 });
}
