// The compositor (SKETCH §12, §17): layers are blended tile by tile into a
// document-size composite, and only dirty tiles are recomposed. Pan / zoom
// only re-draws the composite as one textured quad (SKETCH §24). Guides,
// references and the selection are drawn on screen, never into the artwork.
import type { LayerModel } from '../core/types';
import { BLEND_MODES, DOC_H, DOC_W, TILE, TILES_X, TILES_Y } from '../core/types';
import { tileRect, tileXY } from '../core/geometry';
import type { View } from '../core/geometry';
import { bindTarget, Blend, clear, copyRegion, freeTarget, target, type GL, type Target } from './gl';
import { clipFor, DOC_CLIP, IMG, mat3, Renderer } from './Renderer';
import type { Surface } from './TileManager';

export interface LiveStroke {
  layerId: string;
  surface: Surface;
  mode: 1 | 2;
  color: readonly number[];
  opacity: number;
}

export interface CompositeLayer {
  model: LayerModel;
  surface: Surface;
}

/** Background colours (premultiplied); transparent shows a checkerboard on screen. */
export const BACKGROUNDS = { white: [1, 1, 1, 1], paper: [0.973, 0.957, 0.925, 1], transparent: [0, 0, 0, 0] } as const;

const ALL_TILES = Array.from({ length: TILES_X * TILES_Y }, (_, i) => i);

export class Compositor {
  readonly composite: Target;
  private backdrop: Target;
  private dirty = new Set<number>(ALL_TILES);
  private mipsStale = true;
  private filter = 0;

  constructor(
    private gl: GL,
    private r: Renderer,
  ) {
    this.composite = target(gl, DOC_W, DOC_H, true);
    this.backdrop = target(gl, TILE, TILE, false);
  }

  mark(tiles: Iterable<number>) {
    for (const t of tiles) this.dirty.add(t);
  }
  markAll() {
    this.mark(ALL_TILES);
  }
  get hasDirty() {
    return this.dirty.size > 0;
  }

  /** Recomposes the dirty tiles (bottom → top). */
  update(layers: readonly CompositeLayer[], live: LiveStroke | null) {
    if (!this.dirty.size) return;
    const gl = this.gl;
    bindTarget(gl, this.composite);
    gl.enable(gl.SCISSOR_TEST);
    for (const i of this.dirty) {
      const rc = tileRect(i);
      const { tx, ty } = tileXY(i);
      gl.scissor(rc.x0, rc.y0, rc.x1 - rc.x0, rc.y1 - rc.y0);
      clear(gl);
      for (const { model, surface } of layers) {
        if (!model.visible) continue;
        const tile = surface.get(i);
        const stroke = live && live.layerId === model.id ? live.surface.get(i) : undefined;
        if (!tile && !(stroke && live?.mode === 1)) continue;
        const blendId = BLEND_MODES.indexOf(model.blend);
        if (blendId === 1 || blendId === 3) {
          copyRegion(gl, this.composite, this.backdrop.tex, rc.x0, rc.y0, rc.x1 - rc.x0, rc.y1 - rc.y0, 0, 0);
          bindTarget(gl, this.composite);
        }
        this.r.drawLayerTile({
          layer: tile?.tex ?? null,
          origin: [tx * TILE, ty * TILE],
          clip: DOC_CLIP,
          opacity: model.opacity,
          blend: blendId,
          backdrop: this.backdrop.tex,
          stroke: stroke && live ? { tex: stroke.tex, mode: live.mode, color: live.color, opacity: live.opacity } : null,
        });
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    this.dirty.clear();
    this.mipsStale = true;
  }

  /** Sets the composite's sampling for the current zoom (mipmaps when zoomed out, crisp pixels when zoomed in). */
  private sampling(devScale: number) {
    const gl = this.gl;
    const mode = devScale < 0.7 ? 2 : devScale >= 2 ? 1 : 0;
    gl.bindTexture(gl.TEXTURE_2D, this.composite.tex);
    if (mode === 2 && this.mipsStale) {
      gl.generateMipmap(gl.TEXTURE_2D);
      this.mipsStale = false;
    }
    if (mode === this.filter) return;
    this.filter = mode;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mode === 2 ? gl.LINEAR_MIPMAP_LINEAR : mode === 1 ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mode === 1 ? gl.NEAREST : gl.LINEAR);
  }

  /** document px → clip for the screen (CSS view, device size). */
  static screenClip(v: View, w: number, h: number, dpr: number): [number, number, number, number] {
    return [(2 * v.scale * dpr) / w, (2 * v.x * dpr) / w - 1, (-2 * v.scale * dpr) / h, 1 - (2 * v.y * dpr) / h];
  }

  /** Paper + references + artwork onto the bound screen. */
  drawArtwork(clip: readonly number[], devScale: number, background: readonly number[], refs: readonly { tex: WebGLTexture; w: number; h: number; m: number[]; opacity: number }[]) {
    this.r.drawImage({ src: [0, 0, DOC_W, DOC_H], clip, mode: IMG.Paper, color: background }, Blend.None);
    for (const ref of refs) this.r.drawImage({ tex: ref.tex, texSize: [ref.w, ref.h], src: [0, 0, ref.w, ref.h], m: mat3(ref.m), clip, opacity: ref.opacity });
    this.sampling(devScale);
    this.r.drawImage({ tex: this.composite.tex, texSize: [DOC_W, DOC_H], src: [0, 0, DOC_W, DOC_H], clip });
  }

  /**
   * The flattened artwork at `scale` (SKETCH §20): no UI, no guides, no hidden
   * layers. Returns straight-alpha RGBA rows, top first.
   */
  flatten(background: readonly number[], scale = 1): { w: number; h: number; data: Uint8ClampedArray } {
    const gl = this.gl;
    const w = Math.max(1, Math.round(DOC_W * scale));
    const h = Math.max(1, Math.round(DOC_H * scale));
    if (scale < 0.7) this.sampling(scale);
    const out = target(gl, w, h, false);
    bindTarget(gl, out);
    clear(gl);
    this.r.drawImage({ tex: this.composite.tex, texSize: [DOC_W, DOC_H], src: [0, 0, DOC_W, DOC_H], clip: clipFor(0, 0, DOC_W, DOC_H), mode: IMG.OverColor, color: background }, Blend.None);
    const data = new Uint8ClampedArray(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    freeTarget(gl, out);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a && a < 255) {
        const k = 255 / a;
        data[i] = Math.min(255, data[i] * k);
        data[i + 1] = Math.min(255, data[i + 1] * k);
        data[i + 2] = Math.min(255, data[i + 2] * k);
      }
    }
    return { w, h, data };
  }

  dispose() {
    freeTarget(this.gl, this.composite);
    freeTarget(this.gl, this.backdrop);
  }
}
