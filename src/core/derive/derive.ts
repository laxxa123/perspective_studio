// Document + camera → RenderModel (§8.3), memoized per entity.
import { kindOf } from '../entities/registry';
import type { DeriveCtx } from '../entities/types';
import type { Entity, Id, KnownEntity, Paper, SceneDocument } from '../document/types';
import { project, vanishingPoint } from '../perspective/camera';
import { cameraFromEye, horizonOf, type Eye } from '../perspective/view';
import { coneOfVision, originMarker, planeGrid } from './aids';
import type { Camera, Family } from '../perspective/types';
import { v3, type Vec2 } from '../math/vec';
import { boundsOf, type Rect } from '../viewport/viewport';
import type { DisplayOptions } from './display';
import type { RenderItem, RenderModel } from './renderModel';

/** Horizon half-length beyond the paper, pp (the canvas is unbounded). */
const HORIZON_REACH = 1e5;

const FAMILIES: Family[] = ['L', 'R', 'V'];

/** The finite VPs of a camera (a VP at infinity has none on the paper, PS-14). */
export function finiteVps(cam: Camera): { family: Family; point: Vec2 }[] {
  return FAMILIES.flatMap((family) => {
    const vp = vanishingPoint(cam, family);
    return vp.w === 0 ? [] : [{ family, point: { x: vp.x / vp.w, y: vp.y / vp.w } }];
  });
}

export function deriveGuides(cam: Camera, paper: Paper, display: DisplayOptions): RenderItem[] {
  const items: RenderItem[] = [];
  if (display.paperFrame) {
    items.push({ key: 'paper', role: 'paper', points: [0, 0, paper.width, 0, paper.width, paper.height, 0, paper.height], closed: true });
  }
  if (!display.guides) return items;
  const h = horizonOf(cam);
  if (h !== null) items.push({ key: 'horizon', role: 'horizon', points: [-HORIZON_REACH, h, paper.width + HORIZON_REACH, h] });
  for (const { family, point } of finiteVps(cam)) items.push({ key: `vp:${family}`, role: 'vp', family, points: [point.x, point.y] });
  return items;
}

/** Options that are UI state, not document data. */
export interface DeriveOptions {
  /** Working plane height (PL-01), or null. */
  workingPlane?: number | null;
}

interface CacheEntry {
  eye: Eye;
  display: DisplayOptions;
  selected: boolean;
  items: RenderItem[];
}

/** Per-entity memo keyed by (entity reference, eye reference) (§8.3). */
export type DeriveCache = WeakMap<Entity, CacheEntry>;
export const newDeriveCache = (): DeriveCache => new WeakMap();

function deriveEntity(e: Entity, ctx: DeriveCtx, cache?: DeriveCache): RenderItem[] {
  const hit = cache?.get(e);
  if (hit && hit.eye === ctx.eye && hit.display === ctx.display && hit.selected === ctx.selected) return hit.items;
  const def = 'unknown' in e ? undefined : kindOf(e.kind);
  const items = def ? def.derive(e as KnownEntity, ctx) : [];
  cache?.set(e, { eye: ctx.eye, display: ctx.display, selected: ctx.selected, items });
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
  const ctx: DeriveCtx = { cam, eye: doc.eye, display, selected: false };
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
  const cam = cameraFromEye(doc.eye);
  const items = deriveGuides(cam, doc.paper, display);
  if (display.floorGrid) items.push(...planeGrid(cam, 0, 'grid'));
  if (opts.workingPlane !== null && opts.workingPlane !== undefined) items.push(...planeGrid(cam, opts.workingPlane, 'work', 6, 1).map((i) => ({ ...i, data: { ...i.data, working: 1 } })));
  if (display.coneOfVision) items.push(coneOfVision(cam));
  if (display.guides) items.push(...originMarker(cam));
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    if (layer.role === 'objects' && !display.objects) continue;
    for (const e of drawOrder(doc, layer.id, cam, display)) {
      const ctx: DeriveCtx = { cam, eye: doc.eye, display, selected: selection.has(e.id) };
      for (const it of deriveEntity(e, ctx, cache)) {
        items.push({ ...it, data: { ...it.data, layer: layer.id, layerOpacity: layer.opacity } });
      }
    }
  }
  return { items, bounds: paperBounds(doc.paper) };
}

export const paperBounds = (paper: Paper): Rect => ({ x: 0, y: 0, width: paper.width, height: paper.height });

/** Paper plus every finite VP and the ground point (fit to all, CV-01 / PS-05). */
export function allBounds(cam: Camera, paper: Paper): Rect {
  const pts: Vec2[] = [
    { x: 0, y: 0 },
    { x: paper.width, y: paper.height },
    ...finiteVps(cam).map((v) => v.point),
  ];
  const origin = project(cam, v3(0, 0, 0));
  if (origin) pts.push(origin);
  return boundsOf(pts);
}
