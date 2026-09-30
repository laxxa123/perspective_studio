// fast-check generators for valid perspective systems and boxes (tests only).
import fc from 'fast-check';
import { v3, type Vec3 } from '../math/vec';
import type { PerspectiveSystem } from './types';
import { isValid, minVerticalDistance } from './validity';

// JSON cannot store −0, so documents never hold it: generate +0 instead.
const num = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true }).map((x) => (x === 0 ? 0 : x));

export const validPerspective: fc.Arbitrary<PerspectiveSystem> = fc
  .record({
    mode: fc.constantFrom('3pt' as const, '2pt' as const),
    horizonY: num(-1000, 2000),
    vpLeftX: num(-4000, 1000),
    spread: num(100, 6000),
    vFraction: num(0.05, 0.95),
    vFactor: num(1.1, 30),
    vBelow: fc.boolean(),
    anchorX: num(-0.5, 1.5),
    anchorDrop: num(10, 3000),
    eyeHeight: num(0.05, 200),
  })
  .map((r) => {
    const vpRightX = r.vpLeftX + r.spread;
    const verticalX = r.vpLeftX + r.spread * r.vFraction;
    const base: PerspectiveSystem = {
      mode: r.mode,
      horizonY: r.horizonY,
      vpLeftX: r.vpLeftX,
      vpRightX,
      verticalX,
      vpVerticalY: null,
      anchor: { x: r.vpLeftX + r.spread * r.anchorX, y: r.horizonY + r.anchorDrop },
      eyeHeight: r.eyeHeight,
    };
    if (r.mode === '2pt') return base;
    const d = minVerticalDistance(base) * r.vFactor;
    return { ...base, vpVerticalY: r.horizonY + (r.vBelow ? d : -d) };
  })
  .filter(isValid);

export interface Box {
  position: Vec3;
  size: Vec3;
}

export const box: fc.Arbitrary<Box> = fc
  .record({
    x: num(-30, 30),
    y: num(-30, 30),
    z: num(0, 20),
    w: num(0.05, 15),
    d: num(0.05, 15),
    h: num(0.05, 15),
  })
  .map((r) => ({ position: v3(r.x, r.y, r.z), size: v3(r.w, r.d, r.h) }));

/** The 8 corners of a box, indexed by bits (bit 0 = +X, bit 1 = +Y, bit 2 = +Z). */
export const boxCorners = ({ position: p, size: s }: Box): Vec3[] =>
  Array.from({ length: 8 }, (_, i) => v3(p.x + (i & 1 ? s.x : 0), p.y + (i & 2 ? s.y : 0), p.z + (i & 4 ? s.z : 0)));

/** Edges as corner pairs with their family (the axis they run along). */
export const BOX_EDGES: [number, number, 'R' | 'L' | 'V'][] = [
  [0, 1, 'R'], [2, 3, 'R'], [4, 5, 'R'], [6, 7, 'R'],
  [0, 2, 'L'], [1, 3, 'L'], [4, 6, 'L'], [5, 7, 'L'],
  [0, 4, 'V'], [1, 5, 'V'], [2, 6, 'V'], [3, 7, 'V'],
];
