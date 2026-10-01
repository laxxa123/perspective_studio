// SKETCH projects in IndexedDB (SKETCH §18, §19): the document JSON, its
// layer tiles (raw premultiplied RGBA, deflate-compressed), a thumbnail and
// reference-image assets. Autosave writes only the tiles that changed.
import { openDB, type IDBPDatabase } from 'idb';
import { newId, parseDocument } from '../core/document';
import type { SketchDocument } from '../core/types';

const DB = 'creative-sketch';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

export interface TileRecord {
  layerId: string;
  index: number;
  data: Uint8Array;
}

interface TileRow {
  docId: string;
  layerId: string;
  index: number;
  /** deflate-raw of the RGBA bytes (or raw bytes when compression is unavailable). */
  bytes: ArrayBuffer;
  raw?: boolean;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined';

export async function compress(data: Uint8Array): Promise<{ bytes: ArrayBuffer; raw: boolean }> {
  if (!canCompress()) return { bytes: data.slice().buffer, raw: true };
  const c = await pipe(data, new CompressionStream('deflate-raw'));
  return { bytes: c.slice().buffer, raw: false };
}

export async function decompress(row: { bytes: ArrayBuffer; raw?: boolean }): Promise<Uint8Array> {
  const data = new Uint8Array(row.bytes);
  return row.raw ? data : pipe(data, new DecompressionStream('deflate-raw'));
}

export class ProjectStore {
  private db: IDBPDatabase | null = null;
  constructor(private name = DB) {}

  async open(): Promise<this> {
    if (this.db) return this;
    this.db = await openDB(this.name, 1, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' });
        const tiles = db.createObjectStore('tiles', { keyPath: ['docId', 'layerId', 'index'] });
        tiles.createIndex('byDoc', 'docId');
        db.createObjectStore('thumbs');
        db.createObjectStore('assets', { keyPath: 'id' }).createIndex('byDoc', 'docId');
      },
    });
    return this;
  }

  private get d() {
    if (!this.db) throw new Error('SKETCH storage not open');
    return this.db;
  }

  /** Projects, most recently edited first (SKETCH §21). */
  async list(): Promise<ProjectSummary[]> {
    const all = (await this.d.getAll('projects')) as SketchDocument[];
    return all.map(({ id, name, updatedAt, createdAt }) => ({ id, name, updatedAt, createdAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: string): Promise<{ doc: SketchDocument; tiles: TileRecord[] } | null> {
    const raw = await this.d.get('projects', id);
    if (!raw) return null;
    const doc = parseDocument(raw);
    const rows = (await this.d.getAllFromIndex('tiles', 'byDoc', id)) as TileRow[];
    const live = new Set(doc.layers.map((l) => l.id));
    const tiles = await Promise.all(rows.filter((r) => live.has(r.layerId)).map(async (r) => ({ layerId: r.layerId, index: r.index, data: await decompress(r) })));
    return { doc, tiles };
  }

  /**
   * Saves the document and the changed tiles (null = now empty). Tiles of
   * layers that no longer exist are removed.
   */
  async save(doc: SketchDocument, tiles: { layerId: string; index: number; data: Uint8Array | null }[], thumb?: Blob): Promise<void> {
    const rows = await Promise.all(tiles.map(async (t) => ({ layerId: t.layerId, index: t.index, packed: t.data ? await compress(t.data) : null })));
    const live = new Set(doc.layers.map((l) => l.id));
    const tx = this.d.transaction(['projects', 'tiles', 'thumbs'], 'readwrite');
    const ts = tx.objectStore('tiles');
    await tx.objectStore('projects').put(doc);
    for (const r of rows) {
      if (r.packed) await ts.put({ docId: doc.id, layerId: r.layerId, index: r.index, ...r.packed } satisfies TileRow);
      else await ts.delete([doc.id, r.layerId, r.index]);
    }
    for (const key of await ts.index('byDoc').getAllKeys(doc.id)) {
      const [, layerId] = key as [string, string, number];
      if (!live.has(layerId)) await ts.delete(key);
    }
    if (thumb) await tx.objectStore('thumbs').put(thumb, doc.id);
    await tx.done;
  }

  async thumbnail(id: string): Promise<Blob | null> {
    return ((await this.d.get('thumbs', id)) as Blob | undefined) ?? null;
  }

  async rename(id: string, name: string): Promise<void> {
    const doc = (await this.d.get('projects', id)) as SketchDocument | undefined;
    if (doc) await this.d.put('projects', { ...doc, name, updatedAt: new Date().toISOString() });
  }

  /** Copies a project (document, tiles, thumbnail, assets) under a new id. */
  async duplicate(id: string, name?: string): Promise<string | null> {
    const doc = (await this.d.get('projects', id)) as SketchDocument | undefined;
    if (!doc) return null;
    const copyId = newId('s');
    const now = new Date().toISOString();
    const tiles = (await this.d.getAllFromIndex('tiles', 'byDoc', id)) as TileRow[];
    const assets = (await this.d.getAllFromIndex('assets', 'byDoc', id)) as { id: string; docId: string; blob: Blob }[];
    const thumb = await this.d.get('thumbs', id);
    const tx = this.d.transaction(['projects', 'tiles', 'thumbs', 'assets'], 'readwrite');
    await tx.objectStore('projects').put({ ...doc, id: copyId, name: name ?? `${doc.name} copy`, createdAt: now, updatedAt: now });
    for (const t of tiles) await tx.objectStore('tiles').put({ ...t, docId: copyId });
    for (const a of assets) await tx.objectStore('assets').put({ ...a, docId: copyId, id: `${copyId}:${a.id.split(':').pop()}` });
    if (thumb) await tx.objectStore('thumbs').put(thumb, copyId);
    await tx.done;
    // References point at the copied assets.
    if (assets.length) {
      const d = (await this.d.get('projects', copyId)) as SketchDocument;
      await this.d.put('projects', { ...d, references: d.references.map((r) => ({ ...r, assetId: `${copyId}:${r.assetId.split(':').pop()}` })) });
    }
    return copyId;
  }

  async remove(id: string): Promise<void> {
    const tx = this.d.transaction(['projects', 'tiles', 'thumbs', 'assets'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    for (const k of await tx.objectStore('tiles').index('byDoc').getAllKeys(id)) await tx.objectStore('tiles').delete(k);
    for (const k of await tx.objectStore('assets').index('byDoc').getAllKeys(id)) await tx.objectStore('assets').delete(k);
    await tx.objectStore('thumbs').delete(id);
    await tx.done;
  }

  /** Stores a reference image; returns its asset id. */
  async putAsset(docId: string, blob: Blob): Promise<string> {
    const id = `${docId}:${newId('a')}`;
    await this.d.put('assets', { id, docId, blob });
    return id;
  }

  async asset(id: string): Promise<Blob | null> {
    const row = (await this.d.get('assets', id)) as { blob: Blob } | undefined;
    return row?.blob ?? null;
  }

  /** Drops assets no reference uses any more. */
  async pruneAssets(doc: SketchDocument): Promise<void> {
    const used = new Set(doc.references.map((r) => r.assetId));
    for (const k of await this.d.getAllKeysFromIndex('assets', 'byDoc', doc.id)) if (!used.has(k as string)) await this.d.delete('assets', k);
  }

  close() {
    this.db?.close();
    this.db = null;
  }
}

let shared: Promise<ProjectStore> | null = null;
/** The app's store (opened once). */
export const projectStore = () => (shared ??= new ProjectStore().open());
