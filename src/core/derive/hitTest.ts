// Hit-testing against the render model (§9): tools never use Konva events.
import type { Id } from '../document/types';
import type { Vec2 } from '../math/vec';
import type { Rect } from '../viewport/viewport';
import type { RenderItem } from './renderModel';

function pointInPolygon(p: Vec2, pts: number[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Vec2, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2)) : 0;
  return Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
}

function distToPolyline(p: Vec2, pts: number[], closed: boolean): number {
  let d = Infinity;
  const n = pts.length;
  for (let i = 0; i + 3 < n; i += 2) d = Math.min(d, distToSegment(p, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]));
  if (closed && n >= 4) d = Math.min(d, distToSegment(p, pts[n - 2], pts[n - 1], pts[0], pts[1]));
  return d;
}

const PICKABLE = new Set<RenderItem['role']>(['face', 'edge', 'hiddenEdge', 'stroke']);

/** The topmost entity at p (items later in the list are on top); `tol` in pp. */
export function hitTest(items: readonly RenderItem[], p: Vec2, tol: number, pickable?: (id: Id) => boolean): Id | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!it.entityId || !PICKABLE.has(it.role)) continue;
    if (pickable && !pickable(it.entityId)) continue;
    const inside = (it.role === 'face' || it.role === 'stroke') && pointInPolygon(p, it.points);
    if (inside || distToPolyline(p, it.points, !!it.closed) <= tol) return it.entityId;
  }
  return null;
}

/** Entities with any pickable item inside the rectangle (marquee, desktop). */
export function hitRect(items: readonly RenderItem[], r: Rect, pickable?: (id: Id) => boolean): Id[] {
  const out = new Set<Id>();
  for (const it of items) {
    if (!it.entityId || !PICKABLE.has(it.role) || (pickable && !pickable(it.entityId))) continue;
    for (let i = 0; i + 1 < it.points.length; i += 2) {
      const x = it.points[i];
      const y = it.points[i + 1];
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        out.add(it.entityId);
        break;
      }
    }
  }
  return [...out];
}

/** Entities whose outline passes within `tol` of the segment a→b (eraser sweep). */
export function hitSegment(items: readonly RenderItem[], a: Vec2, b: Vec2, tol: number, pickable?: (id: Id) => boolean): Id[] {
  const out = new Set<Id>();
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(tol, 1)));
  for (let s = 0; s <= steps; s++) {
    const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps };
    const id = hitTest(items, p, tol, (x) => !out.has(x) && (!pickable || pickable(x)));
    if (id) out.add(id);
  }
  return [...out];
}
