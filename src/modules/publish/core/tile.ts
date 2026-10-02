// Tile documents: create, validate (zod) and edit (PUBLISH §4, §6). Every
// edit returns a new document, so undo is a list of documents.
import { z } from 'zod';
import type { FontFamily, ImageElement, MediaAsset, PaintElement, SpiralElement, TextElement, TileDocument, TileElement } from './types';
import { MARGIN, TILE_H, TILE_W } from './types';

export const TILE_SCHEMA = 'creative.publish.tile.v1' as const;
export const DEFAULT_BACKGROUND = '#f7f4ec';

let seq = 0;
export function newId(prefix: string): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createTile(name = 'Tile', now = new Date()): TileDocument {
  const iso = now.toISOString();
  return { schema: TILE_SCHEMA, id: newId('tile'), name, createdAt: iso, updatedAt: iso, canvas: { width: TILE_W, height: TILE_H, background: DEFAULT_BACKGROUND }, elements: [], meta: {} };
}

/** The CSS font stack for a family (bundled fonts first). */
export const fontStack = (f: FontFamily) => (f === 'Ms Madi' ? "'Ms Madi', cursive" : "'Roboto Variable', Roboto, sans-serif");

// ----- new elements (placed inside the safe margins) -----

const mx = MARGIN / TILE_W;

/** A picture fitted into the middle 80 % of the tile width, keeping its aspect. */
export function imageFor(media: Pick<MediaAsset, 'id' | 'width' | 'height'>): ImageElement {
  const aspect = media.width / Math.max(1, media.height);
  let w = 0.8;
  let h = (w * TILE_W) / aspect / TILE_H;
  if (h > 0.7) {
    h = 0.7;
    w = (h * TILE_H * aspect) / TILE_W;
  }
  return { id: newId('img'), kind: 'image', mediaId: media.id, crop: { x: 0, y: 0, w: 1, h: 1 }, x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, opacity: 1 };
}

export function textFor(text = 'Your text'): TextElement {
  const w = 1 - 2 * mx;
  return { id: newId('txt'), kind: 'text', text, font: 'Roboto', weight: 500, size: 72, color: '#111111', align: 'center', lineHeight: 1.2, letterSpacing: 0, x: mx, y: 0.42, w, h: 0.06, rotation: 0, opacity: 1 };
}

const SPIRAL_TEXT = 'Words turning inward, one after another, follow the line of the coil until the whole thought settles at its centre.';

/** A spiral: a square 40 % of the width, centred. */
export function spiralFor(text = SPIRAL_TEXT): SpiralElement {
  const w = 0.4;
  const h = (w * TILE_W) / TILE_H;
  return { id: newId('spr'), kind: 'spiral', text, font: 'Roboto', weight: 400, size: 22, color: '#111111', letterSpacing: 0, turns: 3, innerScale: 1, rotationOffset: 0, x: (1 - w) / 2, y: (1 - h) / 2, w, h, rotation: 0, opacity: 1 };
}

export function paintFor(assetId: string): PaintElement {
  return { id: newId('pnt'), kind: 'paint', assetId, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 };
}

// ----- edits -----

const touch = (t: TileDocument, elements: TileElement[]): TileDocument => ({ ...t, elements });

export function addElement(t: TileDocument, e: TileElement): TileDocument {
  return touch(t, [...t.elements, e]);
}

export function updateElement<E extends TileElement>(t: TileDocument, id: string, patch: Partial<Omit<E, 'id' | 'kind'>>): TileDocument {
  return touch(
    t,
    t.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as TileElement) : e)),
  );
}

export function removeElement(t: TileDocument, id: string): TileDocument {
  return touch(
    t,
    t.elements.filter((e) => e.id !== id),
  );
}

/** Moves an element in the stack: +1 up, −1 down, 'top', 'bottom'. */
export function restack(t: TileDocument, id: string, to: 1 | -1 | 'top' | 'bottom'): TileDocument {
  const i = t.elements.findIndex((e) => e.id === id);
  if (i < 0) return t;
  const n = t.elements.length;
  const j = to === 'top' ? n - 1 : to === 'bottom' ? 0 : Math.max(0, Math.min(n - 1, i + to));
  if (i === j) return t;
  const els = [...t.elements];
  const [e] = els.splice(i, 1);
  els.splice(j, 0, e);
  return touch(t, els);
}

/** A copy of an element, nudged down-right, placed just above it. */
export function duplicateElement(t: TileDocument, id: string): { tile: TileDocument; id: string | null } {
  const i = t.elements.findIndex((e) => e.id === id);
  if (i < 0) return { tile: t, id: null };
  const src = t.elements[i];
  const copy = { ...src, id: newId(src.kind.slice(0, 3)), x: src.x + 0.03, y: src.y + 0.03 * (TILE_W / TILE_H) } as TileElement;
  const els = [...t.elements];
  els.splice(i + 1, 0, copy);
  return { tile: touch(t, els), id: copy.id };
}

/** A copy of a whole tile under a new id (element ids are kept: they are tile-local). */
export function duplicateTile(t: TileDocument, now = new Date()): TileDocument {
  const iso = now.toISOString();
  return { ...structuredClone(t), id: newId('tile'), name: `${t.name} copy`, createdAt: iso, updatedAt: iso };
}

/** Media ids a tile uses. */
export const mediaOf = (t: TileDocument): string[] => [...new Set(t.elements.flatMap((e) => (e.kind === 'image' ? [e.mediaId] : [])))];
/** Private assets (paint) a tile uses. */
export const assetsOf = (t: TileDocument): string[] => t.elements.flatMap((e) => (e.kind === 'paint' ? [e.assetId] : []));

// ----- validation -----

const unit = z.number().min(0).max(1);
const box = { id: z.string().min(1), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), rotation: z.number(), opacity: unit, locked: z.boolean().optional() };
const font = z.enum(['Roboto', 'Ms Madi']);
const elementSchema = z.discriminatedUnion('kind', [
  z.object({ ...box, kind: z.literal('image'), mediaId: z.string().min(1), crop: z.object({ x: unit, y: unit, w: z.number().positive().max(1), h: z.number().positive().max(1) }) }),
  z.object({ ...box, kind: z.literal('text'), text: z.string(), font, weight: z.number().min(100).max(900), size: z.number().positive(), color: z.string(), align: z.enum(['left', 'center', 'right']), lineHeight: z.number().positive(), letterSpacing: z.number() }),
  z.object({ ...box, kind: z.literal('spiral'), text: z.string(), font, weight: z.number().min(100).max(900), size: z.number().positive(), color: z.string(), letterSpacing: z.number(), turns: z.number().min(1).max(6), innerScale: z.number().min(0.1).max(1), rotationOffset: z.number() }),
  z.object({ ...box, kind: z.literal('paint'), assetId: z.string().min(1) }),
]);

export const tileSchema = z.object({
  schema: z.literal(TILE_SCHEMA),
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  canvas: z.object({ width: z.literal(TILE_W), height: z.literal(TILE_H), background: z.string() }),
  elements: z.array(elementSchema),
  meta: z.object({ caption: z.string().optional(), featured: z.string().optional(), legacy: z.boolean().optional() }),
});

export function parseTile(raw: unknown): TileDocument {
  const t = tileSchema.parse(raw) as TileDocument;
  if (new Set(t.elements.map((e) => e.id)).size !== t.elements.length) throw new Error('Duplicate element ids');
  return t;
}
