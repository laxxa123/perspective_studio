// WebGL2 plumbing for the SKETCH raster engine (SKETCH §3, ADR-0009): programs,
// textures, framebuffers and the shared unit quad. Every texture keeps
// premultiplied RGBA with row 0 = document y 0 (top), so pixels read back in
// image order; only the final screen pass flips.

export type GL = WebGL2RenderingContext;

export interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

function shader(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(`Shader: ${gl.getShaderInfoLog(s)}`);
  return s;
}

/** Compiles a program; attributes are bound to fixed locations (0 = quad corner, 1.. = per instance). */
export function program(gl: GL, vs: string, fs: string, attribs: string[]): Program {
  const prog = gl.createProgram()!;
  const v = shader(gl, gl.VERTEX_SHADER, vs);
  const f = shader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  attribs.forEach((a, i) => gl.bindAttribLocation(prog, i, a));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`Link: ${gl.getProgramInfoLog(prog)}`);
  gl.deleteShader(v);
  gl.deleteShader(f);
  const u: Program['u'] = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    if (info) u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u };
}

export function texture(gl: GL, w: number, h: number, linear = true, data: ArrayBufferView | null = null): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  const f = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function framebuffer(gl: GL, tex: WebGLTexture): WebGLFramebuffer {
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return fb;
}

/** A render target: texture + framebuffer. */
export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export function target(gl: GL, w: number, h: number, linear = true): Target {
  const tex = texture(gl, w, h, linear);
  return { tex, fbo: framebuffer(gl, tex), w, h };
}

export function freeTarget(gl: GL, t: Target) {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

export function bindTarget(gl: GL, t: Target | null, w?: number, h?: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
  gl.viewport(0, 0, t ? t.w : w!, t ? t.h : h!);
}

export function clear(gl: GL, r = 0, g = 0, b = 0, a = 0) {
  gl.clearColor(r, g, b, a);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/** Blend states (premultiplied). */
export const Blend = { None: 0, Over: 1, Erase: 2, Screen: 3 } as const;
export type Blend = (typeof Blend)[keyof typeof Blend];

export function blend(gl: GL, mode: Blend) {
  if (mode === Blend.None) return gl.disable(gl.BLEND);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  if (mode === Blend.Over) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  else if (mode === Blend.Erase) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
  else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
}

/** Copies `w×h` at (x, y) of `src` into `dst` at (dx, dy). */
export function copyRegion(gl: GL, src: Target, dst: WebGLTexture, x: number, y: number, w: number, h: number, dx = x, dy = y) {
  if (w <= 0 || h <= 0) return;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbo);
  gl.bindTexture(gl.TEXTURE_2D, dst);
  gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, dx, dy, x, y, w, h);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
