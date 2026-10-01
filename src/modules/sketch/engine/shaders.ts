// GLSL for the SKETCH engine. Coordinates are document px unless named
// otherwise; `u_clip` maps document px → clip space (x·a + b, y·c + d).

/** Brush dabs (instanced): coverage into a stroke buffer, or smudge into a work texture. */
export const DAB_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 i_dab0; // x, y, size, alpha
layout(location=2) in vec4 i_dab1; // angle, roundness, hardness, -
layout(location=3) in vec2 i_from; // blender: where the paint comes from (previous dab)
uniform vec4 u_clip;
out vec2 v_uv;
out vec2 v_doc;
out vec2 v_from;
flat out float v_alpha;
flat out float v_hard;
flat out float v_r;
void main() {
  vec2 c = a_corner * 2.0 - 1.0;
  float r = i_dab0.z * 0.5 + 1.0;
  float ca = cos(i_dab1.x), sa = sin(i_dab1.x);
  vec2 l = c * vec2(r, r * max(i_dab1.y, 0.05));
  vec2 doc = i_dab0.xy + vec2(ca * l.x - sa * l.y, sa * l.x + ca * l.y);
  v_uv = c * r / (i_dab0.z * 0.5);
  v_doc = doc;
  v_from = doc - i_dab0.xy + i_from;
  v_alpha = i_dab0.w;
  v_hard = i_dab1.z;
  v_r = i_dab0.z * 0.5;
  gl_Position = vec4(doc.x * u_clip.x + u_clip.y, doc.y * u_clip.z + u_clip.w, 0.0, 1.0);
}`;

const DAB_COMMON = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_doc;
in vec2 v_from;
flat in float v_alpha;
flat in float v_hard;
flat in float v_r;
uniform int u_texture;      // 0 none, 1 grain, 2 canvas, 3 chalk
uniform sampler2D u_mask;   // selection mask (document size)
uniform bool u_useMask;
uniform vec2 u_docSize;
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float coverage() {
  float d = length(v_uv);
  float aa = 1.5 / max(v_r, 0.5);
  float inner = min(v_hard, 1.0 - aa);
  float a = 1.0 - smoothstep(inner, 1.0, d);
  if (v_hard < 0.5) a = mix(a * a, a, v_hard * 2.0); // soft brushes: a longer tail
  // Small dabs: spread their paint instead of aliasing.
  a *= clamp(v_r * 1.4, 0.2, 1.0);
  if (u_texture == 1) a *= mix(1.0, hash(floor(v_doc)), 0.55);
  else if (u_texture == 2) a *= 0.65 + 0.35 * (0.5 + 0.5 * sin(v_doc.x * 1.7) * sin(v_doc.y * 1.7)) * (0.7 + 0.3 * vnoise(v_doc * 0.35));
  else if (u_texture == 3) a *= smoothstep(0.25, 0.7, vnoise(v_doc * 0.6) * 0.6 + hash(floor(v_doc)) * 0.4);
  if (u_useMask) a *= texture(u_mask, v_doc / u_docSize).a;
  return clamp(a, 0.0, 1.0);
}
`;

/** Coverage into the stroke buffer: alpha accumulates ("over"), colour is applied at composite / commit. */
export const DAB_FS =
  DAB_COMMON +
  `void main() {
  float a = coverage() * v_alpha;
  o = vec4(a);
}`;

/** Blender: pulls paint from the previous dab's place (smudge) into a document-size work texture. */
export const SMUDGE_FS =
  DAB_COMMON +
  `uniform sampler2D u_src;     // a copy of the work texture
uniform float u_strength;
void main() {
  float k = coverage() * v_alpha * u_strength;
  if (k <= 0.0) discard;
  vec4 here = texture(u_src, v_doc / u_docSize);
  vec4 carried = texture(u_src, v_from / u_docSize);
  o = mix(here, carried, k);
}`;

/** Textured quads: a source rectangle, placed by a 2×3 matrix (source px → document px). */
export const IMAGE_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
uniform vec4 u_src;        // source rect in source px: x0, y0, x1, y1
uniform mat3 u_m;          // source px → document px
uniform vec4 u_clip;
out vec2 v_src;
out vec2 v_doc;
void main() {
  vec2 s = mix(u_src.xy, u_src.zw, a_corner);
  vec2 doc = (u_m * vec3(s, 1.0)).xy;
  v_src = s;
  v_doc = doc;
  gl_Position = vec4(doc.x * u_clip.x + u_clip.y, doc.y * u_clip.z + u_clip.w, 0.0, 1.0);
}`;

/**
 * Modes: 0 texture × opacity; 1 texture × mask; 2 mask as alpha; 3 paper;
 * 4 solid colour; 5 coverage → colour (stroke commit); 6 texture over a
 * background colour (export).
 */
export const IMAGE_FS = `#version 300 es
precision highp float;
in vec2 v_src;
in vec2 v_doc;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform sampler2D u_mask;
uniform vec2 u_docSize;
uniform int u_mode;
uniform float u_opacity;
uniform vec4 u_color;      // premultiplied
out vec4 o;
void main() {
  vec2 uv = v_src / u_texSize;
  if (u_mode == 0) o = texture(u_tex, uv) * u_opacity;
  else if (u_mode == 1) o = texture(u_tex, uv) * texture(u_mask, v_doc / u_docSize).a;
  else if (u_mode == 2) o = vec4(texture(u_mask, v_doc / u_docSize).a);
  else if (u_mode == 3) {
    if (u_color.a > 0.0) o = u_color;
    else { vec2 c = floor(v_doc / 24.0); float k = mod(c.x + c.y, 2.0); o = vec4(vec3(mix(0.93, 0.85, k)), 1.0); }
  }
  else if (u_mode == 4) o = u_color;
  else if (u_mode == 5) o = u_color * texture(u_tex, uv).a * u_opacity;
  else { vec4 t = texture(u_tex, uv); o = t + u_color * (1.0 - t.a); }
}`;

/**
 * One layer tile into the composite (SKETCH §12): the live stroke is merged
 * into the active layer here, so painting never flattens anything. Normal,
 * screen and erase use fixed-function blending; multiply and overlay read
 * the backdrop copy.
 */
export const LAYER_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
uniform vec2 u_origin;
uniform float u_tile;
uniform vec4 u_clip;
out vec2 v_uv;
void main() {
  v_uv = a_corner;
  vec2 doc = u_origin + a_corner * u_tile;
  gl_Position = vec4(doc.x * u_clip.x + u_clip.y, doc.y * u_clip.z + u_clip.w, 0.0, 1.0);
}`;

