// Tiles, view transform, guides and selection maths (SKETCH §4, §13, §15, §17). Pure.
import { cubeLines } from './grids';
import type { GuideModel } from './types';
import { DOC_H, DOC_W, TILE, TILES_X, TILES_Y } from './types';

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Pt = { x: number; y: number };

// ----- tiles -----

export const tileIndex = (tx: number, ty: number) => ty * TILES_X + tx;
export const tileXY = (i: number) => ({ tx: i % TILES_X, ty: Math.floor(i / TILES_X) });
/** Tile rectangle in document px (edge tiles are clipped to the canvas). */
export function tileRect(i: number): Rect {
  const { tx, ty } = tileXY(i);
  return { x0: tx * TILE, y0: ty * TILE, x1: Math.min(DOC_W, (tx + 1) * TILE), y1: Math.min(DOC_H, (ty + 1) * TILE) };
}

/** The tiles a document-space rectangle touches (dirty-tile tracking). */
export function tilesInRect(r: Rect): number[] {
  const tx0 = Math.max(0, Math.floor(r.x0 / TILE));
  const ty0 = Math.max(0, Math.floor(r.y0 / TILE));
  const tx1 = Math.min(TILES_X - 1, Math.floor((r.x1 - 1e-6) / TILE));
  const ty1 = Math.min(TILES_Y - 1, Math.floor((r.y1 - 1e-6) / TILE));
  const out: number[] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) out.push(tileIndex(tx, ty));
  return out;
}

export const unionRect = (a: Rect | null, b: Rect): Rect => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b });

// ----- view (pan / zoom, SKETCH §4) -----

/** Screen = doc × scale + offset (CSS px). */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 16;

export function fitView(w: number, h: number, margin = 12): View {
  const scale = Math.min((w - 2 * margin) / DOC_W, (h - 2 * margin) / DOC_H);
  return { scale, x: (w - DOC_W * scale) / 2, y: (h - DOC_H * scale) / 2 };
}

/** 100 %: one document pixel per device pixel, centred on the screen centre's document point. */
export function actualSizeView(v: View, w: number, h: number, dpr: number): View {
  const c = toDoc(v, { x: w / 2, y: h / 2 });
  const scale = 1 / dpr;
  return { scale, x: w / 2 - c.x * scale, y: h / 2 - c.y * scale };
}

export const toDoc = (v: View, p: Pt): Pt => ({ x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale });
export const toScreen = (v: View, p: Pt): Pt => ({ x: p.x * v.scale + v.x, y: p.y * v.scale + v.y });

/** A two-finger gesture: the document point under the first midpoint follows the new midpoint; distance ratio zooms. */
export function pinch(start: View, a0: Pt, b0: Pt, a1: Pt, b1: Pt): View {
  const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
  const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y) || 1;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * (d1 / d0)));
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const anchor = toDoc(start, m0);
  return { scale, x: m1.x - anchor.x * scale, y: m1.y - anchor.y * scale };
}

export function zoomAt(v: View, at: Pt, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const d = toDoc(v, at);
  return { scale, x: at.x - d.x * scale, y: at.y - d.y * scale };
}

// ----- guides (SKETCH §13) -----

export type Segment = [number, number, number, number];

/** Rays from a point through evenly spaced directions, clipped generously beyond the canvas. */
function fan(o: Pt, n: number, reach: number, spread = Math.PI * 2): Segment[] {
  const out: Segment[] = [];
  const toCentre = Math.atan2(DOC_H / 2 - o.y, DOC_W / 2 - o.x);
  const start = spread >= Math.PI * 2 ? 0 : toCentre - spread / 2;
  const count = spread >= Math.PI * 2 ? n * 2 : n;
  for (let i = 0; i <= count; i++) {
    const a = start + (spread * i) / count;
    out.push([o.x, o.y, o.x + Math.cos(a) * reach, o.y + Math.sin(a) * reach]);
  }
  return out;
}

/** Spread of a VP's fan so it covers the canvas. */
function spreadFor(o: Pt): number {
  const corners = [
    [0, 0],
    [DOC_W, 0],
    [0, DOC_H],
    [DOC_W, DOC_H],
  ].map(([x, y]) => Math.atan2(y - o.y, x - o.x));
  const c = Math.atan2(DOC_H / 2 - o.y, DOC_W / 2 - o.x);
  const rel = corners.map((a) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))));
  return Math.min(Math.PI * 2, Math.max(...rel) * 2 + 0.2);
}

