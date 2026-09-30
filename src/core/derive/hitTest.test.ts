import { describe, expect, it } from 'vitest';
import { hitRect, hitSegment, hitTest } from './hitTest';
import type { RenderItem } from './renderModel';

const items: RenderItem[] = [
  { key: 'a', entityId: 'A', role: 'face', points: [0, 0, 10, 0, 10, 10, 0, 10], closed: true },
  { key: 'b', entityId: 'B', role: 'edge', points: [5, 5, 50, 5] },
  { key: 'g', role: 'horizon', points: [0, 0, 100, 0] },
];

describe('hit-testing (§9)', () => {
  it('returns the topmost entity', () => {
    expect(hitTest(items, { x: 5, y: 5.5 }, 1)).toBe('B');
    expect(hitTest(items, { x: 2, y: 2 }, 1)).toBe('A');
    expect(hitTest(items, { x: 80, y: 80 }, 1)).toBeNull();
    expect(hitTest(items, { x: 5, y: 5.5 }, 1, (id) => id !== 'B')).toBe('A');
  });
  it('finds entities in a marquee and along a sweep', () => {
    expect(hitRect(items, { x: 40, y: 0, width: 20, height: 20 })).toEqual(['B']);
    expect(hitSegment(items, { x: 30, y: -10 }, { x: 30, y: 20 }, 1)).toEqual(['B']);
  });
});
