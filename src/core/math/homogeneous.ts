// Homogeneous 2D points and lines, so points at infinity (VP-V in 2-point
// mode) use the same line math as finite ones (§6.5).
import { EPS } from './tolerance';
import type { Vec2 } from './vec';

/** Homogeneous point (x, y, w); w = 0 is a direction / point at infinity. */
export type HPoint = { x: number; y: number; w: number };
/** Homogeneous line a·x + b·y + c = 0. */
export type HLine = { a: number; b: number; c: number };

export const finite = (p: Vec2): HPoint => ({ x: p.x, y: p.y, w: 1 });
export const atInfinity = (dx: number, dy: number): HPoint => ({ x: dx, y: dy, w: 0 });

export const isFinitePoint = (p: HPoint): boolean => Math.abs(p.w) > EPS;

export function toVec2(p: HPoint): Vec2 | null {
  return isFinitePoint(p) ? { x: p.x / p.w, y: p.y / p.w } : null;
}

/** The line through two homogeneous points. */
export const lineThrough = (p: HPoint, q: HPoint): HLine => ({
  a: p.y * q.w - p.w * q.y,
  b: p.w * q.x - p.x * q.w,
  c: p.x * q.y - p.y * q.x,
});

/** The intersection of two lines (w = 0 when they are parallel). */
export const meet = (l: HLine, m: HLine): HPoint => ({
  x: l.b * m.c - l.c * m.b,
  y: l.c * m.a - l.a * m.c,
  w: l.a * m.b - l.b * m.a,
});

/**
 * How far point p is from line l: the perpendicular distance for a finite
 * point; for a point at infinity, the sine of the angle between the line and
 * that direction.
 */
export function incidence(l: HLine, p: HPoint): number {
  const n = Math.hypot(l.a, l.b);
  if (n < EPS) return Infinity;
  if (isFinitePoint(p)) return Math.abs(l.a * (p.x / p.w) + l.b * (p.y / p.w) + l.c) / n;
  const d = Math.hypot(p.x, p.y);
  return d < EPS ? Infinity : Math.abs(l.a * p.x + l.b * p.y) / (n * d);
}
