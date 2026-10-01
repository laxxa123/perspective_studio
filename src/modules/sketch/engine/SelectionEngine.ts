// Selection (SKETCH §15): a rectangle or lasso polygon becomes a document-size
// mask that brushes respect. "Lift" moves the selected pixels of the active
// layer into a floating texture that can be moved, scaled and rotated, then
// committed back; duplicate lifts a copy; delete clears the masked pixels.
import { DOC_H, DOC_W, TILE } from '../core/types';
import { applyMatrix, IDENTITY_SEL, polygonBounds, selMatrix, tilesInRect, tileXY, type Pt, type Rect, type SelTransform } from '../core/geometry';
import { bindTarget, Blend, clear, freeTarget, target, type GL, type Target } from './gl';
import { clipFor, DOC_CLIP, IMG, mat3, type Renderer } from './Renderer';
import type { Surface } from './TileManager';

export interface Floating {
  layerId: string;
  poly: Pt[];
  bounds: Rect;
  centre: Pt;
  t: SelTransform;
  /** Layer tiles before the lift (null = were empty). */
  before: Map<number, Target | null>;
}

export class SelectionEngine {
  poly: Pt[] | null = null;
  private mask: Target | null = null;
  private float: Target | null = null;
  floating: Floating | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(
    private gl: GL,
    private r: Renderer,
  ) {}

  /** The mask for brushes, or null when nothing is selected. */
  get maskTex(): WebGLTexture | null {
    return this.poly && this.mask ? this.mask.tex : null;
  }

  /** Sets (or clears) the selection polygon and rasterises its mask. */
  set(poly: Pt[] | null) {
    this.poly = poly && poly.length >= 3 ? poly.map((p) => ({ ...p })) : null;
    if (!this.poly) return;
    const gl = this.gl;
    this.mask ??= target(gl, DOC_W, DOC_H, true);
    // The mask is a filled polygon (Canvas 2D rasterises it, anti-aliased; it never paints artwork).
    this.canvas ??= Object.assign(document.createElement('canvas'), { width: DOC_W, height: DOC_H });
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, DOC_W, DOC_H);
    c.fillStyle = '#fff';
    c.beginPath();
    this.poly.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fill();
    gl.bindTexture(gl.TEXTURE_2D, this.mask.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
  }

  get bounds(): Rect | null {
    if (!this.poly) return null;
    const b = polygonBounds(this.poly);
    return { x0: Math.max(0, b.x0), y0: Math.max(0, b.y0), x1: Math.min(DOC_W, b.x1), y1: Math.min(DOC_H, b.y1) };
  }

  /** Clears the masked pixels of `layer`; returns the tiles before (for undo). */
  erase(layer: Surface): Map<number, Target | null> {
    const before = new Map<number, Target | null>();
    const b = this.bounds;
    if (!b || !this.mask) return before;
    for (const i of tilesInRect(b)) {
      const t = layer.get(i);
      if (!t) continue;
      before.set(i, layer.snapshot(i));
      const { tx, ty } = tileXY(i);
      bindTarget(this.gl, t);
      this.r.drawImage({ src: [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE], clip: clipFor(tx * TILE, ty * TILE, TILE, TILE), mode: IMG.MaskAlpha, mask: this.mask.tex }, Blend.Erase);
    }
    return before;
  }

  /** Lifts the selected pixels of `layer` into the floating texture (a copy when `duplicate`). */
  lift(layerId: string, layer: Surface, duplicate: boolean): Floating | null {
    const b = this.bounds;
    if (!b || !this.mask || this.floating || b.x1 <= b.x0 || b.y1 <= b.y0) return null;
    const gl = this.gl;
    this.float ??= target(gl, DOC_W, DOC_H, true);
    bindTarget(gl, this.float);
    clear(gl);
    for (const i of tilesInRect(b)) {
      const t = layer.get(i);
      if (!t) continue;
      const { tx, ty } = tileXY(i);
      this.r.drawImage({ tex: t.tex, src: [0, 0, TILE, TILE], m: new Float32Array([1, 0, 0, 0, 1, 0, tx * TILE, ty * TILE, 1]), clip: DOC_CLIP, mode: IMG.Masked, mask: this.mask.tex }, Blend.None);
    }
    const before = duplicate ? new Map<number, Target | null>() : this.erase(layer);
    this.floating = {
      layerId,
      poly: this.poly!.map((p) => ({ ...p })),
      bounds: b,
      centre: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 },
      t: duplicate ? { ...IDENTITY_SEL, dx: 24, dy: 24 } : { ...IDENTITY_SEL },
      before,
    };
    return this.floating;
  }

  /** The floating selection's matrix (document → document). */
  matrix(): number[] | null {
    const f = this.floating;
    return f ? selMatrix(f.t, f.centre) : null;
  }

  /** The floating polygon where it currently is. */
  transformedPoly(): Pt[] | null {
    const f = this.floating;
    if (!f) return null;
    const m = selMatrix(f.t, f.centre);
    return f.poly.map((p) => applyMatrix(m, p));
  }

  /** Draws the floating pixels (transformed) into the bound target with `clip`. */
  drawFloating(clip: readonly number[]) {
    const f = this.floating;
    if (!f || !this.float) return;
    const b = f.bounds;
    this.r.drawImage({ tex: this.float.tex, texSize: [DOC_W, DOC_H], src: [b.x0, b.y0, b.x1, b.y1], m: mat3(selMatrix(f.t, f.centre)), clip }, Blend.Over);
  }

  /** Puts the floating pixels down into `layer`; returns the change for undo and the new selection polygon. */
  commit(layer: Surface): { before: Map<number, Target | null>; tiles: Set<number>; poly: Pt[] } | null {
    const f = this.floating;
    if (!f) return null;
    const poly = this.transformedPoly()!;
    const dest = polygonBounds(applyCorners(f.bounds, selMatrix(f.t, f.centre)));
    const before = f.before;
    const tiles = new Set<number>(before.keys());
    for (const i of tilesInRect(dest)) {
      if (!before.has(i)) before.set(i, layer.snapshot(i));
      const { tx, ty } = tileXY(i);
      bindTarget(this.gl, layer.ensure(i));
      this.drawFloating(clipFor(tx * TILE, ty * TILE, TILE, TILE));
      tiles.add(i);
    }
    this.floating = null;
    return { before, tiles, poly };
  }

  /** Abandons the floating selection, restoring the layer. Returns the tiles to recompose. */
  cancel(layer: Surface | undefined, release: (t: Target) => void): Set<number> {
    const f = this.floating;
    const tiles = new Set<number>();
    if (!f) return tiles;
    for (const [i, snap] of f.before) {
      layer?.restore(i, snap);
      if (snap) release(snap);
      tiles.add(i);
    }
    this.floating = null;
    return tiles;
  }

  dispose() {
    if (this.mask) freeTarget(this.gl, this.mask);
    if (this.float) freeTarget(this.gl, this.float);
    this.mask = this.float = null;
  }
}

const applyCorners = (b: Rect, m: number[]) =>
  [
    { x: b.x0, y: b.y0 },
    { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 },
    { x: b.x0, y: b.y1 },
  ].map((p) => applyMatrix(m as [number, number, number, number, number, number], p));
