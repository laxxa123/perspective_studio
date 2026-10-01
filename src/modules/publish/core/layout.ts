// Geometry for the tile editor (PUBLISH §6): element boxes, soft snapping,
// text wrapping, the spiral coil, trims and canonical media names. Pure;
// text measuring is passed in, so it runs the same in tests and on canvas.
import type { ImageElement, MediaAsset, TileElement } from './types';
import { MARGIN, TILE_H, TILE_W } from './types';

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Measure = (text: string, size: number) => number;

// ----- boxes (document px) -----

/** The element's unrotated box in document px. */
export const pxBox = (e: Pick<TileElement, 'x' | 'y' | 'w' | 'h'>): Box => ({ x0: e.x * TILE_W, y0: e.y * TILE_H, x1: (e.x + e.w) * TILE_W, y1: (e.y + e.h) * TILE_H });

/** The axis-aligned bounds of a rotated element, document px. */
export function bounds(e: Pick<TileElement, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Box {
  const b = pxBox(e);
  if (!e.rotation) return b;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const hw = (b.x1 - b.x0) / 2;
  const hh = (b.y1 - b.y0) / 2;
  const r = (e.rotation * Math.PI) / 180;
  const ex = Math.abs(hw * Math.cos(r)) + Math.abs(hh * Math.sin(r));
  const ey = Math.abs(hw * Math.sin(r)) + Math.abs(hh * Math.cos(r));
  return { x0: cx - ex, y0: cy - ey, x1: cx + ex, y1: cy + ey };
}

// ----- soft snapping (PUBLISH §6.4) -----

export interface SnapTargets {
  xs: number[];
  ys: number[];
}

/** Lines things align to: tile edges, safe margins, centre lines, and other elements' edges and centres. */
export function snapTargets(others: readonly TileElement[]): SnapTargets {
  const xs = [0, MARGIN, TILE_W / 2, TILE_W - MARGIN, TILE_W];
  const ys = [0, MARGIN, TILE_H / 2, TILE_H - MARGIN, TILE_H];
  for (const o of others) {
    const b = bounds(o);
    xs.push(b.x0, (b.x0 + b.x1) / 2, b.x1);
    ys.push(b.y0, (b.y0 + b.y1) / 2, b.y1);
  }
  return { xs, ys };
}

function nearest(values: number[], targets: number[], threshold: number): { d: number; at: number } | null {
  let best: { d: number; at: number } | null = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t };
    }
  }
  return best;
}

export interface Snap {
  dx: number;
  dy: number;
  /** The lines snapped to (for guides). */
  gx: number | null;
  gy: number | null;
}

/** Snaps a moving box: its left / centre / right to a vertical line, top / middle / bottom to a horizontal one. */
export function snapMove(b: Box, t: SnapTargets, threshold: number): Snap {
  const sx = nearest([b.x0, (b.x0 + b.x1) / 2, b.x1], t.xs, threshold);
  const sy = nearest([b.y0, (b.y0 + b.y1) / 2, b.y1], t.ys, threshold);
  return { dx: sx?.d ?? 0, dy: sy?.d ?? 0, gx: sx?.at ?? null, gy: sy?.at ?? null };
}

/** Snaps only the edges being dragged while resizing. */
export function snapEdges(b: Box, t: SnapTargets, threshold: number, edges: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }): Box & { gx: number | null; gy: number | null } {
  const out = { ...b, gx: null as number | null, gy: null as number | null };
  const pick = (v: number, ts: number[]) => nearest([v], ts, threshold);
  if (edges.left) {
    const s = pick(b.x0, t.xs);
    if (s) {
      out.x0 = s.at;
      out.gx = s.at;
    }
  }
  if (edges.right) {
    const s = pick(b.x1, t.xs);
    if (s) {
      out.x1 = s.at;
      out.gx = s.at;
    }
  }
  if (edges.top) {
    const s = pick(b.y0, t.ys);
    if (s) {
      out.y0 = s.at;
      out.gy = s.at;
    }
  }
  if (edges.bottom) {
    const s = pick(b.y1, t.ys);
    if (s) {
      out.y1 = s.at;
      out.gy = s.at;
    }
  }
  return out;
}

// ----- text (PUBLISH §6.2) -----

