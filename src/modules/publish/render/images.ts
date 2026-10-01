// Decoded pictures for drawing (media and paint layers), loaded once from the
// store; listeners redraw when one arrives. Also the device-photo import.
import { publishStore } from '../storage/PublishStore';
import { canvasToBlob, type Images } from './draw';

const cache = new Map<string, ImageBitmap>();
const loading = new Map<string, Promise<ImageBitmap | undefined>>();
const listeners = new Set<() => void>();

export const imageCache: Images = { get: (id) => cache.get(id) };

export function onImagesLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Starts loading pictures that are not decoded yet; resolves when all are. */
export async function ensureImages(ids: Iterable<string>): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  for (const id of ids) {
    if (cache.has(id)) continue;
    let job = loading.get(id);
    if (!job) {
      job = (async () => {
        const blob = await (await publishStore()).blob(id);
        if (!blob) return undefined;
        const bmp = await createImageBitmap(blob);
        cache.set(id, bmp);
        listeners.forEach((f) => f());
        return bmp;
      })()
        .catch(() => undefined)
        .finally(() => loading.delete(id));
      loading.set(id, job);
    }
    jobs.push(job);
  }
  await Promise.all(jobs);
}

/** Puts a freshly made picture (e.g. a new paint layer) straight into the cache. */
export function cacheImage(id: string, bmp: ImageBitmap) {
  cache.get(id)?.close();
  cache.set(id, bmp);
  listeners.forEach((f) => f());
}

export function forgetImage(id: string) {
  cache.get(id)?.close();
  cache.delete(id);
}

/** Longest side kept for imported photos. */
export const MAX_SIDE = 2560;

/**
 * Cleans a device photo for the library (PUBLISH §5.1): decoded with its
 * orientation applied and re-encoded, which drops EXIF / GPS / camera data;
 * at most 2560 px on the long side; PNG stays PNG (transparency), the rest
 * become JPEG (quality 0.92). The original file is never changed.
 */
export async function cleanPhoto(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const png = file.type === 'image/png';
  return { blob: await canvasToBlob(c, png ? 'image/png' : 'image/jpeg', png ? undefined : 0.92), width: c.width, height: c.height };
}
