// The brush engine (SKETCH §6, §7): dabs from the stroke builder are stamped
// on the GPU. Paint, erase and airbrush build coverage in a per-stroke buffer
// (so overlapping dabs never exceed the stroke opacity) that the compositor
// shows live and `end()` commits into the layer. The blender smudges the
// layer itself through a document-size work texture.
import type { BrushPreset, Dab, InputPoint } from '../core/types';
import { DOC_H, DOC_W, TILE } from '../core/types';
import { StrokeBuilder } from '../core/stroke';
import { tileRect, tilesInRect, tileXY, type Rect } from '../core/geometry';
import { bindTarget, Blend, clear, copyRegion, freeTarget, target, type GL, type Target } from './gl';
import { clipFor, DOC_CLIP, IMG, Renderer, TEXTURE_IDS } from './Renderer';
import type { LiveStroke } from './Compositor';
import { Surface, type TilePool } from './TileManager';

export interface StrokeParams {
  preset: BrushPreset;
  /** Linear RGB 0..1. */
  color: readonly number[];
  sizeScale: number;
  /** Stroke opacity cap (preset × quick opacity). */
  opacity: number;
  layerId: string;
  layer: Surface;
  mask: WebGLTexture | null;
}

/** What a finished stroke changed: the layer tiles before it (null = was empty). */
export interface TileChange {
  layerId: string;
  before: Map<number, Target | null>;
}

const dabRect = (d: Dab, pad = 2): Rect => {
  const r = d.size / 2 + pad;
  return { x0: d.x - r, y0: d.y - r, x1: d.x + r, y1: d.y + r };
};

export class BrushEngine {
  private p: StrokeParams | null = null;
  private builder: StrokeBuilder | null = null;
  private buffer: Surface;
  private work: Target | null = null;
  private scratch: Target | null = null;
  private before = new Map<number, Target | null>();
  private lastDab: Dab | null = null;
  private lastMove = 0;
  private sprayed = 0;
  /** Dabs stamped in this stroke (diagnostics / tests). */
  dabs = 0;

  constructor(
    private gl: GL,
    private r: Renderer,
    private pool: TilePool,
  ) {
    this.buffer = new Surface(pool);
  }

  get active() {
    return this.p !== null;
  }
  get kind() {
    return this.p?.preset.engine ?? null;
  }

  /** The live stroke for the compositor (blender strokes edit the layer directly). */
  live(): LiveStroke | null {
    const p = this.p;
    if (!p || p.preset.engine === 'blend') return null;
    return { layerId: p.layerId, surface: this.buffer, mode: p.preset.engine === 'erase' ? 2 : 1, color: p.color, opacity: p.opacity };
  }

  /** Starts a stroke; returns the tiles it touched. */
  begin(params: StrokeParams, first: InputPoint): Set<number> {
    this.cancel();
    this.p = params;
    this.builder = new StrokeBuilder(params.preset, { sizeScale: params.sizeScale });
    this.dabs = 0;
    this.lastDab = null;
    this.lastMove = first.t;
    this.sprayed = first.t;
    if (params.preset.engine === 'blend') this.loadWork(params.layer);
    return this.stamp(this.builder.add([first]));
  }

  move(points: InputPoint[]): Set<number> {
    if (!this.builder || !points.length) return new Set();
    this.lastMove = points[points.length - 1].t;
    return this.stamp(this.builder.add(points));
  }

  /** Airbrush keeps spraying while the pen rests (SKETCH §6). */
  tick(now: number): Set<number> {
    const p = this.p;
    const cur = this.builder?.current;
    if (!p || p.preset.engine !== 'airbrush' || !cur) return new Set();
    const dt = now - this.sprayed;
    if (dt < 16 || now - this.lastMove < 24) return new Set();
    this.sprayed = now;
    return this.stamp([{ ...cur, alpha: Math.min(1, cur.alpha * Math.min(4, dt / 16)) }]);
  }

  private stamp(dabs: Dab[]): Set<number> {
    const touched = new Set<number>();
    const p = this.p;
    if (!p || !dabs.length) return touched;
    this.dabs += dabs.length;
    if (p.preset.engine === 'blend') return this.smudge(dabs, touched);
    // Group dabs by tile, then stamp each tile once.
    const byTile = new Map<number, Dab[]>();
    for (const d of dabs) for (const i of tilesInRect(dabRect(d))) (byTile.get(i) ?? byTile.set(i, []).get(i)!).push(d);
    const tex = TEXTURE_IDS[p.preset.texture];
    for (const [i, list] of byTile) {
      const t = this.buffer.ensure(i);
      const { tx, ty } = tileXY(i);
      bindTarget(this.gl, t);
      this.r.drawDabs(list, clipFor(tx * TILE, ty * TILE, TILE, TILE), tex, p.mask);
      touched.add(i);
    }
    return touched;
  }

