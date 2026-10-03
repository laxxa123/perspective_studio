// Draw calls shared by the engine parts: dabs, textured quads, layer tiles,
// lines and handles. Owns the programs and the instance buffers.
import type { Dab } from '../core/types';
import { DOC_H, DOC_W, TILE } from '../core/types';
import type { View } from '../core/geometry';
import { blend, Blend, program, type GL, type Program } from './gl';
import { DAB_FS, DAB_VS, DOT_FS, DOT_VS, IMAGE_FS, IMAGE_VS, LAYER_FS, LAYER_VS, LINE_FS, LINE_VS, SMUDGE_FS } from './shaders';

/** document px → clip for a target whose origin (document px) is (ox, oy) and size w×h (no flip). */
export const clipFor = (ox: number, oy: number, w: number, h: number): [number, number, number, number] => [2 / w, -1 - (2 * ox) / w, 2 / h, -1 - (2 * oy) / h];
/** The whole document as a target. */
export const DOC_CLIP = clipFor(0, 0, DOC_W, DOC_H);

/** Identity 3×3 (column-major). */
export const IDENTITY: Float32Array = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
/** [a b c d e f] (x' = a x + c y + e, y' = b x + d y + f) → column-major mat3. */
export const mat3 = (m: readonly number[]) => new Float32Array([m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);

export const IMG = { Texture: 0, Masked: 1, MaskAlpha: 2, Paper: 3, Solid: 4, Coverage: 5, OverColor: 6 } as const;

export interface ImageOpts {
  tex?: WebGLTexture | null;
  texSize?: [number, number];
  /** Source rect in source px. */
  src: [number, number, number, number];
  m?: Float32Array;
  clip: readonly number[];
  mode?: number;
  opacity?: number;
  color?: readonly number[];
  mask?: WebGLTexture | null;
}

export interface LayerTileOpts {
  layer: WebGLTexture | null;
  origin: [number, number];
  clip: readonly number[];
  opacity: number;
  blend: number;
  backdrop?: WebGLTexture | null;
  stroke?: { tex: WebGLTexture; mode: 1 | 2; color: readonly number[]; opacity: number } | null;
}

export const TEXTURE_IDS = { none: 0, grain: 1, canvas: 2, chalk: 3 } as const;

export class Renderer {
  readonly dab: Program;
  readonly smudge: Program;
  readonly image: Program;
  readonly layer: Program;
  readonly line: Program;
  readonly dot: Program;
  private quad: WebGLBuffer;
  private inst: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private instData = new Float32Array(10 * 512);
  /** A 1×1 transparent texture for unused samplers. */
  readonly blank: WebGLTexture;

  constructor(readonly gl: GL) {
    this.dab = program(gl, DAB_VS, DAB_FS, ['a_corner', 'i_dab0', 'i_dab1', 'i_from']);
    this.smudge = program(gl, DAB_VS, SMUDGE_FS, ['a_corner', 'i_dab0', 'i_dab1', 'i_from']);
    this.image = program(gl, IMAGE_VS, IMAGE_FS, ['a_corner']);
    this.layer = program(gl, LAYER_VS, LAYER_FS, ['a_corner']);
    this.line = program(gl, LINE_VS, LINE_FS, ['a_corner', 'i_seg']);
    this.dot = program(gl, DOT_VS, DOT_FS, ['a_corner', 'i_dot']);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.inst = gl.createBuffer()!;
    this.blank = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  private tex(unit: number, t: WebGLTexture | null | undefined, loc: WebGLUniformLocation | null) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t ?? this.blank);
    gl.uniform1i(loc, unit);
  }

  /** Configures per-instance attributes 1.. from a float layout (sizes per attribute). */
  private instances(data: Float32Array, count: number, sizes: number[]) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * sizes.reduce((a, b) => a + b, 0)), gl.STREAM_DRAW);
    const stride = sizes.reduce((a, b) => a + b, 0) * 4;
    let off = 0;
    for (let i = 1; i <= 3; i++) {
      const n = sizes[i - 1];
      if (!n) {
        gl.disableVertexAttribArray(i);
        continue;
      }
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(i, 1);
      off += n * 4;
    }
  }

  private noInstances() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    for (let i = 1; i <= 3; i++) gl.disableVertexAttribArray(i);
  }

  private ensureInst(n: number) {
    if (this.instData.length < n) this.instData = new Float32Array(Math.max(n, this.instData.length * 2));
    return this.instData;
  }

  /** Brush dabs into the bound target (coverage, "over"). */
  drawDabs(dabs: readonly Dab[], clip: readonly number[], texture: number, mask: WebGLTexture | null) {
    if (!dabs.length) return;
    const gl = this.gl;
    const d = this.ensureInst(dabs.length * 10);
    dabs.forEach((b, i) => d.set([b.x, b.y, b.size, b.alpha, b.angle, b.roundness, b.hardness, 0, b.x, b.y], i * 10));
    const p = this.dab;
    gl.useProgram(p.prog);
    gl.uniform4fv(p.u.u_clip, clip);
    gl.uniform1i(p.u.u_texture, texture);
    gl.uniform1i(p.u.u_useMask, mask ? 1 : 0);
    gl.uniform2f(p.u.u_docSize, DOC_W, DOC_H);
    this.tex(0, mask, p.u.u_mask);
    this.instances(d, dabs.length, [4, 4, 2]);
    blend(gl, Blend.Over);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dabs.length);
  }

  /** One smudge dab into the bound (document-size) work target, reading `src`. */
  drawSmudge(dab: Dab, from: { x: number; y: number }, src: WebGLTexture, strength: number, texture: number, mask: WebGLTexture | null) {
    const gl = this.gl;
    const d = this.ensureInst(10);
    d.set([dab.x, dab.y, dab.size, dab.alpha, dab.angle, dab.roundness, dab.hardness, 0, from.x, from.y]);
    const p = this.smudge;
    gl.useProgram(p.prog);
    gl.uniform4fv(p.u.u_clip, DOC_CLIP);
    gl.uniform1i(p.u.u_texture, texture);
    gl.uniform1i(p.u.u_useMask, mask ? 1 : 0);
    gl.uniform2f(p.u.u_docSize, DOC_W, DOC_H);
    gl.uniform1f(p.u.u_strength, strength);
    this.tex(0, mask, p.u.u_mask);
    this.tex(1, src, p.u.u_src);
    this.instances(d, 1, [4, 4, 2]);
    blend(gl, Blend.None);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
  }

  /** A textured / solid quad into the bound target; blending is the caller's. */
  drawImage(o: ImageOpts, mode: Blend = Blend.Over) {
    const gl = this.gl;
    const p = this.image;
    gl.useProgram(p.prog);
    this.noInstances();
    gl.uniform4fv(p.u.u_src, o.src);
    gl.uniformMatrix3fv(p.u.u_m, false, o.m ?? IDENTITY);
    gl.uniform4fv(p.u.u_clip, o.clip);
    gl.uniform2fv(p.u.u_texSize, o.texSize ?? [TILE, TILE]);
    gl.uniform2f(p.u.u_docSize, DOC_W, DOC_H);
    gl.uniform1i(p.u.u_mode, o.mode ?? IMG.Texture);
    gl.uniform1f(p.u.u_opacity, o.opacity ?? 1);
    gl.uniform4fv(p.u.u_color, o.color ?? [0, 0, 0, 0]);
    this.tex(0, o.tex, p.u.u_tex);
    this.tex(1, o.mask, p.u.u_mask);
    blend(gl, mode);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** One layer tile into the composite. */
  drawLayerTile(o: LayerTileOpts) {
    const gl = this.gl;
    const p = this.layer;
    gl.useProgram(p.prog);
    this.noInstances();
    gl.uniform2fv(p.u.u_origin, o.origin);
    gl.uniform1f(p.u.u_tile, TILE);
    gl.uniform4fv(p.u.u_clip, o.clip);
    gl.uniform1i(p.u.u_hasLayer, o.layer ? 1 : 0);
    this.tex(0, o.layer, p.u.u_layer);
    this.tex(1, o.stroke?.tex, p.u.u_stroke);
    this.tex(2, o.backdrop, p.u.u_backdrop);
    gl.uniform1i(p.u.u_strokeMode, o.stroke?.mode ?? 0);
    gl.uniform3fv(p.u.u_color, (o.stroke?.color ?? [0, 0, 0]).slice(0, 3));
    gl.uniform1f(p.u.u_strokeOpacity, o.stroke?.opacity ?? 1);
    gl.uniform1f(p.u.u_opacity, o.opacity);
    gl.uniform1i(p.u.u_blend, o.blend);
    blend(gl, o.blend === 1 || o.blend === 3 ? Blend.None : o.blend === 2 ? Blend.Screen : o.blend === 4 ? Blend.Erase : Blend.Over);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Lines in document px with a screen-space width, onto the screen. */
  drawLines(segs: readonly (readonly number[])[], view: View, screen: [number, number], width: number, color: readonly number[], dash = 0, phase = 0) {
    if (!segs.length) return;
    const gl = this.gl;
    const d = this.ensureInst(segs.length * 4);
    segs.forEach((s, i) => d.set(s, i * 4));
    const p = this.line;
    gl.useProgram(p.prog);
    gl.uniform3f(p.u.u_view, view.scale, view.x, view.y);
    gl.uniform2fv(p.u.u_screen, screen);
    gl.uniform1f(p.u.u_width, width);
    gl.uniform4fv(p.u.u_color, color);
    gl.uniform1f(p.u.u_dash, dash);
    gl.uniform1f(p.u.u_phase, phase);
    this.instances(d, segs.length, [4, 0, 0]);
    blend(gl, Blend.Over);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segs.length);
  }

  /** Round handles at document points, radius in CSS px. */
  drawDots(dots: readonly { x: number; y: number; r: number }[], view: View, screen: [number, number], color: readonly number[], dpr: number, ring = true) {
    if (!dots.length) return;
    const gl = this.gl;
    const d = this.ensureInst(dots.length * 3);
    dots.forEach((s, i) => d.set([s.x, s.y, s.r], i * 3));
    const p = this.dot;
    gl.useProgram(p.prog);
    gl.uniform3f(p.u.u_view, view.scale, view.x, view.y);
    gl.uniform2fv(p.u.u_screen, screen);
    gl.uniform4fv(p.u.u_color, color);
    gl.uniform1f(p.u.u_dpr, dpr);
    gl.uniform1f(p.u.u_ring, ring ? 1 : 0);
    this.instances(d, dots.length, [3, 0, 0]);
    blend(gl, Blend.Over);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dots.length);
  }

  dispose() {
    const gl = this.gl;
    for (const p of [this.dab, this.smudge, this.image, this.layer, this.line, this.dot]) gl.deleteProgram(p.prog);
    gl.deleteBuffer(this.quad);
    gl.deleteBuffer(this.inst);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.blank);
  }
}
