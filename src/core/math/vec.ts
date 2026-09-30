// 2D and 3D vectors. Plain immutable objects.

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const add2 = (a: Vec2, b: Vec2): Vec2 => v2(a.x + b.x, a.y + b.y);
export const sub2 = (a: Vec2, b: Vec2): Vec2 => v2(a.x - b.x, a.y - b.y);
export const len2 = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const add3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale3 = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => add3(a, scale3(sub3(b, a), t));

export function normalize3(a: Vec3): Vec3 {
  const l = len3(a);
  if (!(l > 0)) throw new Error('normalize3: zero-length vector');
  return scale3(a, 1 / l);
}
