// Tiled layer surfaces (SKETCH §10, §17): each layer is a sparse map of
// 256 px GPU tiles allocated on first paint. A pool recycles freed tiles so
// strokes, snapshots and layers never churn GPU memory.
import { TILE } from '../core/types';
import { bindTarget, clear, freeTarget, target, type GL, type Target } from './gl';

export const TILE_BYTES = TILE * TILE * 4;

export class TilePool {
  private free: Target[] = [];
  /** Tiles handed out and not yet released (memory monitoring, SKETCH §24). */
  live = 0;

  constructor(
    readonly gl: GL,
    private keep = 48,
  ) {}

  /** Copies the whole tile `src` into the texture `dst`. */
  copyInto(src: Target, dst: WebGLTexture) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbo);
    gl.bindTexture(gl.TEXTURE_2D, dst);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, TILE, TILE);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }

  /** A cleared (transparent) tile. */
  get(): Target {
    const t = this.free.pop() ?? target(this.gl, TILE, TILE, true);
    bindTarget(this.gl, t);
    clear(this.gl);
    this.live++;
    return t;
  }

  /** A tile holding a copy of `src`. */
  copyOf(src: Target): Target {
    const t = this.free.pop() ?? target(this.gl, TILE, TILE, true);
    this.live++;
    this.copyInto(src, t.tex);
    return t;
  }

  release(t: Target) {
    this.live--;
    if (this.free.length < this.keep) this.free.push(t);
    else freeTarget(this.gl, t);
  }

  get bytes() {
    return (this.live + this.free.length) * TILE_BYTES;
  }

  dispose() {
    for (const t of this.free) freeTarget(this.gl, t);
    this.free = [];
  }
}

/** One layer's pixels: tile index → tile. Missing tiles are transparent. */
export class Surface {
  readonly tiles = new Map<number, Target>();
  constructor(private pool: TilePool) {}

  get(i: number): Target | undefined {
    return this.tiles.get(i);
  }

  /** The tile at `i`, allocating a transparent one when needed. */
  ensure(i: number): Target {
    let t = this.tiles.get(i);
    if (!t) {
      t = this.pool.get();
      this.tiles.set(i, t);
    }
    return t;
  }

  /** Replaces tile `i` with a copy of `src` (null = transparent). */
  restore(i: number, src: Target | null) {
    const cur = this.tiles.get(i);
    if (!src) {
      if (cur) {
        this.pool.release(cur);
        this.tiles.delete(i);
      }
      return;
    }
    this.pool.copyInto(src, (cur ?? this.ensure(i)).tex);
  }

  /** A copy of tile `i` (null when transparent). */
  snapshot(i: number): Target | null {
    const t = this.tiles.get(i);
    return t ? this.pool.copyOf(t) : null;
  }

  clone(): Surface {
    const s = new Surface(this.pool);
    for (const [i, t] of this.tiles) s.tiles.set(i, this.pool.copyOf(t));
    return s;
  }

  dispose() {
    for (const t of this.tiles.values()) this.pool.release(t);
    this.tiles.clear();
  }
}
