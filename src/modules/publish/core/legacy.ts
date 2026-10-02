// Old posts into tiles (PUBLISH §11.3): a post that was not made by PUBLISH
// (WP Studio's manifest posts, plain WordPress posts) becomes editable tiles
// for reference: every picture in one grid tile (more tiles past 12) with its
// caption under it, then the title and body text set for reading. Every tile
// is marked `legacy` (a red dot) until the post is republished. Pure.
import { textHeight, wrapText, type Measure } from './layout';
import { createTile, newId } from './tile';
import type { ImageElement, TextElement, TileDocument } from './types';
import { MARGIN, TILE_H, TILE_W } from './types';

export interface LegacyPost {
  title: string;
  images: { mediaId: string; width: number; height: number; caption?: string }[];
  /** Plain-text paragraphs of the body, in order. */
  paragraphs: string[];
}

const GAP = 24;
const CAPTION = 26;
const BODY = 36;
const HEADING = 64;
const PER_TILE = 12;
const INNER_W = TILE_W - 2 * MARGIN;
const INNER_H = TILE_H - 2 * MARGIN;

const text = (t: string, x: number, y: number, w: number, size: number, weight: number, h: number, align: TextElement['align'] = 'left'): TextElement => ({
  id: newId('txt'),
  kind: 'text',
  text: t,
  font: 'Roboto',
  weight,
  size,
  color: '#111111',
  align,
  lineHeight: size === BODY ? 1.5 : 1.25,
  letterSpacing: 0,
  x: x / TILE_W,
  y: y / TILE_H,
  w: w / TILE_W,
  h: h / TILE_H,
  rotation: 0,
  opacity: 1,
});

function imageTiles(p: LegacyPost, measure: Measure, base: string): TileDocument[] {
  const out: TileDocument[] = [];
  for (let s = 0; s < p.images.length; s += PER_TILE) {
    const group = p.images.slice(s, s + PER_TILE);
    const n = group.length;
    const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const cw = (INNER_W - GAP * (cols - 1)) / cols;
    const ch = (INNER_H - GAP * (rows - 1)) / rows;
    const t = { ...createTile(`${base} · pictures${p.images.length > PER_TILE ? ` ${s / PER_TILE + 1}` : ''}`), meta: { legacy: true } };
    group.forEach((im, i) => {
      const cx = MARGIN + (i % cols) * (cw + GAP);
      const cy = MARGIN + Math.floor(i / cols) * (ch + GAP);
      const capLines = im.caption ? wrapText(im.caption, cw, CAPTION, 0, measure).slice(0, 3) : [];
      const capH = capLines.length ? textHeight(capLines.length, CAPTION, 1.25) + 8 : 0;
      const room = { w: cw, h: Math.max(40, ch - capH) };
      const aspect = im.width / Math.max(1, im.height);
      let w = room.w;
      let h = w / aspect;
      if (h > room.h) {
        h = room.h;
        w = h * aspect;
      }
      const el: ImageElement = { id: newId('img'), kind: 'image', mediaId: im.mediaId, crop: { x: 0, y: 0, w: 1, h: 1 }, x: (cx + (cw - w) / 2) / TILE_W, y: cy / TILE_H, w: w / TILE_W, h: h / TILE_H, rotation: 0, opacity: 1 };
      t.elements.push(el);
      if (capLines.length) t.elements.push(text(capLines.join('\n'), cx, cy + h + 8, cw, CAPTION, 400, capH - 8, 'center'));
    });
    out.push(t);
  }
  return out;
}

function textTiles(p: LegacyPost, measure: Measure, base: string): TileDocument[] {
  const out: TileDocument[] = [];
  const cur: { tile: TileDocument | null } = { tile: null };
  let y = MARGIN;
  const fresh = () => {
    cur.tile = { ...createTile(`${base} · text ${out.length + 1}`), meta: { legacy: true } };
    out.push(cur.tile);
    y = MARGIN;
  };
  const place = (lines: string[], size: number, weight: number) => {
    const lh = size === BODY ? 1.5 : 1.25;
    let rest = lines;
    while (rest.length) {
      if (!cur.tile) fresh();
      const fit = Math.floor((MARGIN + INNER_H - y) / (size * lh));
      if (fit <= 0) {
        fresh();
        continue;
      }
      const chunk = rest.slice(0, fit);
      rest = rest.slice(fit);
      const h = textHeight(chunk.length, size, lh);
      cur.tile!.elements.push(text(chunk.join('\n'), MARGIN, y, INNER_W, size, weight, h));
      y += h + size * 0.8;
      if (rest.length) fresh();
    }
  };
  if (p.title.trim()) place(wrapText(p.title.trim(), INNER_W, HEADING, 0, measure), HEADING, 700);
  for (const para of p.paragraphs) if (para.trim()) place(wrapText(para.trim(), INNER_W, BODY, 0, measure), BODY, 400);
  return out;
}

/** The tiles for an old post: pictures first, then the text. */
export function legacyTiles(p: LegacyPost, measure: Measure): TileDocument[] {
  const base = p.title.trim().slice(0, 40) || 'Imported';
  return [...imageTiles(p, measure, base), ...textTiles(p, measure, base)];
}

/** Plain-text paragraphs from post HTML (block tags break paragraphs; tags and entities removed). */
export function htmlParagraphs(html: string): string[] {
  const decoded = html
    .replace(/<(script|style|figure)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, '’')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&hellip;|&#8230;/g, '…');
  return decoded
    .split(/\n\s*\n/)
    .map((s) => s.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

/** Picture references in post HTML: attachment ids (wp-image-N) and sources, in order. */
export function htmlImages(html: string): { id: number | null; src: string }[] {
  const out: { id: number | null; src: string }[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const id = tag.match(/wp-image-(\d+)/)?.[1];
    out.push({ id: id ? Number(id) : null, src });
  }
  return out;
}

/**
 * Pictures and text of a WP Studio post (`_wpstudio_manifest`, schema
 * `wpstudio.post` v1–3): every picture layer (photo, images, flattened
 * overlay / background) by attachment id, then every text overlay, tile by
 * tile. Null when the meta is not a WP Studio manifest.
 */
export function wpStudioContent(raw: unknown): { mediaIds: number[]; texts: string[] } | null {
  let d: unknown = raw;
  if (typeof raw === 'string') {
    try {
      d = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const m = d as { schema?: unknown; tiles?: unknown } | null;
  if (!m || typeof m !== 'object' || m.schema !== 'wpstudio.post') return null;
  const tiles = (Array.isArray(m.tiles) ? m.tiles : [m]) as Record<string, unknown>[];
  const mediaIds: number[] = [];
  const texts: string[] = [];
  const pic = (v: unknown) => {
    const id = Number((v as { mediaId?: unknown } | null)?.mediaId);
    if (id > 0 && !mediaIds.includes(id)) mediaIds.push(id);
  };
  for (const t of tiles) {
    if (!t || typeof t !== 'object') continue;
    pic(t.background);
    pic(t.photo);
    if (Array.isArray(t.images)) t.images.forEach(pic);
    pic(t.overlay);
    if (Array.isArray(t.textOverlays))
      for (const o of t.textOverlays as Record<string, unknown>[]) {
        const s = typeof o?.text === 'string' ? o.text : typeof o?.content === 'string' ? o.content : '';
        if (s.trim()) texts.push(s.trim());
      }
  }
  return { mediaIds, texts };
}
