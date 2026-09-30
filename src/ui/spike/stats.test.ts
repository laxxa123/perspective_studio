import { describe, expect, it } from 'vitest';
import { frameStats, percentile } from './stats';

describe('spike stats', () => {
  it('computes percentiles', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4], 95)).toBe(4);
    expect(percentile([], 50)).toBeNaN();
  });
  it('computes fps from frame times', () => {
    const s = frameStats([0, 16, 32, 48, 64]);
    expect(s.fps).toBeCloseTo(62.5);
    expect(s.p50).toBe(16);
  });
});
