// Construction rays (BX-05, §9): from edge endpoints toward the edge's VP.
import type { Vec3 } from '../math/vec';
import { project, vanishingPoint } from '../perspective/camera';
import type { Camera, Family } from '../perspective/types';
import type { RenderItem } from '../derive/renderModel';

/** Length of a ray toward a VP at infinity, pp. */
const INFINITE_RAY = 1e5;

export function raysFrom(
  cam: Camera,
  entityId: string,
  edges: { a: Vec3; b: Vec3; family: Family }[],
): RenderItem[] {
  const seen = new Set<string>();
  const out: RenderItem[] = [];
  for (const { a, b, family } of edges) {
    const vp = vanishingPoint(cam, family);
    for (const P of [a, b]) {
      const q = project(cam, P);
      if (!q) continue;
      const key = `${entityId}:ray:${family}:${q.x.toFixed(3)},${q.y.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let end;
      if (vp.w !== 0) {
        end = { x: vp.x / vp.w, y: vp.y / vp.w };
      } else {
        const d = Math.hypot(vp.x, vp.y) || 1;
        // Toward the direction the edge runs away from this endpoint.
        const other = project(cam, P === a ? b : a);
        const sign = other && (other.x - q.x) * vp.x + (other.y - q.y) * vp.y < 0 ? 1 : -1;
        end = { x: q.x + (sign * vp.x * INFINITE_RAY) / d, y: q.y + (sign * vp.y * INFINITE_RAY) / d };
      }
      out.push({ key, entityId, role: 'ray', family, points: [q.x, q.y, end.x, end.y] });
    }
  }
  return out;
}
