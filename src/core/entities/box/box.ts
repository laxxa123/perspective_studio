// Box / cube entity kind (BX-01…05, §7.4, §9).
import { z } from 'zod';
import { add3, dot3, sub3, type Vec3 } from '../../math/vec';
import { depth, unproject } from '../../perspective/camera';
import { v3 } from '../../math/vec';
import type { RenderItem } from '../../derive/renderModel';
import type { BoxEntity } from '../../document/types';
import { raysFrom } from '../rays';
import {
  AXES,
  AXIS_FAMILY,
  axisDelta,
  centreOf,
  get,
  polygonItem,
  projectedBounds,
  segmentItem,
  withAxis,
} from '../common';
import { MOVE_HANDLE, snap, type DeriveCtx, type EntityKindDef, type HandleDef } from '../types';
import { project } from '../../perspective/camera';
import { boxSnapTarget } from '../../snapping/boxSnap';

export const MIN_BOX_SIZE = 0.05;
/** Default placed cube, u. */
export const DEFAULT_CUBE = 1;

const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
export const boxSchema = z.object({
  id: z.string(),
  kind: z.literal('box'),
  layerId: z.string(),
  name: z.string().optional(),
  visible: z.boolean(),
  locked: z.boolean(),
  position: vec3,
  size: vec3.refine((s) => s.x > 0 && s.y > 0 && s.z > 0, 'size must be > 0'),
  uniform: z.boolean(),
}) as unknown as z.ZodType<BoxEntity>;

/** Corners indexed by bits: bit 0 = +X, bit 1 = +Y, bit 2 = +Z. */
export function boxCorners(b: Pick<BoxEntity, 'position' | 'size'>): Vec3[] {
  const { position: p, size: s } = b;
  return Array.from({ length: 8 }, (_, i) => v3(p.x + (i & 1 ? s.x : 0), p.y + (i & 2 ? s.y : 0), p.z + (i & 4 ? s.z : 0)));
}

/** Faces: axis of the normal, side (0 = min, 1 = max), corners in order. */
export const BOX_FACES: { axis: number; side: 0 | 1; corners: number[] }[] = [
  { axis: 0, side: 0, corners: [0, 2, 6, 4] },
  { axis: 0, side: 1, corners: [1, 3, 7, 5] },
  { axis: 1, side: 0, corners: [0, 1, 5, 4] },
  { axis: 1, side: 1, corners: [2, 3, 7, 6] },
  { axis: 2, side: 0, corners: [0, 1, 3, 2] },
  { axis: 2, side: 1, corners: [4, 5, 7, 6] },
];

/** Edges: corner pairs and the axis they run along. */
export const BOX_EDGES: { a: number; b: number; axis: number }[] = [
  { a: 0, b: 1, axis: 0 }, { a: 2, b: 3, axis: 0 }, { a: 4, b: 5, axis: 0 }, { a: 6, b: 7, axis: 0 },
  { a: 0, b: 2, axis: 1 }, { a: 1, b: 3, axis: 1 }, { a: 4, b: 6, axis: 1 }, { a: 5, b: 7, axis: 1 },
  { a: 0, b: 4, axis: 2 }, { a: 1, b: 5, axis: 2 }, { a: 2, b: 6, axis: 2 }, { a: 3, b: 7, axis: 2 },
];

const normalOf = (axis: number, side: 0 | 1): Vec3 => {
  const n = AXES[axis];
  return side ? n : { x: -n.x, y: -n.y, z: -n.z };
};

/** Back-face test (§9): visible iff normal · (C − faceCentre) > 0. */
export function visibleFaces(b: BoxEntity, C: Vec3): boolean[] {
  const c = boxCorners(b);
  return BOX_FACES.map((f) => dot3(normalOf(f.axis, f.side), sub3(C, centreOf(f.corners.map((i) => c[i])))) > 0);
}

function visibleEdgeMask(b: BoxEntity, C: Vec3): boolean[] {
  const vis = visibleFaces(b, C);
  return BOX_EDGES.map((e) => BOX_FACES.some((f, fi) => vis[fi] && f.corners.includes(e.a) && f.corners.includes(e.b)));
}

function faceHandleFace(b: BoxEntity, C: Vec3, axis: number): { axis: number; side: 0 | 1 } {
  const vis = visibleFaces(b, C);
  const max = BOX_FACES.findIndex((f) => f.axis === axis && f.side === 1);
  const min = BOX_FACES.findIndex((f) => f.axis === axis && f.side === 0);
  return { axis, side: vis[max] || !vis[min] ? 1 : 0 };
}

