import { describe, expect, it } from 'vitest';
import { STARTER, type Blocks, type Cell } from './blocks';
import { applyOp, applyOps, figureKey, readFigure, sameFigure, sameShape, STARTER_FIGURE, toggleCell, toggleMark, type Figure } from './figure';
import { canPunch, foldProblem, holesKey, regions, unfold, wrongMirror } from './fold';
import { drawingKey, hiddenCount, isoSvg, visibleBlocks } from './iso';
import { rng } from './random';
import { addOne, assembles, canonical, isChiral, mirror, moveOne, normalise, removeOne, ROTATIONS, sameCells, sameObject, section, split, SYMMETRIES, transform, turnBy, turnGrid, view } from './space';

// An L-shaped "tetris" piece plus one block up: chiral.
const L: Blocks = [
  [0, 0, 0],
  [1, 0, 0],
  [2, 0, 0],
  [2, 0, 1],
  [0, 1, 0],
];

describe('the cube group (OBJECTS §A.3)', () => {
  it('has 24 distinct rotations, 48 symmetries, all of determinant ±1', () => {
    expect(ROTATIONS).toHaveLength(24);
    expect(new Set(ROTATIONS.map((m) => m.join())).size).toBe(24);
    expect(new Set(SYMMETRIES.map((m) => m.join())).size).toBe(48);
  });

  it('recognises a turned copy, and a mirror image only when allowed', () => {
    for (const m of ROTATIONS) expect(sameObject(transform(L, m), L)).toBe(true);
    expect(isChiral(L)).toBe(true);
    expect(sameObject(mirror(L), L)).toBe(false);
    expect(sameObject(mirror(L), L, true)).toBe(true);
    expect(isChiral(STARTER)).toBe(false);
    expect(sameObject(L, STARTER)).toBe(false);
  });

  it('turns by quarters: four quarters bring the cells back', () => {
    for (const a of ['x', 'y', 'z'] as const) {
      expect(sameCells(turnBy(L, a, 4), L)).toBe(true);
      expect(sameCells(turnBy(turnBy(L, a, 1), a, 3), L)).toBe(true);
      expect(sameObject(turnBy(L, a, 1), L)).toBe(true);
    }
    expect(normalise([[3, 2, 1]])).toEqual([[0, 0, 0]]);
    expect(canonical(L)).toBe(canonical(turnBy(L, 'y', 2)));
  });
});

describe('views and sections', () => {
  const step: Blocks = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 0, 1],
  ];
  it('draws each side as covered squares, the viewer’s right and down', () => {
    expect(view(step, 'front')).toEqual({ w: 2, h: 2, cells: [[1, 0], [0, 1], [1, 1]] });
    expect(view(step, 'top')).toEqual({ w: 2, h: 2, cells: [[0, 0], [1, 0], [0, 1]] });
    expect(view(step, 'right')).toEqual({ w: 2, h: 2, cells: [[1, 0], [0, 1], [1, 1]] });
    expect(view(step, 'back').cells).toEqual([[0, 0], [0, 1], [1, 1]]);
    expect(view([], 'front')).toEqual({ w: 0, h: 0, cells: [] });
  });
  it('cuts layers', () => {
    expect(section(step, 'y', 0).cells).toHaveLength(3);
    expect(section(step, 'y', 1).cells).toEqual([[1, 0]]);
    expect(section(step, 'z', 1).cells).toEqual([[0, 1]]);
    expect(turnGrid({ w: 2, h: 1, cells: [[0, 0]] })).toEqual({ w: 1, h: 2, cells: [[0, 0]] });
  });
});

describe('changes for distractors', () => {
  it('moves, adds and removes one block, keeping one piece and a different object', () => {
    const r = rng(7);
    for (let i = 0; i < 20; i++) {
      const m = moveOne(L, r)!;
      expect(m).toHaveLength(L.length);
      expect(sameCells(m, L)).toBe(false);
      expect(addOne(L, r)).toHaveLength(6);
      expect(removeOne(L, r)).toHaveLength(4);
    }
  });
  it('splits into two pieces that assemble back, and rejects wrong pieces', () => {
    const r = rng(3);
    const big: Blocks = [...L, [0, 2, 0], [1, 1, 0]];
    for (let i = 0; i < 10; i++) {
      const [a, b] = split(big, r)!;
      expect(a.length + b.length).toBe(big.length);
      expect(assembles(big, turnBy(a, 'x', 1), turnBy(b, 'z', 3))).toBe(true);
    }
    expect(assembles(L, [[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [2, 0, 0]])).toBe(false);
    expect(split([[0, 0, 0], [1, 0, 0]], r)).toBeNull();
  });
});

describe('what the drawing shows', () => {
  it('counts blocks hidden behind others from the drawing’s corner', () => {
    expect(hiddenCount([[0, 0, 0]])).toBe(0);
    // Straight behind (along the view direction): hidden.
    expect(hiddenCount([[0, 0, 0], [1, 1, 1]])).toBe(1);
    // A 2 × 2 × 2 cube hides its far corner.
    const cube: Cell[] = [];
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) cube.push([x, y, z]);
    expect(hiddenCount(cube)).toBe(1);
    expect(visibleBlocks(cube).has('0,0,0')).toBe(false);
    expect(hiddenCount(STARTER)).toBe(0);
    // A block covered on all three seen sides is hidden.
    expect(hiddenCount([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]])).toBe(1);
    expect(hiddenCount(L)).toBe(0);
  });
  it('knows when two objects draw the same, and fills marked blocks', () => {
    expect(drawingKey(L)).toBe(drawingKey(transform(L, ROTATIONS[0]).map((c): Cell => [c[0] + 2, c[1], c[2] + 1])));
    expect(drawingKey(L)).not.toBe(drawingKey(mirror(L)));
    expect(drawingKey([])).toBe('');
    expect(isoSvg(L, { fills: new Map([['0,1,0', '#999']]) })).toContain('fill="#999"');
  });
});

