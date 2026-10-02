// PUBLISH storage (PUBLISH §7): IndexedDB `creative-publish`.
// - tiles:  TileDocument JSON (keyPath id)
// - thumbs: tile id → PNG thumbnail
// - media:  MediaAsset metadata (keyPath id, unique index by content hash)
// - blobs:  media id / asset id → file bytes (media pictures and private paint layers)
// - kv:     the tiles workspace (live / draft order), the post being composed, the posts list (v2)
import { openDB, type IDBPDatabase } from 'idb';
import { canonicalName, renameCanonical } from '../core/layout';
import { readId, stampId, uidFromHash } from '../core/imageId';
import { duplicateTile, mediaOf, newId, parseTile, assetsOf } from '../core/tile';
import type { MediaAsset, TileDocument } from '../core/types';
import type { Layout } from '../core/postLayout';

const DB = 'creative-publish';

export interface TileSummary {
  id: string;
  name: string;
  updatedAt: string;
  legacy?: boolean;
}

/** Tiles on the workbench: those going into the post (in order) and drafts kept aside. */
export interface Workspace {
  live: string[];
  drafts: string[];
}

/** The post being composed (PUBLISH tab). */
export interface PostDraft {
  /** The WordPress post being edited; null for a new post. */
  wpId: number | null;
  title: string;
  categories: number[];
  layout: Layout;
  /** WordPress `modified_gmt` when the post was pulled (conflict check on republish). */
  modified: string | null;
  link?: string;
  legacy?: boolean;
  /** Picture media this post used when pulled (old drawings / spirals are removed after republishing). */
  pulledMedia?: number[];
  /** Categories to create on WordPress when publishing. */
  newCategories?: string[];
}

/** A published post in the POSTS list. */
export interface PostSummary {
  wpId: number;
  title: string;
  link: string;
  date: string;
  modified: string;
  thumb?: string;
  /** Not made by PUBLISH (opens as imported tiles). */
  legacy?: boolean;
}

/** How many posts the POSTS list keeps (newest first; older ones drop off the phone only). */
export const POSTS_KEPT = 25;
export const emptyDraft = (): PostDraft => ({ wpId: null, title: '', categories: [], layout: [], modified: null });

