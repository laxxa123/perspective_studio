// Ground / wall rectangle entity kind (RC-01, §7.5).
import { z } from 'zod';
import { add3, sub3, type Vec3 } from '../../math/vec';
import { depth, project, unproject } from '../../perspective/camera';
import type { RenderItem } from '../../derive/renderModel';
import type { RectEntity } from '../../document/types';
import { AXIS_FAMILY, axisDelta, centreOf, polygonItem, projectedBounds, segmentItem, withAxis } from '../common';
import { raysFrom } from '../rays';
import { MOVE_HANDLE, snap, type EntityKindDef } from '../types';

export const MIN_RECT_SIZE = 0.05;

/** The plane's two in-plane axes (0 = X, 1 = Y, 2 = Z) and its normal axis. */
export const PLANE_AXES: Record<RectEntity['plane'], { u: number; v: number; normal: number }> = {
  ground: { u: 0, v: 1, normal: 2 },
  wallL: { u: 1, v: 2, normal: 0 },
  wallR: { u: 0, v: 2, normal: 1 },
};

export const rectSchema = z.object({
  id: z.string(),
  kind: z.literal('rect'),
  layerId: z.string(),
  name: z.string().optional(),
  visible: z.boolean(),
  locked: z.boolean(),
  plane: z.enum(['ground', 'wallL', 'wallR']),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  size: z.object({ x: z.number(), y: z.number() }).refine((s) => s.x > 0 && s.y > 0, 'size must be > 0'),
}) as unknown as z.ZodType<RectEntity>;

/** Corners in order: origin, +u, +u+v, +v. */
export function rectCorners(r: Pick<RectEntity, 'plane' | 'position' | 'size'>): Vec3[] {
  const { u, v } = PLANE_AXES[r.plane];
  const p = r.position;
  const du = withAxis({ x: 0, y: 0, z: 0 }, u, r.size.x);
  const dv = withAxis({ x: 0, y: 0, z: 0 }, v, r.size.y);
  return [p, add3(p, du), add3(add3(p, du), dv), add3(p, dv)];
}

const edgeMid = (c: Vec3[], i: number) => centreOf([c[i], c[(i + 1) % 4]]);

export const rectKind: EntityKindDef<RectEntity> = {
  kind: 'rect',
  schema: rectSchema,
  layerRole: 'objects',

  derive(r, { cam, display, selected }) {
    const c = rectCorners(r);
    const { u, v, normal } = PLANE_AXES[r.plane];
    const out: RenderItem[] = [];
    const face = polygonItem(cam, `${r.id}:face`, r.id, AXIS_FAMILY[normal], c, display.faceFills);
    if (face) out.push(face);
    const fam = [AXIS_FAMILY[u], AXIS_FAMILY[v], AXIS_FAMILY[u], AXIS_FAMILY[v]];
    for (let i = 0; i < 4; i++) {
      const it = segmentItem(cam, `${r.id}:edge${i}`, r.id, 'edge', fam[i], c[i], c[(i + 1) % 4]);
      if (it) out.push(it);
    }
    if (display.rays === 'all' || (display.rays === 'selected' && selected)) {
      out.unshift(...raysFrom(cam, r.id, [0, 1, 2, 3].map((i) => ({ a: c[i], b: c[(i + 1) % 4], family: fam[i] }))));
    }
    return out;
  },

  handles(r, { cam }) {
    const c = rectCorners(r);
    const { u, v } = PLANE_AXES[r.plane];
    const out = [];
    // Edge 1 (+u side) resizes along u; edge 2 (+v side) along v.
    const qu = project(cam, edgeMid(c, 1));
    if (qu) out.push({ id: 'size:u', point: qu, family: AXIS_FAMILY[u], kind: 'resize' as const });
    const qv = project(cam, edgeMid(c, 2));
    if (qv) out.push({ id: 'size:v', point: qv, family: AXIS_FAMILY[v], kind: 'resize' as const });
    return out;
  },

  applyHandle(_r, handleId, drag, { cam }) {
    const s = drag.start;
    const { u, v } = PLANE_AXES[s.plane];
    const c = rectCorners(s);
    if (handleId === MOVE_HANDLE) {
      // Moves on the ground plane through its base (z fixed).
      const P0 = unproject(cam, drag.startPp, s.position.z);
      const P1 = unproject(cam, drag.pp, s.position.z);
      if (!P0 || !P1) return {};
      const m = add3(s.position, sub3(P1, P0));
      return { position: { x: snap(m.x, drag.snapStep), y: snap(m.y, drag.snapStep), z: s.position.z } };
    }
    if (handleId === 'size:u') {
      const d = axisDelta(cam, edgeMid(c, 1), u, drag.startPp, drag.pp);
      return { size: { ...s.size, x: Math.max(MIN_RECT_SIZE, snap(s.size.x + d, drag.snapStep)) } };
    }
    if (handleId === 'size:v') {
      const d = axisDelta(cam, edgeMid(c, 2), v, drag.startPp, drag.pp);
      return { size: { ...s.size, y: Math.max(MIN_RECT_SIZE, snap(s.size.y + d, drag.snapStep)) } };
    }
    return {};
  },

  bounds: (r, { cam }) => projectedBounds(cam, rectCorners(r)),
  depth: (r, { cam }) => depth(cam, centreOf(rectCorners(r))),
  offsetCopy: (r) => ({ position: { ...r.position, x: r.position.x + 1 } }),
};
