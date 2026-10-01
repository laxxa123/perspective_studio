// PUBLISH storage (PUBLISH §7): IndexedDB `creative-publish`.
// - tiles:  TileDocument JSON (keyPath id)
// - thumbs: tile id → PNG thumbnail
// - media:  MediaAsset metadata (keyPath id, unique index by content hash)
// - blobs:  media id / asset id → file bytes (media pictures and private paint layers)
import { openDB, type IDBPDatabase } from 'idb';
import { canonicalName, renameCanonical } from '../core/layout';
import { duplicateTile, mediaOf, newId, parseTile, assetsOf } from '../core/tile';
import type { MediaAsset, TileDocument } from '../core/types';

const DB = 'creative-publish';

export interface TileSummary {
  id: string;
  name: string;
  updatedAt: string;
}

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
    this.db = await openDB(this.name, 1, {
      upgrade(db) {
        db.createObjectStore('tiles', { keyPath: 'id' });
        db.createObjectStore('thumbs');
        db.createObjectStore('media', { keyPath: 'id' }).createIndex('byHash', 'hash', { unique: true });
        db.createObjectStore('blobs');
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
    return all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
   * Adds a picture (already cleaned and encoded). The same bytes are stored
   * once: a second import returns the existing entry.
   */
  async addMedia(blob: Blob, info: { fileName: string; width: number; height: number; source?: MediaAsset['source']; wpMediaId?: number }, now = new Date()): Promise<{ media: MediaAsset; existed: boolean }> {
    const hash = await sha256(blob);
    const found = (await this.d.getFromIndex('media', 'byHash', hash)) as MediaAsset | undefined;
    if (found) return { media: found, existed: true };
    const media: MediaAsset = {
      id: newId('media'),
      name: canonicalName(info.fileName, hash, blob.type, now),
      hash,
      mime: blob.type || 'image/jpeg',
      width: info.width,
      height: info.height,
      bytes: blob.size,
      createdAt: now.toISOString(),
      source: info.source ?? 'device',
      ...(info.wpMediaId ? { wpMediaId: info.wpMediaId } : {}),
    };
    const tx = this.d.transaction(['media', 'blobs'], 'readwrite');
    await tx.objectStore('media').put(media);
    await tx.objectStore('blobs').put(blob, media.id);
    await tx.done;
    return { media, existed: false };
  }

  /** Changes the readable part of a media name (date and hash stay). */
  async renameMedia(id: string, label: string): Promise<MediaAsset | null> {
    const m = await this.media(id);
    if (!m) return null;
    const next = { ...m, name: renameCanonical(m.name, label) };
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

  close() {
    this.db?.close();
    this.db = null;
  }
}

let shared: Promise<PublishStore> | null = null;
/** The app's store (opened once). */
export const publishStore = () => (shared ??= new PublishStore().open());
