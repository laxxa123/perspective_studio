// The post as stored on WordPress (PUBLISH §10): post meta `_creative_post`,
// schema `creative.publish.post` v1. Every tile travels whole — each element
// keeps its editable data, plus what the theme needs to rebuild it without
// guessing: pictures (photos, drawings, spirals) as their uploaded media with
// permanent ids, and text with its resolved lines. Nothing is flattened.
// Pull-back turns the same JSON into tiles again. Pure.
import type { Layout, Row } from './postLayout';
import { parseTile, TILE_SCHEMA } from './tile';
import type { TileDocument, TileElement } from './types';

export const POST_SCHEMA = 'creative.publish.post' as const;
export const POST_VERSION = 1;
/** The post meta key (registered by the studioview theme). */
export const POST_META_KEY = '_creative_post';

/** An uploaded picture. */
export interface MediaRef {
  wpMediaId: number;
  url: string;
  /** Permanent picture id (also inside the file). */
  uid: string;
  name: string;
  width: number;
  height: number;
}

export type PublishedRow = { full: string } | { left: string | null; right: string | null };

/** An element as published: its tile data + `media` (pictures) or `lines` + `cssFontFamily` (text). */
export type PublishedElement = TileElement & { media?: MediaRef; lines?: string[]; cssFontFamily?: string };

export interface PublishedTile {
  id: string;
  name: string;
  canvas: TileDocument['canvas'];
  meta: TileDocument['meta'];
  elements: PublishedElement[];
}

export interface PostMeta {
  schema: typeof POST_SCHEMA;
  version: typeof POST_VERSION;
  layout: PublishedRow[];
  /** The post's featured picture. */
  featured: { tileId: string; elementId: string; wpMediaId: number } | null;
  tiles: PublishedTile[];
}

/** Everything resolved at publish time, per element: its uploaded picture or its text lines. */
export interface Resolved {
  media(tile: TileDocument, e: TileElement): MediaRef | undefined;
  lines(tile: TileDocument, e: TileElement): string[] | undefined;
  font(e: TileElement): string | undefined;
}

const rowOut = (r: Row): PublishedRow => (r.kind === 'full' ? { full: r.id } : { left: r.left, right: r.right });
const rowIn = (r: PublishedRow): Row => ('full' in r ? { kind: 'full', id: r.full } : { kind: 'half', left: r.left, right: r.right });

/** Picks the post's featured picture: the first tile (in post order) with a chosen one, else the top picture of the first tile that has one. */
export function pickFeatured(tiles: readonly PublishedTile[]): PostMeta['featured'] {
  for (const t of tiles) {
    const id = t.meta.featured;
    const e = id ? t.elements.find((x) => x.id === id && x.media) : undefined;
    if (e?.media) return { tileId: t.id, elementId: e.id, wpMediaId: e.media.wpMediaId };
  }
  for (const t of tiles) {
    const pics = t.elements.filter((x) => x.kind === 'image' && x.media);
    const top = pics[pics.length - 1];
    if (top?.media) return { tileId: t.id, elementId: top.id, wpMediaId: top.media.wpMediaId };
  }
  return null;
}

/** Builds the post meta from the tiles (in layout order) and what was uploaded. */
export function buildPostMeta(layout: Layout, tiles: readonly TileDocument[], r: Resolved): PostMeta {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const ordered = layout.flatMap((row) => (row.kind === 'full' ? [row.id] : [row.left, row.right])).filter((id): id is string => !!id && byId.has(id));
  const out: PublishedTile[] = ordered.map((id) => {
    const t = byId.get(id)!;
    return {
      id: t.id,
      name: t.name,
      canvas: t.canvas,
      meta: t.meta,
      elements: t.elements.map((e) => {
        const media = r.media(t, e);
        const lines = e.kind === 'text' ? r.lines(t, e) : undefined;
        const font = e.kind === 'text' ? r.font(e) : undefined;
        // A picture is referred to by its permanent id, never by a device-local one.
        const base = e.kind === 'image' && media ? { ...e, mediaId: media.uid } : e.kind === 'paint' && media ? { ...e, assetId: media.uid } : e;
        return { ...base, ...(media ? { media } : {}), ...(lines ? { lines } : {}), ...(font ? { cssFontFamily: font } : {}) } as PublishedElement;
      }),
    };
  });
  return { schema: POST_SCHEMA, version: POST_VERSION, layout: layout.map(rowOut), featured: pickFeatured(out), tiles: out };
}

