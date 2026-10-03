import { describe, expect, it } from 'vitest';
import { add, bounds, cannotAdd, connected, readBlocks, remove, STARTER, turn, turnAll, MAX_BLOCKS, type Blocks, type Cell } from './blocks';
import { isoFaces, isoSvg } from './iso';

const sorted = (b: Blocks) => [...b].map((c) => c.join(',')).sort();

describe('blocks (OBJECTS §A.3)', () => {
  it('adds within the limits and says why not otherwise', () => {
    expect(cannotAdd(STARTER, [0, 0, 0])).toBe('occupied');
    expect(cannotAdd(STARTER, [0, -1, 0])).toBe('below-floor');
    const row: Blocks = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0]];
    expect(cannotAdd(row, [6, 0, 0])).toBe('too-big');
    expect(cannotAdd(row.slice(0, 5), [5, 0, 0])).toBeNull();
    expect(cannotAdd([[0, 0, 0]], [2, 0, 0])).toBe('detached');
    expect(cannotAdd([], [4, 0, 4])).toBeNull();
    const full = Array.from({ length: MAX_BLOCKS }, (_, i): Cell => [i % 6, Math.floor(i / 6), 0]);
    expect(cannotAdd(full, [0, 0, 1])).toBe('full');
    expect(add(STARTER, [0, 0, 0])).toBe(STARTER);
    expect(add(STARTER, [3, 0, 2])).toHaveLength(8);
    expect(remove(STARTER, [0, 1, 0])).toHaveLength(6);
  });

  it('knows when an object is one piece', () => {
    expect(connected(STARTER)).toBe(true);
    expect(connected([])).toBe(true);
    expect(connected([[0, 0, 0], [2, 0, 0]])).toBe(false);
    expect(connected(remove(STARTER, [0, 0, 1]))).toBe(false);
  });

  it('turns a quarter about each axis; four turns are the identity', () => {
    expect(turn([1, 0, 0], 'z')).toEqual([0, 1, 0]);
    expect(turn([0, 1, 0], 'x')).toEqual([0, 0, 1]);
    expect(turn([0, 0, 1], 'y')).toEqual([1, 0, 0]);
    for (const a of ['x', 'y', 'z'] as const) {
      let c: Cell = [1, 2, 3];
      for (let i = 0; i < 4; i++) c = turn(c, a);
      expect(c).toEqual([1, 2, 3]);
    }
  });

  it('turns the whole object and keeps it standing on the floor, in one piece', () => {
    for (const a of ['x', 'y', 'z'] as const) {
      const t = turnAll(STARTER, a);
      expect(t).toHaveLength(STARTER.length);
      expect(bounds(t)!.min[1]).toBe(0);
      expect(connected(t)).toBe(true);
    }
    // Four turns about the vertical axis bring back the same cells.
    let t: Blocks = STARTER;
    for (let i = 0; i < 4; i++) t = turnAll(t, 'y');
    expect(sorted(t)).toEqual(sorted(STARTER));
    expect(turnAll([], 'x')).toEqual([]);
  });

  it('reads a saved list, dropping anything unusable', () => {
    expect(readBlocks('x')).toBeNull();
    expect(readBlocks([[0, 0, 0], [0, 0, 0], [1, 'a', 0], [1.5, 0, 0], [1, 0, 0]])).toEqual([[0, 0, 0], [1, 0, 0]]);
  });
});

describe('isometric drawing (OBJECTS §A.6)', () => {
  it('draws the three visible faces of a block, nearer faces last', () => {
    expect(isoFaces([[0, 0, 0]])).toHaveLength(3);
    // Two blocks side by side: the touching faces are not drawn.
    expect(isoFaces([[0, 0, 0], [1, 0, 0]])).toHaveLength(5);
    const f = isoFaces([[0, 0, 0], [1, 1, 1]]);
    expect(f[f.length - 1].depth).toBeGreaterThan(f[0].depth);
  });

  it('makes a self-contained SVG of the asked size, with a fixed line width', () => {
    const svg = isoSvg(STARTER, { size: 96, stroke: 1.2 });
    expect(svg).toMatch(/^<svg [^>]*width="96" height="96"/);
    expect(svg).toContain('stroke-width="1.2"');
    expect(svg.match(/<path /g)).toHaveLength(isoFaces(STARTER).length);
    // Every point lies inside the drawing.
    const nums = [...svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(96);
    expect(isoSvg([])).not.toContain('<path');
  });
});