/** The guide lines in document px. */
export function guideSegments(g: GuideModel): Segment[] {
  const reach = (DOC_W + DOC_H) * 3;
  switch (g.type) {
    case 'none':
      return [];
    case 'cube':
      return [...cubeLines()];
    case 'thirds':
      return [
        [DOC_W / 3, 0, DOC_W / 3, DOC_H],
        [(2 * DOC_W) / 3, 0, (2 * DOC_W) / 3, DOC_H],
        [0, DOC_H / 3, DOC_W, DOC_H / 3],
        [0, (2 * DOC_H) / 3, DOC_W, (2 * DOC_H) / 3],
      ];
    case '1pt': {
      const out: Segment[] = [[-reach, g.horizonY, reach, g.horizonY], ...fan(g.vp1, g.density, reach)];
      // Horizontal and vertical lines for the front planes.
      for (let i = 1; i < 6; i++) out.push([0, (DOC_H * i) / 6, DOC_W, (DOC_H * i) / 6]);
      return out;
    }
    case '2pt':
      return [[-reach, g.horizonY, reach, g.horizonY], ...fan(g.vp1, g.density, reach, spreadFor(g.vp1)), ...fan(g.vp2, g.density, reach, spreadFor(g.vp2))];
    case '3pt':
      return [
        [-reach, g.horizonY, reach, g.horizonY],
        ...fan(g.vp1, g.density, reach, spreadFor(g.vp1)),
        ...fan(g.vp2, g.density, reach, spreadFor(g.vp2)),
        ...fan(g.vp3, g.density, reach, spreadFor(g.vp3)),
      ];
  }
}

/** Clips a segment to a rectangle (Liang–Barsky); null when it misses. */
export function clipSegment(s: Segment, r: Rect): Segment | null {
  const [x0, y0, x1, y1] = s;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x0 - r.x0],
    [dx, r.x1 - x0],
    [-dy, y0 - r.y0],
    [dy, r.y1 - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
}

/** Guide lines clipped to the page (guides belong to the sheet, not the desk around it). */
export function pageGuideSegments(g: GuideModel): Segment[] {
  const page = { x0: 0, y0: 0, x1: DOC_W, y1: DOC_H };
  return guideSegments(g)
    .map((s) => clipSegment(s, page))
    .filter((s): s is Segment => s !== null);
}

export type GuideHandle = 'horizon' | 'vp1' | 'vp2' | 'vp3';

/** Draggable guide handles for the grid type, in document px. */
export function guideHandles(g: GuideModel): { id: GuideHandle; at: Pt }[] {
  if (g.type === 'none' || g.type === 'thirds' || g.type === 'cube') return [];
  const hs: { id: GuideHandle; at: Pt }[] = [{ id: 'vp1', at: g.vp1 }];
  if (g.type !== '1pt') hs.push({ id: 'vp2', at: g.vp2 });
  if (g.type === '3pt') hs.push({ id: 'vp3', at: g.vp3 });
  return hs;
}

/** Moves a guide handle; VPs on the horizon move the horizon with them (it is their shared eye level). */
export function moveGuide(g: GuideModel, id: GuideHandle, p: Pt): GuideModel {
  if (id === 'horizon') return { ...g, horizonY: p.y, vp1: { ...g.vp1, y: p.y }, vp2: { ...g.vp2, y: p.y } };
  if (id === 'vp3') return { ...g, vp3: { x: p.x, y: p.y } };
  return { ...g, horizonY: p.y, vp1: id === 'vp1' ? p : { ...g.vp1, y: p.y }, vp2: id === 'vp2' ? p : { ...g.vp2, y: p.y } };
}

// ----- selection (SKETCH §15) -----

export function polygonBounds(pts: Pt[]): Rect {
  return pts.reduce<Rect>((r, p) => ({ x0: Math.min(r.x0, p.x), y0: Math.min(r.y0, p.y), x1: Math.max(r.x1, p.x), y1: Math.max(r.y1, p.y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
}

export function pointInPolygon(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A selection transform: translate, uniform scale and rotation about the selection's centre. */
export interface SelTransform {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

export const IDENTITY_SEL: SelTransform = { dx: 0, dy: 0, scale: 1, rotation: 0 };

/** Document-space matrix [a b c d e f] mapping the original pixels to their new place. */
export function selMatrix(t: SelTransform, centre: Pt): [number, number, number, number, number, number] {
  const c = Math.cos(t.rotation) * t.scale;
  const s = Math.sin(t.rotation) * t.scale;
  // p' = R·S·(p − centre) + centre + d
  return [c, s, -s, c, centre.x + t.dx - (c * centre.x - s * centre.y), centre.y + t.dy - (s * centre.x + c * centre.y)];
}

export function applyMatrix(m: [number, number, number, number, number, number], p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
