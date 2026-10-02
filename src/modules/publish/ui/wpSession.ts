// WordPress on the phone (PUBLISH §10, §12): the saved site and login, and
// the publish / pull pipeline wired to the real renderer and storage.
import { getSecret, removeSecret, setSecret } from '../../../platform/secrets';
import { assetsOf, mediaOf } from '../core/tile';
import type { SpiralElement } from '../core/types';
import { TILE_H, TILE_W } from '../core/types';
import { canvasToBlob, drawElement, fontCss, measureContext, textLines } from '../render/draw';
import { ensureImages, imageCache } from '../render/images';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import type { Deps } from '../wp/pipeline';
import { isComplete, WpClient, type WpSettings } from '../wp/WpClient';
import { thumbnail } from './session';

const SECRET = 'publish.wp.password';

export async function loadSettings(): Promise<WpSettings> {
  const store = await publishStore();
  const { site, user } = await store.setting('wp', { site: '', user: '' });
  return { site, user, password: (await getSecret(SECRET)) ?? '' };
}

export async function saveSettings(s: WpSettings): Promise<void> {
  const store = await publishStore();
  await store.setSetting('wp', { site: s.site.trim(), user: s.user.trim() });
  if (s.password.trim()) await setSecret(SECRET, s.password.trim());
  else await removeSecret(SECRET);
}

/** The client for the saved site; null when Settings are not filled in. */
export async function wpClient(): Promise<WpClient | null> {
  const s = await loadSettings();
  return isComplete(s) ? new WpClient(s) : null;
}

/** A spiral drawn into its own box as a transparent PNG (the theme turns and fades it). */
async function spiralPng(e: SpiralElement): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(e.w * TILE_W));
  c.height = Math.max(1, Math.round(e.h * TILE_H));
  drawElement(c.getContext('2d')!, { ...e, opacity: 1 }, imageCache, c.width, c.height);
  return canvasToBlob(c, 'image/png');
}

export async function pipelineDeps(wp: WpClient): Promise<Deps> {
  await document.fonts?.ready;
  const ctx = measureContext();
  return {
    store: await publishStore(),
    wp,
    spiralPng,
    lines: (e) => textLines(e),
    thumbnail: async (t) => {
      await ensureImages([...mediaOf(t), ...assetsOf(t)]);
      return thumbnail(t);
    },
    measure: (s, size) => {
      ctx.font = fontCss('Roboto', size >= 64 ? 700 : 400, size);
      return ctx.measureText(s).width;
    },
    progress: (text) => usePublishStore.getState().set({ busy: text }),
    placeOverlay: async (blob, box) => {
      const c = document.createElement('canvas');
      c.width = TILE_W;
      c.height = TILE_H;
      const bmp = await createImageBitmap(blob);
      c.getContext('2d')!.drawImage(bmp, box.x, box.y, box.w, box.h);
      bmp.close();
      return canvasToBlob(c, 'image/png');
    },
  };
}
