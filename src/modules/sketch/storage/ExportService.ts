// PNG export (SKETCH §20): the engine flattens the layers at full resolution;
// here the pixels become a PNG that is saved to the device or shared. A 2D
// canvas is used only to encode the finished image.
import { saveImageToDevice, shareFile } from '../../../platform/files';

export interface Pixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export function encodePng(px: Pixels): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = px.w;
  c.height = px.h;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.w, px.h), 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}

/** A file name for a project's PNG. */
export const pngName = (name: string) => `${name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'sketch'}.png`;

export async function sharePng(name: string, png: Blob): Promise<void> {
  await shareFile(pngName(name), png);
}

/** Saves the PNG to the device; returns where it went. */
export async function savePng(name: string, png: Blob): Promise<string> {
  return saveImageToDevice(pngName(name), png);
}

