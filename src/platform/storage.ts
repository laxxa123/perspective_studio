// IndexedDB persistence (§7.9) via idb: `documents` (full JSON) and
// `thumbnails` (PNG blobs).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface StudioDB extends DBSchema {
  documents: { key: string; value: { id: string; json: unknown; name: string; updatedAt: string } };
  thumbnails: { key: string; value: { id: string; png: Blob } };
}

let dbp: Promise<IDBPDatabase<StudioDB>> | null = null;
const db = () =>
  (dbp ??= openDB<StudioDB>('perspective_studio', 1, {
    upgrade(d) {
      d.createObjectStore('documents', { keyPath: 'id' });
      d.createObjectStore('thumbnails', { keyPath: 'id' });
    },
  }));

export interface StoredSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export async function listDocuments(): Promise<StoredSummary[]> {
  const all = await (await db()).getAll('documents');
  return all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readDocument(id: string): Promise<unknown | null> {
  return (await (await db()).get('documents', id))?.json ?? null;
}

export async function readAllDocuments(): Promise<unknown[]> {
  return (await (await db()).getAll('documents')).map((r) => r.json);
}

export async function writeDocument(id: string, name: string, updatedAt: string, json: unknown): Promise<void> {
  await (await db()).put('documents', { id, name, updatedAt, json });
}

export async function deleteDocument(id: string): Promise<void> {
  const d = await db();
  await d.delete('documents', id);
  await d.delete('thumbnails', id);
}

export async function writeThumbnail(id: string, png: Blob): Promise<void> {
  await (await db()).put('thumbnails', { id, png });
}

export async function readThumbnail(id: string): Promise<Blob | null> {
  return (await (await db()).get('thumbnails', id))?.png ?? null;
}