const faceCentre = (b: BoxEntity, axis: number, side: 0 | 1): Vec3 => {
  const c = boxCorners(b);
  const f = BOX_FACES.find((x) => x.axis === axis && x.side === side)!;
  return centreOf(f.corners.map((i) => c[i]));
};

/** Midpoint of the vertical edge nearest the camera: where the lift handle sits. */
function liftPoint(b: BoxEntity, C: Vec3): Vec3 {
  const c = boxCorners(b);
  let best = c[0];
  let bestD = Infinity;
  for (const e of BOX_EDGES.filter((x) => x.axis === 2)) {
    const m = centreOf([c[e.a], c[e.b]]);
    const d = Math.hypot(m.x - C.x, m.y - C.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

export const boxKind: EntityKindDef<BoxEntity> = {
  kind: 'box',
  schema: boxSchema,
  layerRole: 'objects',

  derive(b, ctx: DeriveCtx): RenderItem[] {
    const { cam, display } = ctx;
    const c = boxCorners(b);
    const vis = visibleFaces(b, cam.C);
    const edgeVis = visibleEdgeMask(b, cam.C);
    const out: RenderItem[] = [];
    BOX_FACES.forEach((f, i) => {
      if (!vis[i]) return;
      const item = polygonItem(cam, `${b.id}:face${i}`, b.id, AXIS_FAMILY[f.axis], f.corners.map((k) => c[k]), display.faceFills);
      if (item) out.push(item);
    });
    BOX_EDGES.forEach((e, i) => {
      if (!edgeVis[i] && !display.hiddenEdges) return;
      const item = segmentItem(cam, `${b.id}:edge${i}`, b.id, edgeVis[i] ? 'edge' : 'hiddenEdge', AXIS_FAMILY[e.axis], c[e.a], c[e.b]);
      if (item) out.push(item);
    });
    if (display.rays === 'all' || (display.rays === 'selected' && ctx.selected)) {
      const visibleEdges = BOX_EDGES.filter((_, i) => edgeVis[i]).map((e) => ({ a: c[e.a], b: c[e.b], family: AXIS_FAMILY[e.axis] }));
      out.unshift(...raysFrom(cam, b.id, visibleEdges));
    }
    return out;
  },

  handles(b, { cam }) {
    const out: HandleDef[] = [0, 1, 2].flatMap((axis) => {
      const f = faceHandleFace(b, cam.C, axis);
      const q = project(cam, faceCentre(b, axis, f.side));
      return q ? [{ id: `size:${axis}:${f.side}`, point: q, family: AXIS_FAMILY[axis], kind: 'resize' as const }] : [];
    });
    const lift = project(cam, liftPoint(b, cam.C));
    if (lift) out.push({ id: 'lift', point: lift, family: 'V', kind: 'lift' });
    return out;
  },

  applyHandle(_b, handleId, drag, { cam }) {
    const s = drag.start;
    if (handleId === MOVE_HANDLE) {
      const P0 = unproject(cam, drag.startPp, s.position.z);
      const P1 = unproject(cam, drag.pp, s.position.z);
      if (!P0 || !P1) return {};
      const moved = add3(s.position, sub3(P1, P0));
      const pos = { x: snap(moved.x, drag.snapStep), y: snap(moved.y, drag.snapStep), z: s.position.z };
      return { position: boxSnapTarget({ ...s, position: pos }, drag.others, cam, drag.pp) };
    }
    if (handleId === 'lift') {
      const d = axisDelta(cam, liftPoint(s, cam.C), 2, drag.startPp, drag.pp);
      return { position: { ...s.position, z: snap(s.position.z + d, drag.snapStep) } };
    }
    const m = /^size:(\d):(\d)$/.exec(handleId);
    if (!m) return {};
    const axis = Number(m[1]);
    const side = Number(m[2]) as 0 | 1;
    const d = axisDelta(cam, faceCentre(s, axis, side), axis, drag.startPp, drag.pp);
    const old = get(s.size, axis);
    const next = Math.max(MIN_BOX_SIZE, snap(old + (side ? d : -d), drag.snapStep));
    if (s.uniform) {
      const k = next / old;
      const size = { x: s.size.x * k, y: s.size.y * k, z: s.size.z * k };
      // The face opposite the dragged one stays put.
      const position = side ? s.position : withAxis(s.position, axis, get(s.position, axis) + old - next);
      return { size, position };
    }
    const size = withAxis(s.size, axis, next);
    const position = side ? s.position : withAxis(s.position, axis, get(s.position, axis) + old - next);
    return { size, position };
  },

  bounds: (b, { cam }) => projectedBounds(cam, boxCorners(b)),
  depth: (b, { cam }) => depth(cam, centreOf(boxCorners(b))),
  offsetCopy: (b) => ({ position: { ...b.position, x: b.position.x + 1 } }),
};
