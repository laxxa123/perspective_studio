// Ordinary WordPress posts into tiles (PUBLISH §11.3): the post read as a
// story, in its own order — a cover tile (featured picture and title), each
// picture on its own tile with its caption, and the text flowed onto
// reading tiles (headings larger, lists as bullets). Text formatting
// (bold, italic, links) is not kept. Every tile is marked as coming from an
// ordinary post (a red dot) until it is republished. Pure.
import { textHeight, wrapText, type Measure } from './layout';
import { createTile, newId } from './tile';
import type { ImageElement, TextElement, TileDocument } from './types';
import { MARGIN, TILE_H, TILE_W } from './types';

/** A piece of a post, in reading order. */
export type Block = { kind: 'heading' | 'para' | 'item' | 'quote'; text: string } | { kind: 'image'; id: number | null; src: string; caption: string };

/** A picture block once it is on the phone. */
export type Picture = { mediaId: string; width: number; height: number; caption?: string };
export type StoryBlock = Exclude<Block, { kind: 'image' }> | ({ kind: 'image' } & Picture);

const CAPTION = 28;
const BODY = 36;
const HEADING = 52;
const TITLE = 64;
const INNER_W = TILE_W - 2 * MARGIN;
const INNER_H = TILE_H - 2 * MARGIN;
const TEXT: Record<'heading' | 'para' | 'item' | 'quote' | 'title', { size: number; weight: number; lh: number }> = {
  title: { size: TITLE, weight: 700, lh: 1.2 },
  heading: { size: HEADING, weight: 700, lh: 1.25 },
  para: { size: BODY, weight: 400, lh: 1.5 },
  item: { size: BODY, weight: 400, lh: 1.5 },
  quote: { size: BODY, weight: 300, lh: 1.5 },
};

const text = (t: string, x: number, y: number, w: number, size: number, weight: number, lh: number, h: number, align: TextElement['align'] = 'left'): TextElement => ({
  id: newId('txt'),
  kind: 'text',
  text: t,
  font: 'Roboto',
  weight,
  size,
  color: '#111111',
  align,
  lineHeight: lh,
  letterSpacing: 0,
  x: x / TILE_W,
  y: y / TILE_H,
  w: w / TILE_W,
  h: h / TILE_H,
  rotation: 0,
  opacity: 1,
});

/** A picture fitted into a box (document px), centred horizontally, from its top. */
function fitted(p: Picture, x: number, y: number, w: number, h: number): ImageElement {
  const aspect = p.width / Math.max(1, p.height);
  let pw = w;
  let ph = pw / aspect;
  if (ph > h) {
    ph = h;
    pw = ph * aspect;
  }
  return { id: newId('img'), kind: 'image', mediaId: p.mediaId, crop: { x: 0, y: 0, w: 1, h: 1 }, x: (x + (w - pw) / 2) / TILE_W, y: y / TILE_H, w: pw / TILE_W, h: ph / TILE_H, rotation: 0, opacity: 1 };
}

