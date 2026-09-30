// Pure 2D geometry for perspective construction. No React, no Konva.

export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Vec2, s: number): Vec2 => vec(a.x * s, a.y * s);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => add(a, scale(sub(b, a), t));
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

/**
 * Intersection of the infinite lines (p1,p2) and (p3,p4).
 * Returns null when the lines are parallel (or nearly so).
 */
export function lineIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const r = sub(p2, p1);
  const s = sub(p4, p3);
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross(sub(p3, p1), s) / denom;
  return add(p1, scale(r, t));
}