/** SHA-256 of a blob, lower-case hex. */
export async function sha256(blob: Blob): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PublishStore {
  private db: IDBPDatabase | null = null;
  constructor(private name = DB) {}

  async open(): Promise<this> {
    if (this.db) return this;
    this.db = await openDB(this.name, 2, {
      upgrade(db, old, _new, tx) {
        if (old < 1) {
          db.createObjectStore('tiles', { keyPath: 'id' });
          db.createObjectStore('thumbs');
          db.createObjectStore('media', { keyPath: 'id' }).createIndex('byHash', 'hash', { unique: true });
          db.createObjectStore('blobs');
        }
        if (old < 2) {
          db.createObjectStore('kv');
          const media = tx.objectStore('media');
          media.createIndex('byUid', 'uid', { unique: false });
          // 0.16 pictures get their permanent id from their hash.
          void media.openCursor().then(async function step(c): Promise<void> {
            if (!c) return;
            const m = c.value as MediaAsset;
            if (!m.uid) await c.update({ ...m, uid: uidFromHash(m.hash) });
            return step(await c.continue());
          });
        }
      },
    });
    return this;
  }

  private get d() {
    if (!this.db) throw new Error('PUBLISH storage not open');
    return this.db;
  }

  // ----- tiles -----

  /** Most recently edited first. */
  async listTiles(): Promise<TileSummary[]> {
    const all = (await this.d.getAll('tiles')) as TileDocument[];
    return all.map(({ id, name, updatedAt, meta }) => ({ id, name, updatedAt, ...(meta?.legacy ? { legacy: true } : {}) })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getTile(id: string): Promise<TileDocument | null> {
    const raw = await this.d.get('tiles', id);
    return raw ? parseTile(raw) : null;
  }

  async saveTile(t: TileDocument, thumb?: Blob): Promise<void> {
    const tx = this.d.transaction(['tiles', 'thumbs'], 'readwrite');
    await tx.objectStore('tiles').put(t);
    if (thumb) await tx.objectStore('thumbs').put(thumb, t.id);
    await tx.done;
  }

  async thumb(id: string): Promise<Blob | null> {
    return ((await this.d.get('thumbs', id)) as Blob | undefined) ?? null;
  }

  /** Removes a tile and its private assets (paint); media stay in the library. */
  async deleteTile(id: string): Promise<void> {
    const t = await this.getTile(id);
    const tx = this.d.transaction(['tiles', 'thumbs', 'blobs'], 'readwrite');
    await tx.objectStore('tiles').delete(id);
    await tx.objectStore('thumbs').delete(id);
    for (const a of t ? assetsOf(t) : []) await tx.objectStore('blobs').delete(a);
    await tx.done;
  }

  /** Copies a tile; its paint layers are copied too (they are private to a tile). */
  async duplicateTile(id: string): Promise<string | null> {
    const t = await this.getTile(id);
    if (!t) return null;
    const copy = duplicateTile(t);
    const remap = new Map<string, string>();
    for (const a of assetsOf(t)) {
      const blob = await this.blob(a);
      if (!blob) continue;
      const nid = newId('asset');
      remap.set(a, nid);
      await this.d.put('blobs', blob, nid);
    }
    copy.elements = copy.elements.map((e) => (e.kind === 'paint' && remap.has(e.assetId) ? { ...e, assetId: remap.get(e.assetId)! } : e));
    const thumb = await this.thumb(id);
    await this.saveTile(copy, thumb ?? undefined);
    return copy.id;
  }

  async renameTile(id: string, name: string): Promise<void> {
    const t = await this.getTile(id);
    if (t) await this.d.put('tiles', { ...t, name, updatedAt: new Date().toISOString() });
  }

  // ----- media library -----

  /** Newest first. */
  async listMedia(): Promise<MediaAsset[]> {
    const all = (await this.d.getAll('media')) as MediaAsset[];
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async media(id: string): Promise<MediaAsset | null> {
    return ((await this.d.get('media', id)) as MediaAsset | undefined) ?? null;
  }

  /**
   * Adds a picture (already cleaned and encoded). Its permanent id is the
   * file's own (a picture pulled from WordPress) or comes from its hash, and
   * is written into the stored file. The same picture is stored once: a
   * second import returns the existing entry. The name never uses the
   * phone's file name (privacy): `photo-<date>-<id6>` until published.
   */
  async addMedia(blob: Blob, info: { label?: string; width: number; height: number; source?: MediaAsset['source']; wpMediaId?: number; wpUrl?: string; name?: string }, now = new Date()): Promise<{ media: MediaAsset; existed: boolean }> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const own = readId(bytes);
    const hash = await sha256(blob);
    const uid = own ?? uidFromHash(hash);
    const found = ((await this.d.getFromIndex('media', 'byUid', uid)) ?? (await this.d.getFromIndex('media', 'byHash', hash))) as MediaAsset | undefined;
    if (found) {
      if (info.wpMediaId && !found.wpMediaId) await this.d.put('media', { ...found, wpMediaId: info.wpMediaId, wpUrl: info.wpUrl });
      return { media: { ...found, ...(info.wpMediaId && !found.wpMediaId ? { wpMediaId: info.wpMediaId, wpUrl: info.wpUrl } : {}) }, existed: true };
    }
    const mime = blob.type || 'image/jpeg';
    const stamped = own ? blob : new Blob([stampId(bytes, uid) as BlobPart], { type: mime });
    const media: MediaAsset = {
      id: newId('media'),
      name: info.name ?? canonicalName(info.label ?? 'photo', uid, mime, now),
      hash,
      uid,
      mime,
      width: info.width,
      height: info.height,
      bytes: stamped.size,
      createdAt: now.toISOString(),
      source: info.source ?? 'device',
      ...(info.wpMediaId ? { wpMediaId: info.wpMediaId, wpUrl: info.wpUrl } : {}),
      ...(info.name ? { named: true } : {}),
    };
    const tx = this.d.transaction(['media', 'blobs'], 'readwrite');
    await tx.objectStore('media').put(media);
    await tx.objectStore('blobs').put(stamped, media.id);
    await tx.done;
    return { media, existed: false };
  }

  async mediaByUid(uid: string): Promise<MediaAsset | null> {
    return ((await this.d.getFromIndex('media', 'byUid', uid)) as MediaAsset | undefined) ?? null;
  }

  async putMedia(m: MediaAsset): Promise<void> {
    await this.d.put('media', m);
  }

  /** Changes the readable part of a media name (date and hash stay). */
  async renameMedia(id: string, label: string): Promise<MediaAsset | null> {
    const m = await this.media(id);
    if (!m) return null;
    const next = { ...m, name: renameCanonical(m.name, label), named: true };
    await this.d.put('media', next);
    return next;
  }

  /** Tiles that use a picture. */
  async usage(mediaId: string): Promise<string[]> {
    const all = (await this.d.getAll('tiles')) as TileDocument[];
    return all.filter((t) => mediaOf(t).includes(mediaId)).map((t) => t.name);
  }

  /** Deletes a picture that no tile uses; returns the tiles that still use it otherwise. */
  async deleteMedia(id: string): Promise<string[]> {
    const used = await this.usage(id);
    if (used.length) return used;
    const tx = this.d.transaction(['media', 'blobs'], 'readwrite');
    await tx.objectStore('media').delete(id);
    await tx.objectStore('blobs').delete(id);
    await tx.done;
    return [];
  }

  /**
   * Keeps the library small: pictures that are on WordPress (they can be
   * pulled back) beyond the newest `keep` are removed from the phone, unless
   * a tile uses them. Pictures only on the phone always stay.
   */
  async pruneMedia(keep = POSTS_KEPT): Promise<number> {
    const tiles = (await this.d.getAll('tiles')) as TileDocument[];
    const used = new Set(tiles.flatMap(mediaOf));
    const onWp = (await this.listMedia()).filter((m) => m.wpMediaId);
    let n = 0;
    for (const m of onWp.slice(keep)) {
      if (used.has(m.id)) continue;
      await this.deleteMedia(m.id);
      n++;
    }
    return n;
  }

  // ----- bytes (media and private assets) -----

  async blob(id: string): Promise<Blob | null> {
    return ((await this.d.get('blobs', id)) as Blob | undefined) ?? null;
  }

  /** Stores a private asset (a paint layer); returns its id. */
  async putAsset(blob: Blob, id = newId('asset')): Promise<string> {
    await this.d.put('blobs', blob, id);
    return id;
  }

  async deleteAsset(id: string): Promise<void> {
    await this.d.delete('blobs', id);
  }

  // ----- workspace, post draft, posts list -----

  private async kv<T>(key: string, fallback: T): Promise<T> {
    return ((await this.d.get('kv', key)) as T | undefined) ?? fallback;
  }

  /** A small saved value (site settings, cached categories). */
  setting<T>(key: string, fallback: T): Promise<T> {
    return this.kv<T>(`setting:${key}`, fallback);
  }
  async setSetting(key: string, value: unknown): Promise<void> {
    await this.d.put('kv', value, `setting:${key}`);
  }

  workspace(): Promise<Workspace> {
    return this.kv<Workspace>('workspace', { live: [], drafts: [] });
  }

  /** The workspace matched to the tiles there are: gone ones dropped, unplaced ones (oldest first) added to the post. */
  async syncedWorkspace(): Promise<Workspace> {
    const w = await this.workspace();
    const all = (await this.d.getAll('tiles')) as TileDocument[];
    const have = new Set(all.map((t) => t.id));
    const live = w.live.filter((id) => have.has(id));
    const drafts = w.drafts.filter((id) => have.has(id) && !live.includes(id));
    const placed = new Set([...live, ...drafts]);
    const extra = all.filter((t) => !placed.has(t.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const next = { live: [...live, ...extra.map((t) => t.id)], drafts };
    if (next.live.length !== w.live.length || next.drafts.length !== w.drafts.length || extra.length) await this.setWorkspace(next);
    return next;
  }
  async setWorkspace(w: Workspace): Promise<void> {
    await this.d.put('kv', w, 'workspace');
  }

  draft(): Promise<PostDraft> {
    return this.kv<PostDraft>('post', emptyDraft());
  }
  async setDraft(d: PostDraft): Promise<void> {
    await this.d.put('kv', d, 'post');
  }

  posts(): Promise<PostSummary[]> {
    return this.kv<PostSummary[]>('posts', []);
  }
  /** Puts a post at the top of the list (replacing an older entry for it); keeps the newest 25. */
  async rememberPost(p: PostSummary): Promise<PostSummary[]> {
    const list = [p, ...(await this.posts()).filter((x) => x.wpId !== p.wpId)].slice(0, POSTS_KEPT);
    await this.d.put('kv', list, 'posts');
    return list;
  }
  async setPosts(list: PostSummary[]): Promise<void> {
    await this.d.put('kv', list.slice(0, POSTS_KEPT), 'posts');
  }

  close() {
    this.db?.close();
    this.db = null;
  }
}

let shared: Promise<PublishStore> | null = null;
/** The app's store (opened once). */
export const publishStore = () => (shared ??= new PublishStore().open());
