import { describe, expect, it } from 'vitest';
import { lineIntersection, vec } from './geometry';
import { defaultSetup, withHorizon } from '../model/scene';

describe('lineIntersection', () => {
  it('finds the crossing of two lines', () => {
    expect(lineIntersection(vec(0, 0), vec(2, 2), vec(0, 2), vec(2, 0))).toEqual(vec(1, 1));
  });
  it('returns null for parallel lines', () => {
    expect(lineIntersection(vec(0, 0), vec(1, 0), vec(0, 1), vec(1, 1))).toBeNull();
  });
});

describe('withHorizon', () => {
  it('keeps the left and right vanishing points on the horizon', () => {
    const s = withHorizon(defaultSetup(1000, 800), 123);
    expect(s.vpLeft.y).toBe(123);
    expect(s.vpRight.y).toBe(123);
  });
});
