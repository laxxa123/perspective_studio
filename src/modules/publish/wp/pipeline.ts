// Publishing and pulling back (PUBLISH §10–§11). Publish: sign in → check
// the theme → check nobody changed the post meanwhile → categories → every
// picture found on WordPress by its permanent id or uploaded under its
// canonical name → the post with its meta → old drawings / spirals removed →
// only then the tiles are cleared. Pull: the post's tiles and pictures come
// back onto the phone, ready to edit. Nothing on the phone is cleared until
// WordPress has confirmed the post.
import { publishName, type Measure } from '../core/layout';
import { readId, stampId, uidFromHash } from '../core/imageId';
import { baseName, htmlBlocks, storyTiles, type Picture, type StoryBlock } from '../core/legacy';
import { overlayBox, readStudio, studioMedia, studioTiles } from '../core/wpStudio';
import { buildPostMeta, parsePostMeta, postContent, POST_META_KEY, refsOf, tilesFromPost, type MediaRef, type PostMeta } from '../core/postMeta';
import { fromOrder, order, reconcile } from '../core/postLayout';
import { fontStack } from '../core/tile';
import type { MediaAsset, Origin, SpiralElement, TextElement, TileDocument, TileElement } from '../core/types';
import { emptyDraft, sha256, type PostDraft, type PostSummary, type PublishStore } from '../storage/PublishStore';
import { WpError, type WpClient, type WpPost } from './WpClient';

export const LEGACY_META_KEY = '_wpstudio_manifest';

export interface Deps {
  store: PublishStore;
  wp: WpClient;
  /** A spiral drawn into its own box (unturned, full opacity) as a transparent PNG. */
  spiralPng(e: SpiralElement): Promise<Blob>;
  /** A text element's lines at its box width. */
  lines(e: TextElement): string[];
  /** A tile's gallery thumbnail. */
  thumbnail(t: TileDocument): Promise<Blob>;
  /** Text measuring for laying out old posts. */
  measure: Measure;
  /** An old post's flattened layer drawn into a transparent full-tile PNG at `box` (document px). */
  placeOverlay(blob: Blob, box: { x: number; y: number; w: number; h: number }): Promise<Blob>;
  progress?(text: string): void;
}

/** Someone changed the post on WordPress after it was pulled. */
export class ConflictError extends Error {
  constructor(readonly remoteModified: string) {
    super('This post was changed on WordPress after you opened it.');
    this.name = 'ConflictError';
  }
}

/** The file name WordPress actually gave an upload. */
const fileOf = (url: string, fallback: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || fallback);
  } catch {
    return fallback;
  }
};

async function bytesOf(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}

