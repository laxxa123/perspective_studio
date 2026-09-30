// Sketch stroke entity kind (SK-01, §7.6): picture-plane data, rendered as a
// variable-width outline (perfect-freehand, ADR-0004).
import { getStroke } from 'perfect-freehand';
import { z } from 'zod';
import type { RenderItem } from '../../derive/renderModel';
import type { StrokeEntity } from '../../document/types';
import { boundsOf } from '../../viewport/viewport';
import { MOVE_HANDLE, type EntityKindDef } from '../types';

export const STROKE_TOOLS = {
  pencil: { thinning: 0.6, smoothing: 0.5, streamline: 0.4, defaultWidth: 2, defaultOpacity: 0.9 },
  pen: { thinning: 0.45, smoothing: 0.6, streamline: 0.5, defaultWidth: 3, defaultOpacity: 1 },
  marker: { thinning: 0, smoothing: 0.7, streamline: 0.6, defaultWidth: 12, defaultOpacity: 0.45 },
} as const;

export const strokeSchema = z.object({
  id: z.string(),
  kind: z.literal('stroke'),
  layerId: z.string(),
  name: z.string().optional(),
  visible: z.boolean(),
  locked: z.boolean(),
  space: z.literal('picture'),
  tool: z.enum(['pencil', 'pen', 'marker']),
  color: z.string(),
  width: z.number().positive(),
  opacity: z.number().min(0).max(1),
  points: z.array(z.number()).refine((p) => p.length % 3 === 0 && p.length >= 3, 'points must be [x, y, pressure] triples'),
  constraint: z.object({ family: z.enum(['L', 'R', 'V']), mode: z.enum(['soft', 'locked']) }).optional(),
}) as unknown as z.ZodType<StrokeEntity>;

export const strokeTriples = (s: Pick<StrokeEntity, 'points'>): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < s.points.length; i += 3) out.push([s.points[i], s.points[i + 1], s.points[i + 2]]);
  return out;
};

/** The stroke outline polygon, flat [x, y, …] in pp. */
export function strokeOutline(s: Pick<StrokeEntity, 'points' | 'tool' | 'width'>): number[] {
  const pts = strokeTriples(s);
  const opts = STROKE_TOOLS[s.tool];
  // A finger reports constant pressure: let the library simulate it then (ADR-0004).
  const constant = pts.every((p) => p[2] === pts[0][2]);
  const outline = getStroke(pts, {
    size: s.width,
    thinning: opts.thinning,
    smoothing: opts.smoothing,
    streamline: opts.streamline,
    simulatePressure: constant,
    last: true,
  });
  return outline.flatMap(([x, y]) => [x, y]);
}

export const strokeKind: EntityKindDef<StrokeEntity> = {
  kind: 'stroke',
  schema: strokeSchema,
  layerRole: 'sketch',
  derive(s): RenderItem[] {
    return [
      {
        key: `${s.id}:outline`,
        entityId: s.id,
        role: 'stroke',
        points: strokeOutline(s),
        closed: true,
        data: { color: s.color, opacity: s.opacity },
      },
    ];
  },
  handles: () => [],
  applyHandle(_s, handleId, drag) {
    if (handleId !== MOVE_HANDLE) return {};
    const dx = drag.pp.x - drag.startPp.x;
    const dy = drag.pp.y - drag.startPp.y;
    return { points: drag.start.points.map((v, i) => (i % 3 === 0 ? v + dx : i % 3 === 1 ? v + dy : v)) };
  },
  bounds(s) {
    const pts = strokeTriples(s).map(([x, y]) => ({ x, y }));
    if (!pts.length) return null;
    const b = boundsOf(pts);
    const r = s.width / 2;
    return { x: b.x - r, y: b.y - r, width: b.width + 2 * r, height: b.height + 2 * r };
  },
  depth: () => null,
  offsetCopy: (s) => ({ points: s.points.map((v, i) => (i % 3 === 2 ? v : v + 20)) }),
};
