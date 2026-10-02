// WP Studio posts into tiles (PUBLISH §11.3): a `_wpstudio_manifest`
// (schema `wpstudio.post`, versions 1–3) becomes CREATIVE tiles with the
// same look. Every tile becomes 9:16 — the old tile is fitted inside it
// whole and the rest is its background colour. Rows keep one or two tiles;
// longer rows are split into pairs (a tile left over gets a full row).
// Pictures keep their box, trim and turn; text stays live text with its
// type settings; the flattened decorations (labels, spirals, shapes,
// drawings) become one drawing layer that is not editable as such. Pure:
// picture sizes come from the caller.
import type { Layout, Row } from './postLayout';
import { DEFAULT_BACKGROUND, TILE_SCHEMA } from './tile';
import type { ImageElement, PaintElement, TextElement, TileDocument, TileElement } from './types';
import { TILE_H, TILE_W } from './types';

type J = Record<string, unknown>;
const obj = (v: unknown): J | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : null);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Attachment ids the post needs: photos (placed pictures) and overlays (flattened layers). */
export interface StudioMedia {
  photos: number[];
  overlays: number[];
}

export interface StudioPost {
  version: number;
  rows: number[];
  tiles: J[];
}

/** Reads a WP Studio manifest (JSON string or object); null when it is not one. */
export function readStudio(raw: unknown): StudioPost | null {
  let d: unknown = raw;
  if (typeof raw === 'string') {
    try {
      d = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const m = obj(d);
  if (!m || m.schema !== 'wpstudio.post') return null;
  const version = num(m.version, 0);
  if (![1, 2, 3].includes(version)) return null;
  const tiles = (Array.isArray(m.tiles) ? m.tiles : [m]).map(obj).filter((t): t is J => !!t);
  const rowsIn = obj(m.layout)?.rows;
  const rows = Array.isArray(rowsIn) ? rowsIn.map((r) => Math.max(1, Math.round(num(obj(r)?.count, 1)))) : tiles.map(() => 1);
  return { version, rows, tiles };
}

const mediaId = (v: unknown) => Math.round(num(obj(v)?.mediaId, 0));

export function studioMedia(p: StudioPost): StudioMedia {
  const photos: number[] = [];
  const overlays: number[] = [];
  const add = (list: number[], id: number) => id > 0 && !list.includes(id) && list.push(id);
  for (const t of p.tiles) {
    if (p.version === 3) for (const im of Array.isArray(t.images) ? t.images : []) add(photos, mediaId(im));
    else add(photos, mediaId(t.photo));
    add(overlays, mediaId(p.version === 1 ? t.background : t.overlay));
  }
  return { photos, overlays };
}

/** `objectPosition` → fractions (CSS keywords or percentages). */
export function objectPosition(v: unknown): [number, number] {
  const words: Record<string, number> = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
  const parts = str(v, '50% 50%').trim().split(/\s+/);
  const one = (s: string | undefined) => (s === undefined ? 0.5 : s in words ? words[s] : s.endsWith('%') ? clamp01(num(s.slice(0, -1), 50) / 100) : 0.5);
  if (parts.length === 1 && (parts[0] === 'top' || parts[0] === 'bottom')) return [0.5, one(parts[0])];
  if (parts[0] === 'top' || parts[0] === 'bottom') return [one(parts[1]), one(parts[0])];
  return [one(parts[0]), one(parts[1])];
}

/** A box (document px) in the fitted 9:16 tile. */
interface Px {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A placed picture: its box and the trim that shows what the old tile
 * showed. `cover` crops to the box at the focal point, zoomed by `scale`;
 * `contain` shrinks the box to the picture; `fill` (stretch) is shown as a
 * centred cover, since tiles never stretch pictures.
 */
export function placePicture(box: Px, img: { width: number; height: number }, fit: string, pos: [number, number], scale: number): { box: Px; crop: ImageElement['crop'] } {
  const ai = img.width / Math.max(1, img.height);
  const ab = box.w / Math.max(1e-6, box.h);
  let b = { ...box };
  let crop = { x: 0, y: 0, w: 1, h: 1 };
  if (fit === 'contain') {
    const w = ai > ab ? box.w : box.h * ai;
    const h = ai > ab ? box.w / ai : box.h;
    b = { x: box.x + (box.w - w) * pos[0], y: box.y + (box.h - h) * pos[1], w, h };
  } else {
    const p = fit === 'fill' ? ([0.5, 0.5] as [number, number]) : pos;
    const cw = ai > ab ? ab / ai : 1;
    const ch = ai > ab ? 1 : ai / ab;
    crop = { x: (1 - cw) * p[0], y: (1 - ch) * p[1], w: cw, h: ch };
  }
  const k = scale > 0 ? scale : 1;
  if (k > 1 && fit !== 'contain') {
    // Zoom about the middle of what shows.
    const w = crop.w / k;
    const h = crop.h / k;
    crop = { x: crop.x + (crop.w - w) / 2, y: crop.y + (crop.h - h) / 2, w, h };
  } else if (Math.abs(k - 1) > 1e-6) {
    // Smaller (or a zoomed contain): the picture's box shrinks / grows about its centre.
    b = { x: b.x + (b.w * (1 - k)) / 2, y: b.y + (b.h * (1 - k)) / 2, w: b.w * k, h: b.h * k };
  }
  return { box: b, crop };
}

/** Old row counts → rows of one or two tile slots (index into the tiles), in order. */
export function splitRows(rows: number[], tiles: number): (number | null)[][] {
  const out: (number | null)[][] = [];
  let slot = 0;
  for (const count of rows) {
    const ids: number[] = [];
    for (let i = 0; i < count; i++, slot++) if (slot < tiles) ids.push(slot);
    for (let i = 0; i < ids.length; i += 2) out.push(ids.length - i >= 2 ? [ids[i], ids[i + 1]] : [ids[i]]);
  }
  // Tiles beyond the rows (a malformed layout) each get a row.
  for (; slot < tiles; slot++) out.push([slot]);
  return out;
}

export interface StudioResolve {
  /** The phone's copy of a photo (media id and pixel size), or null when it is gone. */
  photo(wpMediaId: number): { id: string; width: number; height: number } | null;
}

/**
 * The tiles of a WP Studio post. Overlays become drawings whose `assetId`
 * is `wp:<attachment id>` and whose box is where the old layer sat; the
 * caller turns each into a full-tile drawing (`fitOverlay`).
 */
export function studioTiles(p: StudioPost, r: StudioResolve, opts: { postId: number; title: string; now?: Date }): { tiles: TileDocument[]; layout: Layout } {
  const iso = (opts.now ?? new Date()).toISOString();
  const base = opts.title.trim().slice(0, 40) || 'Imported';
  const tiles = p.tiles.map((t, ti): TileDocument => {
    const W = num(t.width, TILE_W) > 0 ? num(t.width, TILE_W) : TILE_W;
    const H = num(t.height, TILE_H) > 0 ? num(t.height, TILE_H) : TILE_H;
    const s = Math.min(TILE_W / W, TILE_H / H);
    const ox = (TILE_W - W * s) / 2;
    const oy = (TILE_H - H * s) / 2;
    const px = (f: J | null, full = false): Px =>
      full || !f ? { x: ox, y: oy, w: W * s, h: H * s } : { x: ox + num(f.x, 0) * W * s, y: oy + num(f.y, 0) * H * s, w: Math.max(1, num(f.width, 1) * W * s), h: Math.max(1, num(f.height, 1) * H * s) };
    const norm = (b: Px) => ({ x: b.x / TILE_W, y: b.y / TILE_H, w: b.w / TILE_W, h: b.h / TILE_H });
    const used = new Set<string>();
    const idOf = (raw: unknown, prefix: string, i: number) => {
      let id = `${prefix}-${str(raw).replace(/[^A-Za-z0-9_-]/g, '') || i}`;
      while (used.has(id)) id += 'x';
      used.add(id);
      return id;
    };

    const picture = (f: J, i: number, full: boolean): ImageElement | null => {
      const id = mediaId(f);
      const m = id ? r.photo(id) : null;
      if (!m) return null;
      const fit = ['cover', 'contain', 'fill'].includes(str(f.fit)) ? str(f.fit) : 'cover';
      const placed = placePicture(px(f, full), m, fit, objectPosition(f.objectPosition), num(f.scale, 1));
      return { id: idOf(f.id, 'img', i), kind: 'image', mediaId: m.id, crop: placed.crop, ...norm(placed.box), rotation: num(f.rotation, 0), opacity: 1 };
    };
    const overlay = (f: unknown): PaintElement | null => {
      const id = mediaId(f);
      return id ? { id: idOf('overlay', 'drw', 0), kind: 'paint', assetId: `wp:${id}`, ...norm(px(null, true)), rotation: 0, opacity: 1 } : null;
    };
    const text = (f: J, i: number): TextElement | null => {
      const t2 = str(f.text, str(f.content));
      if (!t2.trim()) return null;
      const fam = str(f.fontFamily, 'Roboto');
      const font = /madi/i.test(fam) || /madi/i.test(str(f.cssFontFamily)) ? 'Ms Madi' : 'Roboto';
      const align = ['left', 'center', 'right'].includes(str(f.alignment)) ? (str(f.alignment) as TextElement['align']) : 'left';
      return {
        id: idOf(f.id, 'txt', i),
        kind: 'text',
        text: t2,
        font,
        weight: font === 'Ms Madi' ? 400 : Math.max(100, Math.min(900, Math.round(num(f.fontWeight, 400) / 100) * 100)),
        size: Math.max(1, num(f.fontSize, 32) * s),
        color: str(f.color, '#111111') || '#111111',
        align,
        lineHeight: num(f.lineHeight, 1.2) > 0 ? num(f.lineHeight, 1.2) : 1.2,
        letterSpacing: num(f.letterSpacing, 0) * s,
        ...norm(px(f)),
        rotation: num(f.rotation, 0),
        opacity: clamp01(num(f.opacity, 1)),
      };
    };

    const elements: (TileElement | null)[] = [];
    if (p.version === 3) {
      elements.push(overlay(t.overlay));
      (Array.isArray(t.images) ? t.images : []).forEach((im, i) => elements.push(obj(im) ? picture(obj(im)!, i, false) : null));
    } else {
      if (p.version === 2 && obj(t.photo)) elements.push(picture(obj(t.photo)!, 0, true));
      elements.push(overlay(p.version === 1 ? t.background : t.overlay));
    }
    (Array.isArray(t.textOverlays) ? t.textOverlays : []).forEach((o, i) => elements.push(obj(o) ? text(obj(o)!, i) : null));

    const bg = str(t.backgroundColor);
    return {
      schema: TILE_SCHEMA,
      id: `wps-${opts.postId}-${str(t.tileId).replace(/[^A-Za-z0-9_-]/g, '') || ti + 1}`,
      name: `${base} · ${ti + 1}`,
      createdAt: iso,
      updatedAt: iso,
      canvas: { width: TILE_W, height: TILE_H, background: /^#[0-9a-fA-F]{3,8}$|^rgba?\(/.test(bg) ? bg : DEFAULT_BACKGROUND },
      elements: elements.filter((e): e is TileElement => !!e),
      meta: { legacy: 'wpstudio' },
    };
  });
  const layout: Layout = splitRows(p.rows, tiles.length).map((row): Row => (row.length === 2 ? { kind: 'half', left: tiles[row[0]!].id, right: tiles[row[1]!].id } : { kind: 'full', id: tiles[row[0]!].id }));
  return { tiles, layout };
}

/** Where an overlay sat in its fitted tile (document px), for drawing it into a full-tile layer. */
export function overlayBox(e: PaintElement): Px {
  return { x: e.x * TILE_W, y: e.y * TILE_H, w: e.w * TILE_W, h: e.h * TILE_H };
}