/** Word-wraps text to a width (explicit line breaks kept; an overlong word gets its own line). */
export function wrapText(text: string, maxWidth: number, size: number, letterSpacing: number, measure: Measure): string[] {
  const width = (s: string) => measure(s, size) + letterSpacing * Math.max(0, [...s].length - 1);
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = words[0];
    for (const w of words.slice(1)) {
      const next = `${line} ${w}`;
      if (width(next) <= maxWidth) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

/** Height of wrapped text, document px. */
export const textHeight = (lines: number, size: number, lineHeight: number) => Math.max(1, lines) * size * lineHeight;

// ----- spiral (PUBLISH §6.3) -----

export interface SpiralGlyph {
  ch: string;
  /** Centre, relative to the box's top-left, document px. */
  x: number;
  y: number;
  /** Radians (the coil's tangent). */
  angle: number;
  size: number;
}

/**
 * Lays text on a clockwise Archimedean coil running from the box edge (94 %
 * of its half-size) inward to the centre. Glyphs follow the true arc length,
 * stand on the exact tangent, keep their proportions, and scale linearly with
 * their distance from the centre (outer 100 % → inner `innerScale`).
 * Deterministic: same input, same glyphs. Text that does not fit is dropped.
 */
export function layoutSpiral(
  p: { text: string; size: number; letterSpacing: number; turns: number; innerScale: number; rotationOffset: number },
  w: number,
  h: number,
  measure: Measure,
): SpiralGlyph[] {
  const R = (Math.min(w, h) / 2) * 0.94;
  const total = Math.max(1, p.turns) * Math.PI * 2;
  const b = R / total;
  const cx = w / 2;
  const cy = h / 2;
  const theta0 = -Math.PI / 2 + (p.rotationOffset * Math.PI) / 180;
  const minR = Math.max(p.size * 0.6, R * 0.04);
  // Sample the coil and its arc length.
  const N = Math.max(400, Math.ceil(p.turns * 360));
  const pts: { x: number; y: number; r: number; th: number; s: number }[] = [];
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const t = (total * i) / N;
    const r = R - b * t;
    const th = theta0 + t;
    const x = cx + r * Math.cos(th);
    const y = cy + r * Math.sin(th);
    if (i) s += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
    pts.push({ x, y, r, th, s });
  }
  const at = (dist: number) => {
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].s < dist) lo = mid + 1;
      else hi = mid;
    }
    return pts[lo];
  };
  const scaleAt = (r: number) => p.innerScale + (1 - p.innerScale) * Math.max(0, Math.min(1, (r - minR) / Math.max(1e-6, R - minR)));
  const end = pts[pts.length - 1].s;
  const out: SpiralGlyph[] = [];
  let pos = 0;
  for (const ch of [...p.text.replace(/\s+/g, ' ')]) {
    const here = at(pos);
    if (here.r < minR) break;
    const size = p.size * scaleAt(here.r);
    const adv = measure(ch, size) + p.letterSpacing;
    const c = at(pos + adv / 2);
    if (pos + adv > end || c.r < minR) break;
    // Tangent of r = R − bθ: (−b cosθ − r sinθ, −b sinθ + r cosθ).
    const dx = -b * Math.cos(c.th) - c.r * Math.sin(c.th);
    const dy = -b * Math.sin(c.th) + c.r * Math.cos(c.th);
    if (ch !== ' ') out.push({ ch, x: c.x, y: c.y, angle: Math.atan2(dy, dx), size });
    pos += adv;
  }
  return out;
}

// ----- trimming (PUBLISH §5.2) -----

export type Crop = ImageElement['crop'];

/** The largest crop of the given aspect (w / h, in source px) centred on the current crop. */
export function cropToAspect(crop: Crop, aspect: number | null, img: { width: number; height: number }): Crop {
  if (!aspect) return crop;
  const iw = img.width;
  const ih = img.height;
  const cx = (crop.x + crop.w / 2) * iw;
  const cy = (crop.y + crop.h / 2) * ih;
  let w = iw;
  let h = w / aspect;
  if (h > ih) {
    h = ih;
    w = h * aspect;
  }
  const x = Math.max(0, Math.min(iw - w, cx - w / 2));
  const y = Math.max(0, Math.min(ih - h, cy - h / 2));
  return { x: x / iw, y: y / ih, w: w / iw, h: h / ih };
}

/** Keeps a crop inside the picture with a minimum size. */
export function clampCrop(c: Crop, min = 0.04): Crop {
  const w = Math.max(min, Math.min(1, c.w));
  const h = Math.max(min, Math.min(1, c.h));
  return { x: Math.max(0, Math.min(1 - w, c.x)), y: Math.max(0, Math.min(1 - h, c.y)), w, h };
}

/** After a trim: the element keeps its width and centre; its height follows the crop's aspect (no distortion). */
export function boxForCrop(e: ImageElement, crop: Crop, img: Pick<MediaAsset, 'width' | 'height'>): ImageElement {
  const aspect = (crop.w * img.width) / Math.max(1e-6, crop.h * img.height);
  const wPx = e.w * TILE_W;
  const hPx = wPx / aspect;
  const cy = (e.y + e.h / 2) * TILE_H;
  return { ...e, crop, h: hPx / TILE_H, y: (cy - hPx / 2) / TILE_H };
}

// ----- canonical media names (PUBLISH §5.1) -----

/** `<slug>-<yyyymmdd>-<hash6>.<ext>`: stable, readable, unique per content. */
export function canonicalName(fileName: string, hash: string, mime: string, date = new Date()): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  return `${slug(base) || 'image'}-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${hash.slice(0, 6)}.${extFor(mime)}`;
}

/** Renames the readable part only; the date and hash stay (the name stays unique and stable). */
export function renameCanonical(name: string, label: string): string {
  const m = name.match(/-(\d{8}-[0-9a-f]{6}\.[a-z0-9]+)$/);
  return m ? `${slug(label) || 'image'}-${m[1]}` : name;
}

export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');

export const extFor = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');