  // ----- blender -----

  private loadWork(layer: Surface) {
    const gl = this.gl;
    this.work ??= target(gl, DOC_W, DOC_H, true);
    this.scratch ??= target(gl, DOC_W, DOC_H, true);
    bindTarget(gl, this.work);
    clear(gl);
    for (const [i, t] of layer.tiles) {
      const { tx, ty } = tileXY(i);
      this.r.drawImage({ tex: t.tex, src: [0, 0, TILE, TILE], m: new Float32Array([1, 0, 0, 0, 1, 0, tx * TILE, ty * TILE, 1]), clip: DOC_CLIP, mode: IMG.Texture }, Blend.None);
    }
  }

  private smudge(dabs: Dab[], touched: Set<number>): Set<number> {
    const p = this.p!;
    const work = this.work!;
    const scratch = this.scratch!;
    const gl = this.gl;
    const strength = p.preset.strength ?? 0.6;
    const tex = TEXTURE_IDS[p.preset.texture];
    for (const d of dabs) {
      const from = this.lastDab ?? d;
      this.lastDab = d;
      const a = dabRect(d);
      const b = dabRect(from);
      const x0 = Math.max(0, Math.floor(Math.min(a.x0, b.x0)));
      const y0 = Math.max(0, Math.floor(Math.min(a.y0, b.y0)));
      const x1 = Math.min(DOC_W, Math.ceil(Math.max(a.x1, b.x1)));
      const y1 = Math.min(DOC_H, Math.ceil(Math.max(a.y1, b.y1)));
      if (x1 <= x0 || y1 <= y0) continue;
      copyRegion(gl, work, scratch.tex, x0, y0, x1 - x0, y1 - y0);
      bindTarget(gl, work);
      this.r.drawSmudge(d, from, scratch.tex, strength * p.opacity, tex, p.mask);
      for (const i of tilesInRect(a)) touched.add(i);
    }
    // Write the touched tiles back into the layer (snapshotting each one first).
    for (const i of touched) {
      if (!this.before.has(i)) this.before.set(i, p.layer.snapshot(i));
      const rc = tileRect(i);
      copyRegion(gl, work, p.layer.ensure(i).tex, rc.x0, rc.y0, rc.x1 - rc.x0, rc.y1 - rc.y0, 0, 0);
    }
    return touched;
  }

  // ----- finish -----

  /** Commits the stroke into its layer; returns what changed (for undo) and the tiles to recompose. */
  end(): { change: TileChange | null; tiles: Set<number> } {
    const p = this.p;
    if (!p || !this.builder) return { change: null, tiles: new Set() };
    const tiles = this.stamp(this.builder.end());
    const gl = this.gl;
    let change: TileChange | null;
    if (p.preset.engine === 'blend') {
      change = this.before.size ? { layerId: p.layerId, before: this.before } : null;
      for (const i of this.before.keys()) tiles.add(i);
    } else {
      const before = new Map<number, Target | null>();
      const erase = p.preset.engine === 'erase';
      for (const [i, buf] of this.buffer.tiles) {
        tiles.add(i);
        if (erase && !p.layer.get(i)) continue;
        before.set(i, p.layer.snapshot(i));
        const t = p.layer.ensure(i);
        bindTarget(gl, t);
        this.r.drawImage({ tex: buf.tex, src: [0, 0, TILE, TILE], clip: clipFor(0, 0, TILE, TILE), mode: IMG.Coverage, color: [...p.color.slice(0, 3), 1], opacity: p.opacity }, erase ? Blend.Erase : Blend.Over);
      }
      change = before.size ? { layerId: p.layerId, before } : null;
    }
    this.before = new Map();
    this.reset();
    return { change, tiles };
  }

  /** Drops the stroke (a second finger arrived: it was a gesture). Returns the tiles to recompose. */
  cancel(): Set<number> {
    const tiles = new Set<number>(this.buffer.tiles.keys());
    const p = this.p;
    if (p) {
      for (const [i, snap] of this.before) {
        p.layer.restore(i, snap);
        if (snap) this.pool.release(snap);
        tiles.add(i);
      }
    }
    this.before = new Map();
    this.reset();
    return tiles;
  }

  private reset() {
    this.buffer.dispose();
    this.p = null;
    this.builder = null;
    this.lastDab = null;
  }

  dispose() {
    this.cancel();
    if (this.work) freeTarget(this.gl, this.work);
    if (this.scratch) freeTarget(this.gl, this.scratch);
    this.work = this.scratch = null;
  }
}
