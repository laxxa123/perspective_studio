// Picture plane ⇄ screen (§5). The only module that converts between them.
import { clamp } from '../math/scalar';
import type { Vec2 } from '../math/vec';

/** screen = (pp − offset) × zoom */
export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;

export const toScreen = (v: Viewport, p: Vec2): Vec2 => ({
  x: (p.x - v.offsetX) * v.zoom,
  y: (p.y - v.offsetY) * v.zoom,
});

export const toPicture = (v: Viewport, s: Vec2): Vec2 => ({
  x: s.x / v.zoom + v.offsetX,
  y: s.y / v.zoom + v.offsetY,
});

/** Zooms by `factor` keeping the picture point under `screen` fixed (CV-01). */
export function zoomAt(v: Viewport, screen: Vec2, factor: number): Viewport {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const p = toPicture(v, screen);
  return { zoom, offsetX: p.x - screen.x / zoom, offsetY: p.y - screen.y / zoom };
}

/** Pans by a screen-space delta: content follows the finger. */
export const panBy = (v: Viewport, dx: number, dy: number): Viewport => ({
  ...v,
  offsetX: v.offsetX - dx / v.zoom,
  offsetY: v.offsetY - dy / v.zoom,
});

/** Centres picture point `p` on a width × height screen. */
export const centreOn = (v: Viewport, p: Vec2, width: number, height: number): Viewport => ({
  ...v,
  offsetX: p.x - width / 2 / v.zoom,
  offsetY: p.y - height / 2 / v.zoom,
});

/** Screen insets kept clear by UI (bars) when fitting. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The viewport showing `r` centred in the free part of a width × height screen. */
export function fitRect(r: Rect, width: number, height: number, insets: Insets): Viewport {
  const w = Math.max(width - insets.left - insets.right, 1);
  const h = Math.max(height - insets.top - insets.bottom, 1);
  const zoom = clamp(Math.min(w / Math.max(r.width, 1e-9), h / Math.max(r.height, 1e-9)), MIN_ZOOM, MAX_ZOOM);
  const cx = insets.left + w / 2;
  const cy = insets.top + h / 2;
  return { zoom, offsetX: r.x + r.width / 2 - cx / zoom, offsetY: r.y + r.height / 2 - cy / zoom };
}

/** Bounds of a set of points. */
export function boundsOf(points: readonly Vec2[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Where to show an off-screen point (PS-05): the spot on a rectangle inset by
 * `inset` from the screen edges, on the line from the screen centre toward the
 * point, with the direction angle. Null when the point is inside that rectangle.
 */
export function edgeIndicator(
  s: Vec2,
  width: number,
  height: number,
  inset: number,
): { x: number; y: number; angle: number } | null {
  const minX = inset;
  const maxX = width - inset;
  const minY = inset;
  const maxY = height - inset;
  if (s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY) return null;
  const cx = width / 2;
  const cy = height / 2;
  const dx = s.x - cx;
  const dy = s.y - cy;
  const tx = dx === 0 ? Infinity : (dx > 0 ? maxX - cx : minX - cx) / dx;
  const ty = dy === 0 ? Infinity : (dy > 0 ? maxY - cy : minY - cy) / dy;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx) };
}

/** The Konva stage transform for a viewport (x, y, uniform scale). */
export const stageTransform = (v: Viewport) => ({ x: -v.offsetX * v.zoom, y: -v.offsetY * v.zoom, scale: v.zoom });
