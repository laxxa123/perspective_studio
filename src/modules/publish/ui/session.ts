// Tile session: autosave with thumbnails, new tiles, photo import (PUBLISH §5, §7).
import { pickFiles } from '../../../platform/files';
import { assetsOf, createTile, mediaOf } from '../core/tile';
import type { MediaAsset, TileDocument } from '../core/types';
import { canvasToBlob, renderTile } from '../render/draw';
import { cleanPhoto, ensureImages, imageCache } from '../render/images';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';

const st = usePublishStore.getState;
let chain: Promise<void> = Promise.resolve();
let lastSaved: TileDocument | null = null;

/** Thumbnails are 270 × 480 (a quarter). */
export async function thumbnail(t: TileDocument): Promise<Blob> {
  await ensureImages([...mediaOf(t), ...assetsOf(t)]);
  return canvasToBlob(renderTile(t, imageCache, 0.25), 'image/jpeg', 0.85);
}

/** Picture files still being written (a drawing is shown at once and stored in the background). */
const writes = new Set<Promise<unknown>>();
export function backgroundWrite(p: Promise<unknown>) {
  const w = p.catch((e) => st().showToast(`Could not store a drawing: ${e instanceof Error ? e.message : String(e)}`)).finally(() => writes.delete(w));
  writes.add(w);
}

/** Saves the open tile when it changed (queued; never two saves at once; after pending picture writes). */
export function saveNow(): Promise<void> {
  chain = chain.then(async () => {
    await Promise.all(writes);
    const t = st().tile;
    if (!t || t === lastSaved) return;
    st().set({ saving: true });
    try {
      await (await publishStore()).saveTile(t, await thumbnail(t));
      lastSaved = t;
    } catch (e) {
      st().showToast(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      st().set({ saving: false });
    }
  });
  return chain;
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSave(delay = 800) {
  clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), delay);
}

export function markSaved(t: TileDocument) {
  lastSaved = t;
}

/** Drawing layers made while a tile is open (older versions stay until it closes, for undo). */
const sessionAssets = new Set<string>();
export const trackAsset = (id: string) => void sessionAssets.add(id);

/** A new blank 9:16 tile at the end of the post, saved and opened. */
export async function newTile(): Promise<void> {
  const store = await publishStore();
  const n = (await store.listTiles()).length + 1;
  const t = createTile(`Tile ${n}`);
  await store.saveTile(t, await thumbnail(t));
  const ws = await store.syncedWorkspace();
  await store.setWorkspace({ ...ws, live: [...ws.live.filter((id) => id !== t.id), t.id] });
  markSaved(t);
  st().open(t);
}

export async function openTile(id: string): Promise<void> {
  const t = await (await publishStore()).getTile(id);
  if (!t) return st().showToast('This tile could not be opened.');
  await ensureImages([...mediaOf(t), ...assetsOf(t)]);
  markSaved(t);
  // Drawings the tile has now: removed ones are cleaned up on close.
  assetsOf(t).forEach(trackAsset);
  st().open(t);
}

/** Leaves the editor after saving; drawing versions the tile no longer uses are deleted. */
export async function closeTile(): Promise<void> {
  clearTimeout(timer);
  await saveNow();
  const t = st().tile;
  if (t) {
    const keep = new Set(assetsOf(t));
    const store = await publishStore();
    for (const id of sessionAssets) if (!keep.has(id)) await store.deleteAsset(id);
  }
  sessionAssets.clear();
  st().close();
}

/** Imports photos from the device into the library (cleaned, deduplicated, canonically named). */
export async function importPhotos(): Promise<MediaAsset[]> {
  const files = await pickFiles('image/*');
  const out: MediaAsset[] = [];
  if (!files.length) return out;
  const store = await publishStore();
  let dup = 0;
  for (const f of files) {
    try {
      const clean = await cleanPhoto(f);
      const r = await store.addMedia(clean.blob, { width: clean.width, height: clean.height });
      if (r.existed) dup++;
      out.push(r.media);
    } catch {
      st().showToast(`Could not read ${f.name || 'a photo'}.`);
    }
  }
  if (dup) st().showToast(dup === 1 ? 'Already in Media — reused.' : `${dup} already in Media — reused.`);
  return out;
}
