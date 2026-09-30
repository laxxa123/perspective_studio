import { describe, expect, it } from 'vitest';
import { atInfinity, finite, incidence, isFinitePoint, lineThrough, meet, toVec2 } from './homogeneous';
import { det, fromColumns, mulTransposeVec, mulVec } from './mat3';
import { scaled } from './tolerance';
import { add2, cross3, len2, lerp3, normalize3, sub2, v2, v3 } from './vec';

describe('vectors', () => {
  it('does the basic operations', () => {
    expect(add2(v2(1, 2), v2(3, 4))).toEqual(v2(4, 6));
    expect(sub2(v2(1, 2), v2(3, 4))).toEqual(v2(-2, -2));
    expect(len2(v2(3, 4))).toBe(5);
    expect(cross3(v3(1, 0, 0), v3(0, 1, 0))).toEqual(v3(0, 0, 1));
    expect(lerp3(v3(0, 0, 0), v3(2, 4, 6), 0.5)).toEqual(v3(1, 2, 3));
    expect(() => normalize3(v3(0, 0, 0))).toThrow();
  });
});

describe('mat3', () => {
  const m = fromColumns(v3(1, 0, 0), v3(0, 0, 1), v3(0, -1, 0)); // rotation about X
  it('multiplies and transposes', () => {
    expect(mulVec(m, v3(0, 1, 0))).toEqual(v3(0, 0, 1));
    expect(mulTransposeVec(m, v3(0, 0, 1))).toEqual(v3(0, 1, 0));
    expect(det(m)).toBe(1);
  });
});

describe('homogeneous lines', () => {
  it('intersects two lines', () => {
    const l = lineThrough(finite(v2(0, 0)), finite(v2(2, 2)));
    const k = lineThrough(finite(v2(0, 2)), finite(v2(2, 0)));
    expect(toVec2(meet(l, k))).toEqual(v2(1, 1));
  });
  it('meets parallel lines at infinity', () => {
    const l = lineThrough(finite(v2(0, 0)), finite(v2(1, 0)));
    const k = lineThrough(finite(v2(0, 1)), finite(v2(1, 1)));
    const p = meet(l, k);
    expect(isFinitePoint(p)).toBe(false);
    expect(toVec2(p)).toBeNull();
  });
  it('measures incidence for finite and infinite points', () => {
    const vertical = lineThrough(finite(v2(3, 0)), finite(v2(3, 10)));
    expect(incidence(vertical, finite(v2(5, 7)))).toBeCloseTo(2);
    expect(incidence(vertical, atInfinity(0, 1))).toBe(0);
    expect(incidence(vertical, atInfinity(1, 0))).toBeCloseTo(1);
    const degenerate = lineThrough(finite(v2(1, 1)), finite(v2(1, 1)));
    expect(incidence(degenerate, finite(v2(0, 0)))).toBe(Infinity);
    expect(incidence(vertical, atInfinity(0, 0))).toBe(Infinity);
  });
  it('scales tolerances by magnitude', () => {
    expect(scaled(1e-6, 0.5)).toBe(1e-6);
    expect(scaled(1e-6, -2000, 10)).toBeCloseTo(2e-3);
  });
});
