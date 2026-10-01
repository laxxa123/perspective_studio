// Construction rays (BX-05, §9, UI-11): each edge extended past its end
// toward the edge's VP — one ray per edge, the only VP guide lines drawn.
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
    const qa = project(cam, a);
    const qb = project(cam, b);
    if (!qa || !qb) continue;
    const vp = vanishingPoint(cam, family);
    let start;
    let end;
    if (vp.w !== 0) {
      end = { x: vp.x / vp.w, y: vp.y / vp.w };
      // From the end nearer the VP: the extension, not the edge again.
      start = Math.hypot(qa.x - end.x, qa.y - end.y) <= Math.hypot(qb.x - end.x, qb.y - end.y) ? qa : qb;
    } else {
      // Parallel family: extend beyond the end that leads in the VP's direction.
      const d = Math.hypot(vp.x, vp.y) || 1;
      const ux = vp.x / d;
      const uy = vp.y / d;
      start = (qb.x - qa.x) * ux + (qb.y - qa.y) * uy >= 0 ? qb : qa;
      end = { x: start.x + ux * INFINITE_RAY, y: start.y + uy * INFINITE_RAY };
    }
    const key = `${entityId}:ray:${family}:${start.x.toFixed(3)},${start.y.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, entityId, role: 'ray', family, points: [start.x, start.y, end.x, end.y] });
  }
  return out;
}