/** The tiles for an ordinary post. */
export function storyTiles(p: { title: string; featured?: Picture; blocks: StoryBlock[] }, measure: Measure): TileDocument[] {
  const base = p.title.trim().slice(0, 40) || 'Imported';
  const out: TileDocument[] = [];
  const tile = (label: string) => {
    const t: TileDocument = { ...createTile(`${base} · ${label}`), meta: { legacy: 'wp' } };
    out.push(t);
    return t;
  };
  const lines = (s: string, size: number) => wrapText(s, INNER_W, size, 0, measure);

  // Cover: the featured picture, then the title under it.
  const titleLines = p.title.trim() ? lines(p.title.trim(), TITLE) : [];
  const titleH = titleLines.length ? textHeight(titleLines.length, TITLE, TEXT.title.lh) : 0;
  if (p.featured || titleLines.length) {
    const cover = tile('cover');
    let y = MARGIN;
    if (p.featured) {
      const img = fitted(p.featured, MARGIN, y, INNER_W, INNER_H - titleH - (titleH ? 40 : 0));
      cover.elements.push(img);
      y += img.h * TILE_H + 40;
    }
    if (titleLines.length) cover.elements.push(text(titleLines.join('\n'), MARGIN, y, INNER_W, TITLE, 700, TEXT.title.lh, titleH));
  }

  // Text flows onto reading tiles; a picture takes a tile of its own.
  const cur: { tile: TileDocument | null; y: number } = { tile: null, y: MARGIN };
  let pages = 0;
  const place = (ls: string[], k: keyof typeof TEXT) => {
    const { size, weight, lh } = TEXT[k];
    let rest = ls;
    while (rest.length) {
      if (!cur.tile) {
        cur.tile = tile(`text ${++pages}`);
        cur.y = MARGIN;
      }
      const fit = Math.floor((MARGIN + INNER_H - cur.y) / (size * lh));
      if (fit <= 0) {
        cur.tile = null;
        continue;
      }
      const chunk = rest.slice(0, fit);
      rest = rest.slice(fit);
      const h = textHeight(chunk.length, size, lh);
      cur.tile.elements.push(text(chunk.join('\n'), MARGIN, cur.y, INNER_W, size, weight, lh, h));
      cur.y += h + size * 0.7;
      if (rest.length) cur.tile = null;
    }
  };
  let pictures = 0;
  for (const b of p.blocks) {
    if (b.kind === 'image') {
      cur.tile = null;
      const t = tile(`picture ${++pictures}`);
      const cap = b.caption?.trim() ? lines(b.caption.trim(), CAPTION).slice(0, 6) : [];
      const capH = cap.length ? textHeight(cap.length, CAPTION, 1.3) : 0;
      const img = fitted(b, MARGIN, MARGIN, INNER_W, INNER_H - capH - (capH ? 24 : 0));
      // The picture and its caption sit together in the middle of the tile.
      const total = img.h * TILE_H + (capH ? capH + 24 : 0);
      const top = MARGIN + (INNER_H - total) / 2;
      img.y = top / TILE_H;
      t.elements.push(img);
      if (cap.length) t.elements.push(text(cap.join('\n'), MARGIN, top + img.h * TILE_H + 24, INNER_W, CAPTION, 400, 1.3, capH, 'center'));
      continue;
    }
    const s = b.kind === 'item' ? `• ${b.text}` : b.kind === 'quote' ? `“${b.text}”` : b.text;
    if (s.trim()) place(lines(s.trim(), TEXT[b.kind].size), b.kind);
  }
  return out;
}

// ----- reading post HTML -----

/** Plain text from an HTML fragment (tags and entities removed, line breaks kept). */
export function plain(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function imageOf(tag: string, caption: string): Block | null {
  const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!src) return null;
  const id = tag.match(/wp-image-(\d+)/)?.[1];
  return { kind: 'image', id: id ? Number(id) : null, src, caption };
}

/**
 * The post body as blocks, in order: pictures (with their figure caption),
 * headings, paragraphs, list items and quotes. Text outside any block (a
 * classic-editor post stores bare text) is split into paragraphs at blank
 * lines.
 */
export function htmlBlocks(html: string): Block[] {
  const out: Block[] = [];
  const loose = (s: string) => {
    for (const para of s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').split(/\n\s*\n/)) {
      const t = plain(para);
      if (t) out.push({ kind: 'para', text: t });
    }
  };
  // Innermost figures (a gallery's figures hold one picture each), single images, text blocks.
  const re = /<figure\b[^>]*>((?:(?!<figure\b)[\s\S])*?)<\/figure>|<img\b[^>]*>|<(h[1-6]|p|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\2>/gi;
  let at = 0;
  for (const m of html.matchAll(re)) {
    loose(html.slice(at, m.index));
    at = m.index! + m[0].length;
    if (m[1] !== undefined) {
      const img = m[1].match(/<img\b[^>]*>/i)?.[0];
      const cap = plain(m[1].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '');
      const b = img ? imageOf(img, cap) : null;
      if (b) out.push(b);
      else if (plain(m[1])) out.push({ kind: 'para', text: plain(m[1]) });
      continue;
    }
    if (!m[2]) {
      const b = imageOf(m[0], '');
      if (b) out.push(b);
      continue;
    }
    const inner = m[3];
    // A paragraph may hold a picture (classic editor): the picture, then its text.
    for (const img of inner.match(/<img\b[^>]*>/gi) ?? []) {
      const b = imageOf(img, '');
      if (b) out.push(b);
    }
    const t = plain(inner);
    if (!t) continue;
    const tag = m[2].toLowerCase();
    out.push({ kind: tag.startsWith('h') ? 'heading' : tag === 'li' ? 'item' : tag === 'blockquote' ? 'quote' : 'para', text: t });
  }
  loose(html.slice(at));
  return out;
}

/** A picture's file name without WordPress's size suffix (`-300x200`), for finding it by name. */
export const baseName = (src: string) =>
  decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-\d+x\d+$/, '')
    .replace(/-scaled$/, '');