export const LAYER_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_layer;
uniform bool u_hasLayer;
uniform sampler2D u_stroke;
uniform int u_strokeMode;  // 0 none, 1 paint, 2 erase
uniform vec3 u_color;
uniform float u_strokeOpacity;
uniform float u_opacity;
uniform int u_blend;       // 0 normal, 1 multiply, 2 screen, 3 overlay, 4 erase
uniform sampler2D u_backdrop;
out vec4 o;
float ov(float b, float s) { return b <= 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s); }
void main() {
  vec4 l = u_hasLayer ? texture(u_layer, v_uv) : vec4(0.0);
  if (u_strokeMode == 1) { float a = texture(u_stroke, v_uv).a * u_strokeOpacity; l = vec4(u_color, 1.0) * a + l * (1.0 - a); }
  else if (u_strokeMode == 2) l *= 1.0 - texture(u_stroke, v_uv).a * u_strokeOpacity;
  vec4 s = l * u_opacity;
  if (u_blend == 1 || u_blend == 3) {
    vec4 b = texture(u_backdrop, v_uv);
    vec3 mixed;
    if (u_blend == 1) mixed = s.rgb * b.rgb;
    else {
      vec3 cs = s.a > 0.0 ? s.rgb / s.a : vec3(0.0);
      vec3 cb = b.a > 0.0 ? b.rgb / b.a : vec3(0.0);
      mixed = vec3(ov(cb.r, cs.r), ov(cb.g, cs.g), ov(cb.b, cs.b)) * s.a * b.a;
    }
    o = vec4(mixed + s.rgb * (1.0 - b.a) + b.rgb * (1.0 - s.a), s.a + b.a - s.a * b.a);
  } else o = s;
}`;

/** Lines with a screen-space width (guides, selection outline, boxes). */
export const LINE_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 i_seg;  // document px
uniform vec3 u_view;               // scale, x, y (document → CSS px)
uniform vec2 u_screen;             // CSS px
uniform float u_width;             // CSS px
out float v_along;
void main() {
  vec2 a = i_seg.xy * u_view.x + u_view.yz;
  vec2 b = i_seg.zw * u_view.x + u_view.yz;
  vec2 d = b - a;
  float len = max(length(d), 1e-4);
  vec2 n = vec2(-d.y, d.x) / len;
  vec2 p = mix(a, b, a_corner.x) + n * (a_corner.y - 0.5) * u_width;
  v_along = a_corner.x * len;
  gl_Position = vec4(p.x / u_screen.x * 2.0 - 1.0, 1.0 - p.y / u_screen.y * 2.0, 0.0, 1.0);
}`;

export const LINE_FS = `#version 300 es
precision highp float;
in float v_along;
uniform vec4 u_color;   // premultiplied
uniform float u_dash;   // 0 = solid
uniform float u_phase;
out vec4 o;
void main() {
  if (u_dash > 0.0 && mod(v_along + u_phase, u_dash * 2.0) > u_dash) o = vec4(0.0, 0.0, 0.0, u_color.a);
  else o = u_color;
}`;

/** Round handles (vanishing points, horizon, transform corners), screen-space. */
export const DOT_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec3 i_dot;  // document x, y, radius (CSS px)
uniform vec3 u_view;
uniform vec2 u_screen;
out vec2 v_uv;
flat out float v_r;
void main() {
  vec2 c = a_corner * 2.0 - 1.0;
  vec2 p = i_dot.xy * u_view.x + u_view.yz + c * (i_dot.z + 1.5);
  v_uv = c * (i_dot.z + 1.5);
  v_r = i_dot.z;
  gl_Position = vec4(p.x / u_screen.x * 2.0 - 1.0, 1.0 - p.y / u_screen.y * 2.0, 0.0, 1.0);
}`;

export const DOT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
flat in float v_r;
uniform vec4 u_color;
uniform float u_dpr;
out vec4 o;
void main() {
  float d = length(v_uv);
  float aa = 1.0 / u_dpr;
  float fill = 1.0 - smoothstep(v_r - aa, v_r + aa, d);
  float ring = 1.0 - smoothstep(v_r - 2.0 - aa, v_r - 2.0 + aa, d);
  o = mix(vec4(1.0), u_color, ring) * fill;
}`;
