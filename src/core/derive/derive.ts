// Document + camera → RenderModel (§8.3), memoized per entity.
import { kindOf } from '../entities/registry';
import type { DeriveCtx } from '../entities/types';
import type { Entity, Id, KnownEntity, Paper, SceneDocument } from '../document/types';
import { deriveCamera } from '../perspective/camera';
import { guideRays } from './fans';
import { coneOfVision, originMarker, planeGrid } from './aids';
import type { Camera, PerspectiveSystem } from '../perspective/types';
import { boundsOf, type Rect } from '../viewport/viewport';
import type { DisplayOptions } from './display';
import type { RenderItem, RenderModel } from './renderModel';

/** Horizon half-length beyond the paper, pp (the canvas is unbounded). */
const HORIZON_REACH = 1e5;

export function deriveGuides(ps: PerspectiveSystem, paper: Paper, display: DisplayOptions): RenderItem[] {
  const items: RenderItem[] = [];
  if (display.paperFrame) {
    items.push({ key: 'paper', role: 'paper', points: [0, 0, paper.width, 0, paper.width, paper.height, 0, paper.height], closed: true });
  }
  if (!display.guides) return items;
  if (display.vpFans) items.push(...guideRays(ps, paper));
  items.push({ key: 'horizon', role: 'horizon', points: [-HORIZON_REACH, ps.horizonY, paper.width + HORIZON_REACH, ps.horizonY] });
  items.push({ key: 'vp:L', role: 'vp', family: 'L', points: [ps.vpLeftX, ps.horizonY] });
  items.push({ key: 'vp:R', role: 'vp', family: 'R', points: [ps.vpRightX, ps.horizonY] });
  if (ps.mode === '3pt' && ps.vpVerticalY !== null) {
    items.push({ key: 'vp:V', role: 'vp', family: 'V', points: [ps.verticalX, ps.vpVerticalY] });
  }
  return items;
}

/** Options that are UI state, not document data. */
export interface DeriveOptions {
  /** Working plane height (PL-01), or null. */
  workingPlane?: number | null;
}

interface CacheEntry {
  ps: PerspectiveSystem;
  display: DisplayOptions;
  selected: boolean;
  items: RenderItem[];
}

/** Per-entity memo keyed by (entity reference, perspective reference) (§8.3). */
export type DeriveCache = WeakMap<Entity, CacheEntry>;
export const newDeriveCache = (): DeriveCache => new WeakMap();

function deriveEntity(e: Entity, ctx: DeriveCtx, cache?: DeriveCache): RenderItem[] {
  const hit = cache?.get(e);
  if (hit && hit.ps === ctx.ps && hit.display === ctx.display && hit.selected === ctx.selected) return hit.items;
  const def = 'unknown' in e ? undefined : kindOf(e.kind);
  const items = def ? def.derive(e as KnownEntity, ctx) : [];
  cache?.set(e, { ps: ctx.ps, display: ctx.display, selected: ctx.selected, items });
  return items;
}

/** Visible entities of a layer in draw order; world objects in painter's order (BX-07). */
export function drawOrder(doc: SceneDocument, layerId: Id, cam: Camera, display: DisplayOptions): KnownEntity[] {
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer) return [];
  const list = layer.order
    .map((id) => doc.entities[id])
    .filter((e): e is KnownEntity => !!e && !('unknown' in e) && e.visible);
  if (layer.role !== 'objects') return list;
  const ctx: DeriveCtx = { cam, ps: doc.perspective, display, selected: false };
  // Farther first; stable for equal depths (keeps the layer order).
  return list
    .map((e, i) => ({ e, i, d: kindOf(e.kind)?.depth(e, ctx) ?? 0 }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .map((x) => x.e);
}

export function deriveDocument(
  doc: SceneDocument,
  display: DisplayOptions,
  selection: ReadonlySet<Id> = new Set(),
  cache?: DeriveCache,
  opts: DeriveOptions = {},
): RenderModel {
  const cam = deriveCamera(doc.perspective);
  const items = deriveGuides(doc.perspective, doc.paper, display);
  if (display.floorGrid) items.push(...planeGrid(cam, 0, 'grid'));
  if (opts.workingPlane !== null && opts.workingPlane !== undefined) items.push(...planeGrid(cam, opts.workingPlane, 'work', 6, 1).map((i) => ({ ...i, data: { ...i.data, working: 1 } })));
  if (display.coneOfVision) items.push(coneOfVision(cam));
  if (display.guides) items.push(...originMarker(cam, display.rays !== 'none'));
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    if (layer.role === 'objects' && !display.objects) continue;
    for (const e of drawOrder(doc, layer.id, cam, display)) {
      const ctx: DeriveCtx = { cam, ps: doc.perspective, display, selected: selection.has(e.id) };
      for (const it of deriveEntity(e, ctx, cache)) {
        items.push({ ...it, data: { ...it.data, layer: layer.id, layerOpacity: layer.opacity } });
      }
    }
  }
  return { items, bounds: paperBounds(doc.paper) };
}

export const paperBounds = (paper: Paper): Rect => ({ x: 0, y: 0, width: paper.width, height: paper.height });

/** Paper plus every VP (fit to all, CV-01 / PS-05). */
export function allBounds(ps: PerspectiveSystem, paper: Paper): Rect {
  const pts = [
    { x: 0, y: 0 },
    { x: paper.width, y: paper.height },
    { x: ps.vpLeftX, y: ps.horizonY },
    { x: ps.vpRightX, y: ps.horizonY },
    ps.anchor,
  ];
  if (ps.mode === '3pt' && ps.vpVerticalY !== null) pts.push({ x: ps.verticalX, y: ps.vpVerticalY });
  return boundsOf(pts);
}