/** Publishes the live tiles as the draft post. Returns the saved post. */
export async function publishPost(d: Deps, opts: { newCategories?: string[]; force?: boolean } = {}): Promise<WpPost> {
  const { store, wp } = d;
  const say = (t: string) => d.progress?.(t);
  const draft = await store.draft();
  const ws = await store.workspace();
  const title = draft.title.trim();
  if (!title) throw new WpError('Give the post a name first.');
  const tiles = (await Promise.all(ws.live.map((id) => store.getTile(id)))).filter((t): t is TileDocument => !!t);
  if (!tiles.length) throw new WpError('There are no tiles to publish.');

  say('Signing in…');
  await wp.me();
  if (!(await wp.themeReady())) throw new WpError('The site needs the latest studioview theme to show PUBLISH posts.');
  if (draft.wpId && !opts.force) {
    const now = await wp.post(draft.wpId);
    if (draft.modified && now.modified !== draft.modified) throw new ConflictError(now.modified);
  }

  const categories = [...draft.categories];
  for (const name of opts.newCategories ?? []) {
    if (!name.trim()) continue;
    const c = await wp.createCategory(name);
    if (!categories.includes(c.id)) categories.push(c.id);
  }

  const layout = reconcile(draft.layout, tiles.map((t) => t.id));
  const number = new Map(order(layout).map((id, i) => [id, i + 1]));
  // Republished tiles are ordinary tiles: no red dot.
  const clean = tiles.map((t) => {
    const meta = { ...t.meta };
    delete meta.legacy;
    return { ...t, meta };
  });

  // ----- pictures -----
  const refs = new Map<string, MediaRef>(); // tile id + element id → uploaded picture
  const byMedia = new Map<string, MediaRef>(); // a photo used in several tiles is uploaded once
  const total = clean.reduce((n, t) => n + t.elements.filter((e) => e.kind !== 'text').length, 0);
  let done = 0;

  async function put(blob: Blob, uid: string, name: string, w: number, h: number): Promise<MediaRef> {
    const found = await wp.findMedia(uid);
    const m = found ?? (await wp.uploadMedia(blob, name, { uid, title, alt: '' }));
    return { wpMediaId: m.id, url: m.url, uid, name: fileOf(m.url, name), width: w || m.width, height: h || m.height };
  }

  async function photo(t: TileDocument, mediaId: string): Promise<MediaRef> {
    const known = byMedia.get(mediaId);
    if (known) return known;
    const m = await store.media(mediaId);
    const blob = m && (await store.blob(mediaId));
    if (!m || !blob) throw new WpError(`A picture in “${t.name}” is missing from Media.`);
    let ref: MediaRef;
    if (m.wpMediaId && m.wpUrl) {
      ref = { wpMediaId: m.wpMediaId, url: m.wpUrl, uid: m.uid, name: m.name, width: m.width, height: m.height };
    } else {
      // First publish fixes the name: `<post>-<tile nn>-<id6>` unless it was named by hand.
      const name = m.named ? m.name : publishName(title, number.get(t.id) ?? 1, m.uid, m.mime);
      ref = await put(blob, m.uid, name, m.width, m.height);
      const next: MediaAsset = { ...m, name: ref.name, named: true, wpMediaId: ref.wpMediaId, wpUrl: ref.url };
      await store.putMedia(next);
    }
    byMedia.set(mediaId, ref);
    return ref;
  }

  async function flat(t: TileDocument, blob: Blob, role: 'drawing' | 'spiral', w: number, h: number): Promise<MediaRef> {
    const bytes = await bytesOf(blob);
    const uid = readId(bytes) ?? uidFromHash(await sha256(blob));
    const stamped = new Blob([stampId(bytes, uid) as BlobPart], { type: 'image/png' });
    return put(stamped, uid, publishName(title, number.get(t.id) ?? 1, uid, 'image/png', role), w, h);
  }

  for (const t of clean) {
    for (const e of t.elements) {
      if (e.kind === 'text') continue;
      say(`Pictures ${++done} of ${total}…`);
      let ref: MediaRef;
      if (e.kind === 'image') ref = await photo(t, e.mediaId);
      else if (e.kind === 'paint') {
        const blob = await store.blob(e.assetId);
        if (!blob) throw new WpError(`A drawing in “${t.name}” is missing.`);
        ref = await flat(t, blob, 'drawing', t.canvas.width, t.canvas.height);
      } else ref = await flat(t, await d.spiralPng(e), 'spiral', Math.round(e.w * t.canvas.width), Math.round(e.h * t.canvas.height));
      refs.set(`${t.id}/${e.id}`, ref);
    }
  }

  // ----- the post -----
  say('Publishing…');
  const meta: PostMeta = buildPostMeta(layout, clean, {
    media: (t, e) => refs.get(`${t.id}/${e.id}`),
    lines: (_t, e) => (e.kind === 'text' ? d.lines(e) : undefined),
    font: (e) => (e.kind === 'text' ? fontStack(e.font) : undefined),
  });
  const saved = await wp.savePost(draft.wpId, {
    title,
    content: postContent(meta),
    status: 'publish',
    categories,
    featured_media: meta.featured?.wpMediaId ?? 0,
    meta: { [POST_META_KEY]: JSON.stringify(meta) },
  });
  if (typeof saved.meta[POST_META_KEY] !== 'string' || !saved.meta[POST_META_KEY]) {
    throw new WpError('WordPress saved the post but not its tiles: update the studioview theme, then publish again.');
  }

  // ----- tidy up (WordPress has the post now; failures here are not fatal) -----
  if (draft.legacy && draft.wpId) await wp.clearMeta(saved.id, LEGACY_META_KEY).catch(() => undefined);
  const used = new Set(refsOf(meta).map((r) => r.wpMediaId));
  for (const id of draft.pulledMedia ?? []) if (!used.has(id)) await wp.deleteMedia(id).catch(() => undefined);

  const featured = meta.featured ? refsOf(meta).find((r) => r.wpMediaId === meta.featured!.wpMediaId) : undefined;
  await store.rememberPost({ wpId: saved.id, title, link: saved.link, date: saved.date, modified: saved.modified, ...(featured ? { thumb: featured.url } : {}) });
  for (const t of tiles) await store.deleteTile(t.id);
  await store.setWorkspace({ live: [], drafts: ws.drafts });
  await store.setDraft(emptyDraft());
  await store.pruneMedia();
  return saved;
}

