import { dot3, v3, type Vec3 } from './vec';

/** 3×3 matrix stored as its three columns. */
export type Mat3 = { c0: Vec3; c1: Vec3; c2: Vec3 };

export const fromColumns = (c0: Vec3, c1: Vec3, c2: Vec3): Mat3 => ({ c0, c1, c2 });

/** M · v */
export const mulVec = (m: Mat3, v: Vec3): Vec3 =>
  v3(
    m.c0.x * v.x + m.c1.x * v.y + m.c2.x * v.z,
    m.c0.y * v.x + m.c1.y * v.y + m.c2.y * v.z,
    m.c0.z * v.x + m.c1.z * v.y + m.c2.z * v.z,
  );

/** Mᵀ · v */
export const mulTransposeVec = (m: Mat3, v: Vec3): Vec3 => v3(dot3(m.c0, v), dot3(m.c1, v), dot3(m.c2, v));

export const det = (m: Mat3): number =>
  m.c0.x * (m.c1.y * m.c2.z - m.c2.y * m.c1.z) -
  m.c1.x * (m.c0.y * m.c2.z - m.c2.y * m.c0.z) +
  m.c2.x * (m.c0.y * m.c1.z - m.c1.y * m.c0.z);