const F: Figure = STARTER_FIGURE;

describe('2D figures (OBJECTS §A.4)', () => {
  it('turns and reflects cells and arrows', () => {
    expect(sameFigure(applyOps(F, ['r90', 'r90', 'r90', 'r90']), F)).toBe(true);
    expect(sameFigure(applyOps(F, ['r90', 'r270']), F)).toBe(true);
    expect(sameFigure(applyOps(F, ['fv', 'fv']), F)).toBe(true);
    expect(sameFigure(applyOps(F, ['fd', 'fd']), F)).toBe(true);
    expect(sameFigure(applyOps(F, ['fa', 'fa']), F)).toBe(true);
    expect(sameFigure(applyOps(F, ['r90', 'r90']), applyOp(F, 'r180'))).toBe(true);
    // Reflect then turn ≠ turn then reflect for this figure.
    expect(sameFigure(applyOps(F, ['r90', 'fv']), applyOps(F, ['fv', 'r90']))).toBe(false);
    const a: Figure = { n: 6, cells: [], marks: [{ c: 0, r: 0, kind: 'arrow', dir: 0 }] };
    expect(applyOp(a, 'r90').marks[0]).toEqual({ c: 5, r: 0, kind: 'arrow', dir: 1 });
    expect(applyOp(a, 'fd').marks[0].dir).toBe(3);
    expect(applyOp(a, 'fa').marks[0].dir).toBe(1);
  });
  it('compares shapes anywhere on the grid, turned, mirrored only when allowed', () => {
    expect(sameShape(applyOp(F, 'r90'), F)).toBe(true);
    expect(sameShape(applyOp(F, 'fv'), F)).toBe(false);
    expect(sameShape(applyOp(F, 'fv'), F, true)).toBe(true);
  });
  it('edits cells and marks, and reads saved figures', () => {
    const f = toggleCell(F, 5, 5);
    expect(f.cells).toHaveLength(7);
    expect(toggleCell(f, 5, 5).cells).toHaveLength(6);
    const m = toggleMark(F, 3, 1, 'arrow');
    expect(m.marks[0].dir).toBe(2);
    expect(toggleMark(F, 0, 0, 'dot').marks).toHaveLength(2);
    expect(readFigure({ n: 6, cells: [[1, 1], [9, 9], 'x'], marks: [{ c: 1, r: 1, kind: 'dot' }, { c: 1, r: 1, kind: 'box' }] })).toEqual({ n: 6, cells: [[1, 1]], marks: [{ c: 1, r: 1, kind: 'dot', dir: 0 }] });
    expect(readFigure(null)).toBeNull();
    expect(figureKey(F)).toContain('a3,1>1');
  });
});

describe('fold and punch (OBJECTS §A.4)', () => {
  it('opens the sheet: one hole after two folds makes four', () => {
    const spec = { n: 6, folds: ['v', 'h'] as const, holes: [[2, 2]] as const };
    expect(regions(spec).at(-1)).toEqual({ w: 3, h: 3, tri: false });
    expect(holesKey(unfold(spec))).toBe(holesKey([[2, 2], [3, 2], [2, 3], [3, 3]]));
    expect(unfold(spec, 1)).toHaveLength(2);
    const one = { n: 6, folds: ['v'] as const, holes: [[0, 1]] as const };
    expect(holesKey(wrongMirror(one))).not.toBe(holesKey(unfold(one)));
  });
  it('folds along the diagonal only on a square, last', () => {
    expect(foldProblem({ n: 6, folds: ['v', 'd'] })).toMatch(/square/);
    expect(foldProblem({ n: 6, folds: ['d', 'v'] })).toMatch(/after/);
    expect(foldProblem({ n: 6, folds: ['v', 'v'] })).toMatch(/across/);
    expect(foldProblem({ n: 4, folds: ['v', 'h', 'd'] })).toBeNull();
    expect(canPunch({ n: 4, folds: ['v', 'h', 'd'] }, [1, 0])).toBe(true);
    expect(canPunch({ n: 4, folds: ['v', 'h', 'd'] }, [0, 1])).toBe(false);
    expect(unfold({ n: 4, folds: ['d'], holes: [[2, 0]] })).toEqual([[2, 0], [0, 2]]);
  });
});