// ----- pull back -----

/** Puts a post into TILES and PUBLISH for editing. The workbench must have no live tiles. */
export async function pullPost(d: Deps, wpId: number, now = new Date()): Promise<PostDraft> {
  const { store, wp } = d;
  const say = (t: string) => d.progress?.(t);
  const ws = await store.workspace();
  if (ws.live.length) throw new WpError('Publish or clear your current tiles first.');
  say('Opening the post…');
  const p = await wp.post(wpId);
  const raw = p.meta[POST_META_KEY];
  let tiles: TileDocument[];
  let draft: PostDraft;
  const base = { wpId: p.id, title: p.title, categories: p.categories, modified: p.modified, link: p.link };

  if (typeof raw === 'string' && raw) {
    const meta = parsePostMeta(raw);
    const kinds = new Map<number, TileElement['kind']>();
    for (const t of meta.tiles) for (const e of t.elements) if (e.media) kinds.set(e.media.wpMediaId, e.kind);
    const local = new Map<number, string>();
    const refs = refsOf(meta).filter((r) => kinds.get(r.wpMediaId) !== 'spiral');
    let i = 0;
    for (const r of refs) {
      if (local.has(r.wpMediaId)) continue;
      say(`Pictures ${++i} of ${refs.length}…`);
      if (kinds.get(r.wpMediaId) === 'paint') {
        local.set(r.wpMediaId, await store.putAsset(await wp.download(r.wpMediaId)));
        continue;
      }
      local.set(r.wpMediaId, (await localPhoto(d, r)).id);
    }
    const back = tilesFromPost(meta, (r) => local.get(r.wpMediaId)!, now);
    tiles = back.tiles;
    const flats = [...kinds].filter(([, k]) => k === 'paint' || k === 'spiral').map(([id]) => id);
    draft = { ...base, layout: back.layout, pulledMedia: flats };
  } else {
    const studio = readStudio(p.meta[LEGACY_META_KEY]);
    const back = studio ? await fromStudio(d, p, studio) : await fromPlain(d, p);
    tiles = back.tiles;
    draft = { ...base, layout: back.layout, legacy: studio ? 'wpstudio' : 'wp' };
  }

  say('Making tiles…');
  for (const t of tiles) await store.saveTile(t, await d.thumbnail(t));
  await store.setWorkspace({ live: tiles.map((t) => t.id), drafts: ws.drafts });
  await store.setDraft(draft);
  await store.rememberPost(summaryOf(p, originOf(p)));
  return draft;
}

/** A WP Studio post: its own layout and boxes, every tile fitted into 9:16 (§11.3). */
async function fromStudio(d: Deps, p: WpPost, studio: NonNullable<ReturnType<typeof readStudio>>): Promise<{ tiles: TileDocument[]; layout: ReturnType<typeof fromOrder> }> {
  const { store, wp } = d;
  const need = studioMedia(studio);
  const photos = new Map<number, { id: string; width: number; height: number }>();
  let i = 0;
  const total = need.photos.length + need.overlays.length;
  for (const id of need.photos) {
    d.progress?.(`Pictures ${++i} of ${total}…`);
    try {
      const m = await wp.media(id);
      const local = await localPhoto(d, { wpMediaId: id, url: m.url, uid: m.uid ?? '', name: fileOf(m.url, `picture-${id}.jpg`), width: m.width, height: m.height });
      photos.set(id, { id: local.id, width: local.width, height: local.height });
    } catch {
      // A picture that is gone from WordPress is left out.
    }
  }
  const back = studioTiles(studio, { photo: (id) => photos.get(id) ?? null }, { postId: p.id, title: p.title });
  // Flattened layers become full-tile drawings (not editable as labels or spirals).
  const layers = new Map<number, Blob | null>();
  for (const t of back.tiles) {
    const out: TileElement[] = [];
    for (const e of t.elements) {
      if (e.kind !== 'paint' || !e.assetId.startsWith('wp:')) {
        out.push(e);
        continue;
      }
      const id = Number(e.assetId.slice(3));
      if (!layers.has(id)) {
        d.progress?.(`Pictures ${++i} of ${total}…`);
        layers.set(id, await wp.download(id).catch(() => null));
      }
      const blob = layers.get(id);
      if (!blob) continue;
      const asset = await store.putAsset(await d.placeOverlay(blob, overlayBox(e)));
      out.push({ ...e, assetId: asset, x: 0, y: 0, w: 1, h: 1 });
    }
    t.elements = out;
  }
  return back;
}

