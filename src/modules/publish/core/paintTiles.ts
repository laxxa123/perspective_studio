// A drawing as SKETCH engine tiles (PUBLISH §6.5): straight-alpha RGBA of the
// whole tile ⇄ the brush engine's 256 px premultiplied tiles. Pure.
import { TILE, TILES_X, TILES_Y } from '../../sketch/core/types';

export interface PaintTile {
  index: number;
  data: Uint8Array;
}

/** Splits full-tile pixels (straight alpha, top row first) into engine tiles; empty tiles are skipped. */
export function toEngineTiles(px: Uint8ClampedArray | Uint8Array, width: number, height: number): PaintTile[] {
  const out: PaintTile[] = [];
  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const buf = new Uint8Array(TILE * TILE * 4);
      let any = false;
      for (let r = 0; r < TILE; r++) {
        const y = ty * TILE + r;
        if (y >= height) break;
        for (let c = 0; c < TILE; c++) {
          const x = tx * TILE + c;
          if (x >= width) break;
          const i = (y * width + x) * 4;
          const a = px[i + 3];
          if (!a) continue;
          any = true;
          const o = (r * TILE + c) * 4;
          buf[o] = Math.round((px[i] * a) / 255);
          buf[o + 1] = Math.round((px[i + 1] * a) / 255);
          buf[o + 2] = Math.round((px[i + 2] * a) / 255);
          buf[o + 3] = a;
        }
      }
      if (any) out.push({ index: ty * TILES_X + tx, data: buf });
    }
  }
  return out;
}

/** Whether straight-alpha pixels contain anything visible. */
export function hasInk(px: Uint8ClampedArray | Uint8Array): boolean {
  for (let i = 3; i < px.length; i += 4) if (px[i]) return true;
  return false;
}
