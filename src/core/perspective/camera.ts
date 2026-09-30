// Perspective system ⇄ camera, and projection (§6.2, §6.5). The only place
// in the app that projects or unprojects.
import { atInfinity, finite, type HPoint } from '../math/homogeneous';
import { fromColumns, mulTransposeVec, mulVec } from '../math/mat3';
import { EPS, NEAR_FRACTION } from '../math/tolerance';
import {
  add3,
  cross3,
  dot3,
  lerp3,
  normalize3,
  scale3,
  sub3,
  v3,
  type Vec2,
  type Vec3,
} from '../math/vec';
import type { Camera, Family, PerspectiveSystem } from './types';
import { violations } from './validity';

/** Derives the camera from a valid perspective system (§6.2). */
export function deriveCamera(ps: PerspectiveSystem): Camera {
  const bad = violations(ps);
  if (bad.length) throw new Error(`deriveCamera: invalid perspective system (${bad.join(', ')})`);
  const h = ps.horizonY;
  const xL = ps.vpLeftX;
  const xR = ps.vpRightX;
  const xV = ps.verticalX;
  const a = (xV - xL) * (xR - xV);

  let p: Vec2;
  let f2: number;
  if (ps.mode === '3pt' && ps.vpVerticalY !== null) {
    const d = ps.vpVerticalY - h;
    p = { x: xV, y: h + a / d };
    f2 = a * (1 - a / (d * d));
  } else {
    p = { x: xV, y: h };
    f2 = a;
  }
  const f = Math.sqrt(f2);

  const dir = (vx: number, vy: number): Vec3 => normalize3(v3(vx - p.x, vy - p.y, f));
  // Gram–Schmidt removes float error (§6.2).
  const xHat = dir(xR, h);
  const yRaw = dir(xL, h);
  const yHat = normalize3(sub3(yRaw, scale3(xHat, dot3(yRaw, xHat))));
  const zHat = cross3(xHat, yHat);
  const M = fromColumns(xHat, yHat, zHat);

  const r = mulTransposeVec(M, v3(ps.anchor.x - p.x, ps.anchor.y - p.y, f));
  if (!(r.z < 0)) throw new Error('deriveCamera: anchor ray does not reach the ground');
  const t = ps.eyeHeight / -r.z;
  const C = scale3(r, -t);

  return { p, f, M, C, near: NEAR_FRACTION * ps.eyeHeight };
}

/** World point → camera coordinates. */
export const toCamera = (cam: Camera, P: Vec3): Vec3 => mulVec(cam.M, sub3(P, cam.C));

/** Camera coordinates (in front of the near plane) → picture plane. */
export const cameraToPicture = (cam: Camera, Pc: Vec3): Vec2 => ({
  x: cam.p.x + (cam.f * Pc.x) / Pc.z,
  y: cam.p.y + (cam.f * Pc.y) / Pc.z,
});

/** Projects a world point; null when it is behind the camera. */
export function project(cam: Camera, P: Vec3): Vec2 | null {
  const Pc = toCamera(cam, P);
  return Pc.z <= cam.near ? null : cameraToPicture(cam, Pc);
}

/**
 * Projects a world segment, clipping it at the near plane in camera space
 * (§6.5). Null when it lies entirely behind the camera.
 */
export function projectSegment(cam: Camera, A: Vec3, B: Vec3): [Vec2, Vec2] | null {
  let a = toCamera(cam, A);
  let b = toCamera(cam, B);
  const n = cam.near;
  if (a.z <= n && b.z <= n) return null;
  if (a.z <= n) a = lerp3(a, b, (n - a.z) / (b.z - a.z));
  else if (b.z <= n) b = lerp3(b, a, (n - b.z) / (a.z - b.z));
  // Exactly on the plane after interpolation; nudge in front of it.
  if (a.z <= n) a = { ...a, z: n * (1 + 1e-9) };
  if (b.z <= n) b = { ...b, z: n * (1 + 1e-9) };
  return [cameraToPicture(cam, a), cameraToPicture(cam, b)];
}

/** Picture point → world point on the plane z = z0; null when the ray misses it. */
export function unproject(cam: Camera, q: Vec2, z0: number): Vec3 | null {
  const dirW = mulTransposeVec(cam.M, v3(q.x - cam.p.x, q.y - cam.p.y, cam.f));
  if (Math.abs(dirW.z) < EPS) return null;
  const t = (z0 - cam.C.z) / dirW.z;
  if (!(t > 0)) return null;
  return add3(cam.C, scale3(dirW, t));
}

/** World direction of each family (§5: +X toward VP-R, +Y toward VP-L, +Z up). */
export const FAMILY_DIRECTION: Record<Family, Vec3> = {
  R: v3(1, 0, 0),
  L: v3(0, 1, 0),
  V: v3(0, 0, 1),
};

/** The vanishing point of a family, as a homogeneous point (w = 0 at infinity). */
export function vanishingPoint(cam: Camera, family: Family): HPoint {
  const d = mulVec(cam.M, FAMILY_DIRECTION[family]);
  if (Math.abs(d.z) < EPS * Math.max(1, Math.abs(d.x), Math.abs(d.y))) return atInfinity(d.x, d.y);
  return finite({ x: cam.p.x + (cam.f * d.x) / d.z, y: cam.p.y + (cam.f * d.y) / d.z });
}

/**
 * Re-derives the perspective system from a camera (PS-T5): the VPs are the
 * vanishing points of the world axes; the anchor is where the world origin
 * projects; the eye height is the camera height.
 */
export function perspectiveFromCamera(cam: Camera, mode: PerspectiveSystem['mode']): PerspectiveSystem {
  const vp = (fam: Family) => vanishingPoint(cam, fam);
  const L = vp('L');
  const R = vp('R');
  const V = vp('V');
  const origin = project(cam, v3(0, 0, 0));
  if (!origin) throw new Error('perspectiveFromCamera: world origin is behind the camera');
  return {
    mode,
    horizonY: R.y / R.w,
    vpLeftX: L.x / L.w,
    vpRightX: R.x / R.w,
    verticalX: mode === '3pt' ? V.x / V.w : cam.p.x,
    vpVerticalY: mode === '3pt' ? V.y / V.w : null,
    anchor: origin,
    eyeHeight: cam.C.z,
  };
}

/** The world-space viewing ray through picture point q (origin = camera centre). */
export const pictureRay = (cam: Camera, q: Vec2): { origin: Vec3; dir: Vec3 } => ({
  origin: cam.C,
  dir: mulTransposeVec(cam.M, v3(q.x - cam.p.x, q.y - cam.p.y, cam.f)),
});

/** Camera-space depth of a world point (painter's ordering, §9). */
export const depth = (cam: Camera, P: Vec3): number => toCamera(cam, P).z;

/**
 * Parameter s of the point A + s·d on a world line that comes closest to the
 * viewing ray through q — how far a handle dragged to q moves along its
 * family direction (§10.6). Null when the ray is parallel to the line.
 */
export function closestOnAxis(cam: Camera, q: Vec2, A: Vec3, d: Vec3): number | null {
  const { origin, dir: r } = pictureRay(cam, q);
  const w0 = sub3(A, origin);
  const a = dot3(d, d);
  const b = dot3(d, r);
  const c = dot3(r, r);
  const denom = a * c - b * b;
  if (Math.abs(denom) < EPS * a * c) return null;
  return (b * dot3(r, w0) - c * dot3(d, w0)) / denom;
}