/** An ordinary post, read as a story (§11.3). */
async function fromPlain(d: Deps, p: WpPost): Promise<{ tiles: TileDocument[]; layout: ReturnType<typeof fromOrder> }> {
  const { wp } = d;
  const blocks = htmlBlocks(p.content);
  const pics = blocks.filter((b) => b.kind === 'image').length + (p.featuredMedia ? 1 : 0);
  let i = 0;
  const picture = async (id: number | null, src: string, caption: string): Promise<Picture | null> => {
    d.progress?.(`Pictures ${++i} of ${pics}…`);
    try {
      let wpId = id;
      if (!wpId && src) {
        // No attachment id in the HTML: find the picture by its file name.
        const name = baseName(src);
        const hit = name ? (await wp.listMedia({ search: name })).find((m) => baseName(m.url) === name) : undefined;
        wpId = hit?.id ?? null;
      }
      if (!wpId) return null;
      const m = await wp.media(wpId);
      const local = await localPhoto(d, { wpMediaId: wpId, url: m.url, uid: m.uid ?? '', name: fileOf(m.url, `picture-${wpId}.jpg`), width: m.width, height: m.height });
      const cap = caption.trim() || m.caption;
      return { mediaId: local.id, width: local.width, height: local.height, ...(cap ? { caption: cap } : {}) };
    } catch {
      return null; // gone from WordPress: left out
    }
  };
  const featured = p.featuredMedia ? await picture(p.featuredMedia, '', '') : null;
  const story: StoryBlock[] = [];
  let first = true;
  for (const b of blocks) {
    if (b.kind !== 'image') {
      story.push(b);
      continue;
    }
    // The featured picture repeated as the first picture of the body is shown once, on the cover.
    if (first && featured && b.id === p.featuredMedia) {
      first = false;
      continue;
    }
    first = false;
    const pic = await picture(b.id, b.src, b.caption);
    if (pic) story.push({ kind: 'image', ...pic });
  }
  const tiles = storyTiles({ title: p.title, ...(featured ? { featured: { ...featured, caption: undefined } } : {}), blocks: story }, d.measure);
  return { tiles, layout: fromOrder(tiles.map((t) => t.id)) };
}

/** The phone's copy of an uploaded picture (downloaded when it is not here yet). */
async function localPhoto(d: Deps, r: MediaRef): Promise<MediaAsset> {
  const { store, wp } = d;
  const have = r.uid ? await store.mediaByUid(r.uid) : null;
  if (have) {
    if (!have.wpMediaId) {
      const next = { ...have, wpMediaId: r.wpMediaId, wpUrl: r.url, name: r.name, named: true };
      await store.putMedia(next);
      return next;
    }
    return have;
  }
  const blob = await wp.download(r.wpMediaId);
  const { media } = await store.addMedia(blob, { width: r.width, height: r.height, source: 'wordpress', wpMediaId: r.wpMediaId, wpUrl: r.url, name: r.name });
  return media;
}

export function summaryOf(p: WpPost, legacy: Origin | undefined, thumb?: string): PostSummary {
  return { wpId: p.id, title: p.title, link: p.link, date: p.date, modified: p.modified, ...(thumb ? { thumb } : {}), ...(legacy ? { legacy } : {}) };
}

/** Where a post comes from: PUBLISH (undefined), WP Studio, or an ordinary post. */
export function originOf(p: WpPost): Origin | undefined {
  if (isOwnPost(p)) return undefined;
  return readStudio(p.meta[LEGACY_META_KEY]) ? 'wpstudio' : 'wp';
}

/** A post is PUBLISH's own when it carries the post meta. */
export const isOwnPost = (p: WpPost) => typeof p.meta[POST_META_KEY] === 'string' && !!p.meta[POST_META_KEY];

/** Clears the workbench's post (tiles to publish and the post draft); drafts stay. */
export async function clearPost(store: PublishStore): Promise<void> {
  const ws = await store.workspace();
  for (const id of ws.live) await store.deleteTile(id);
  await store.setWorkspace({ live: [], drafts: ws.drafts });
  await store.setDraft(emptyDraft());
}
