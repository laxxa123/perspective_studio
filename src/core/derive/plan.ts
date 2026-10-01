// Plan view (CV-05): an orthographic top-down map of the world, oriented with
// the eye at the bottom looking up (OD-12). Same world data as the picture;
// no camera projection (§16.2).
import type { BoxEntity, Entity, Id, RectEntity, SceneDocument } from '../document/types';
import { type Vec2 } from '../math/vec';
import { pictureRay } from '../perspective/camera';
import type { Camera, Family } from '../perspective/types';
import { boundsOf, type Rect } from '../viewport/viewport';

export type PlanRole = 'grid' | 'footprint' | 'wall' | 'axis' | 'eye' | 'wedge' | 'forward';

export interface PlanItem {
  key: string;
  role: PlanRole;
  entityId?: Id;
  family?: Family;
  /** Plan units (u), flat [x0, y0, …]; +y is down the screen. */
  points: number[];
  closed?: boolean;
}

export interface PlanModel {
  items: PlanItem[];
  /** Content bounds (eye, origin, objects), for fitting. */
  bounds: Rect;
}

/** World → plan frame: eye at (0, 0), view direction up the screen. */
export function planFrame(cam: Camera) {
  // The picture's right is always horizontal (the head is level); the heading
  // is perpendicular to it, so this also holds looking straight down.
  const right0 = { x: cam.M.c0.x, y: cam.M.c1.x };
  const rl = Math.hypot(right0.x, right0.y) || 1;
  const right = { x: right0.x / rl, y: right0.y / rl };
  const fwd = { x: -right.y, y: right.x };
  const E = { x: cam.C.x, y: cam.C.y };
  return {
    toPlan(P: { x: number; y: number }): Vec2 {
      const dx = P.x - E.x;
      const dy = P.y - E.y;
      return { x: dx * right.x + dy * right.y, y: -(dx * fwd.x + dy * fwd.y) };
    },
    fwd,
    right,
  };
}

const GRID_HALF = 10;

export function derivePlan(doc: SceneDocument, cam: Camera): PlanModel {
  const { toPlan } = planFrame(cam);
  const flat = (pts: Vec2[]) => pts.flatMap((p) => [p.x, p.y]);
  const items: PlanItem[] = [];
  const content: Vec2[] = [{ x: 0, y: 0 }, toPlan({ x: 0, y: 0 })];

  for (let k = -GRID_HALF; k <= GRID_HALF; k++) {
    items.push({ key: `g:x${k}`, role: 'grid', family: 'L', points: flat([toPlan({ x: k, y: -GRID_HALF }), toPlan({ x: k, y: GRID_HALF })]) });
    items.push({ key: `g:y${k}`, role: 'grid', family: 'R', points: flat([toPlan({ x: -GRID_HALF, y: k }), toPlan({ x: GRID_HALF, y: k })]) });
  }
  const o = toPlan({ x: 0, y: 0 });
  items.push({ key: 'axis:R', role: 'axis', family: 'R', points: flat([o, toPlan({ x: 1, y: 0 })]) });
  items.push({ key: 'axis:L', role: 'axis', family: 'L', points: flat([o, toPlan({ x: 0, y: 1 })]) });

  const visibleIn = (e: Entity) => {
    const l = doc.layers.find((x) => x.id === e.layerId);
    return !!l && l.visible && !('unknown' in e) && e.visible;
  };
  for (const e of Object.values(doc.entities)) {
    if (!visibleIn(e)) continue;
    if (e.kind === 'box') {
      const b = e as BoxEntity;
      const c = [
        { x: b.position.x, y: b.position.y },
        { x: b.position.x + b.size.x, y: b.position.y },
        { x: b.position.x + b.size.x, y: b.position.y + b.size.y },
        { x: b.position.x, y: b.position.y + b.size.y },
      ].map(toPlan);
      content.push(...c);
      items.push({ key: `${b.id}:fp`, role: 'footprint', entityId: b.id, points: flat(c), closed: true });
    } else if (e.kind === 'rect') {
      const r = e as RectEntity;
      const p = r.position;
      if (r.plane === 'ground') {
        const c = [
          { x: p.x, y: p.y },
          { x: p.x + r.size.x, y: p.y },
          { x: p.x + r.size.x, y: p.y + r.size.y },
          { x: p.x, y: p.y + r.size.y },
        ].map(toPlan);
        content.push(...c);
        items.push({ key: `${r.id}:fp`, role: 'footprint', entityId: r.id, points: flat(c), closed: true });
      } else {
        // Walls stand on a line: wallL runs along Y, wallR along X.
        const a = { x: p.x, y: p.y };
        const b = r.plane === 'wallL' ? { x: p.x, y: p.y + r.size.x } : { x: p.x + r.size.x, y: p.y };
        const c = [toPlan(a), toPlan(b)];
        content.push(...c);
        items.push({ key: `${r.id}:wall`, role: 'wall', entityId: r.id, family: r.plane === 'wallL' ? 'L' : 'R', points: flat(c) });
      }
    }
  }

  // The eye, its view direction and the field of view through the paper's edges.
  const reach = Math.max(4, ...content.map((p) => Math.hypot(p.x, p.y))) * 1.15;
  const edgeDir = (x: number) => {
    const d = pictureRay(cam, { x, y: cam.p.y }).dir;
    const w = toPlan({ x: cam.C.x + d.x, y: cam.C.y + d.y });
    const l = Math.hypot(w.x, w.y) || 1;
    return { x: (w.x / l) * reach, y: (w.y / l) * reach };
  };
  const left = edgeDir(0);
  const right = edgeDir(doc.paper.width);
  items.push({ key: 'wedge', role: 'wedge', points: [left.x, left.y, 0, 0, right.x, right.y] });
  items.push({ key: 'forward', role: 'forward', points: [0, 0, 0, -reach] });
  items.push({ key: 'eye', role: 'eye', points: [0, 0] });

  const b = boundsOf(content);
  const pad = 1;
  return { items, bounds: { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad } };
}

/** Tap-to-select in the plan (OD-13): the footprint or wall under a plan point. */
export function hitPlan(model: PlanModel, p: Vec2, tol: number): Id | null {
  for (let i = model.items.length - 1; i >= 0; i--) {
    const it = model.items[i];
    if (!it.entityId) continue;
    if (it.role === 'footprint' && inPolygon(p, it.points)) return it.entityId;
    if (it.role === 'wall' && distToSegment(p, it.points) <= tol) return it.entityId;
  }
  return null;
}

function inPolygon(p: Vec2, pts: number[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Vec2, s: number[]): number {
  const [ax, ay, bx, by] = s;
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2)) : 0;
  return Math.hypot(p.x - ax - t * dx, p.y - ay - t * dy);
}