/** Reads post meta (a JSON string or object); throws on anything malformed or of another schema. */
export function parsePostMeta(raw: unknown): PostMeta {
  const d = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<PostMeta> | null;
  if (!d || d.schema !== POST_SCHEMA) throw new Error('Not a PUBLISH post');
  if (d.version !== POST_VERSION) throw new Error(`Unsupported post version ${String(d.version)}`);
  if (!Array.isArray(d.tiles) || !Array.isArray(d.layout)) throw new Error('Post has no tiles');
  for (const t of d.tiles) {
    // Every tile must be a valid tile once its publish-only fields are put aside.
    parseTile(asTileDoc(t, ''));
    for (const e of t.elements) {
      if ((e.kind === 'image' || e.kind === 'paint' || e.kind === 'spiral') && e.media && (typeof e.media.wpMediaId !== 'number' || typeof e.media.uid !== 'string')) throw new Error('Bad picture reference');
    }
  }
  return d as PostMeta;
}

function asTileDoc(t: PublishedTile, now: string): TileDocument {
  return {
    schema: TILE_SCHEMA,
    id: t.id,
    name: t.name,
    createdAt: now,
    updatedAt: now,
    canvas: t.canvas,
    meta: t.meta ?? {},
    elements: t.elements.map((e) => {
      const rest: Partial<PublishedElement> = { ...e };
      delete rest.media;
      delete rest.lines;
      delete rest.cssFontFamily;
      return rest as TileElement;
    }),
  };
}

/**
 * Tiles from a pulled post. `local(ref)` gives the device id for an uploaded
 * picture (media library id for photos, asset id for drawings), after the
 * caller has made sure the picture is on the device.
 */
export function tilesFromPost(meta: PostMeta, local: (ref: MediaRef, kind: 'image' | 'paint') => string, now = new Date()): { tiles: TileDocument[]; layout: Layout } {
  const iso = now.toISOString();
  const tiles = meta.tiles.map((t) => {
    const doc = asTileDoc(t, iso);
    doc.elements = doc.elements.map((e, i) => {
      const ref = t.elements[i].media;
      if (e.kind === 'image' && ref) return { ...e, mediaId: local(ref, 'image') };
      if (e.kind === 'paint' && ref) return { ...e, assetId: local(ref, 'paint') };
      return e;
    });
    return parseTile(doc);
  });
  return { tiles, layout: meta.layout.map(rowIn) };
}

/** Every uploaded picture a post uses. */
export const refsOf = (meta: PostMeta): MediaRef[] => meta.tiles.flatMap((t) => t.elements.flatMap((e) => (e.media ? [e.media] : [])));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The post body for readers that do not use the theme (feeds, other themes,
 * search): each tile's pictures and text, in order. The theme renders from
 * the meta, never from this.
 */
export function postContent(meta: PostMeta): string {
  const parts: string[] = [];
  for (const t of meta.tiles) {
    for (const e of t.elements) {
      if (e.media) parts.push(`<figure class="wp-block-image"><img src="${esc(e.media.url)}" alt="${esc(e.kind === 'spiral' ? e.text : '')}" class="wp-image-${e.media.wpMediaId}"/></figure>`);
      else if (e.kind === 'text' && e.text.trim()) parts.push(`<p>${esc(e.text).replace(/\n/g, '<br>')}</p>`);
    }
  }
  return parts.join('\n');
}
