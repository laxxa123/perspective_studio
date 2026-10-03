import { describe, expect, it } from 'vitest';
import { add, drill, keepHoles, readHoles, turnAllWith, type Blocks, type Hole } from './blocks';
import { STARTER_FIGURE } from './figure';
import { STARTER_FOLD } from './fold';
import { clipConvex, drawingKey, holesShown, isoFaces, isoSvg } from './iso';
import { buildQuestion, defaultParams, validate, type Family, type Params, type Source } from './questions';
import { assembles, canonical, gridKey, isChiral, mirrorGrid, sameCells, sameObject, section, turnGrid, turnWith, view, withoutHoles } from './space';
import { gridSvg } from './sheet';

const OBJ: Blocks = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 2],
  [1, 0, 2],
  [2, 0, 2],
  [2, 1, 2],
  [0, 1, 0],
];
// Drill from the top of the tall corner: through (2,1,2) and (2,0,2).
const HOLES: Hole[] = drill(OBJ, [], [2, 1, 2], [0, 1, 0]);

describe('the Hole tool (OBJECTS §A.14)', () => {
  it('drills through every block in the line behind the face, and fills it on a second tap', () => {
    expect(HOLES).toEqual([
      { c: [2, 0, 2], axis: 'y' },
      { c: [2, 1, 2], axis: 'y' },
    ]);
    expect(drill(OBJ, HOLES, [2, 0, 2], [0, -1, 0])).toEqual([]);
    // From the side: the line along x through z = 2.
    expect(drill(OBJ, [], [0, 0, 2], [-1, 0, 0]).map((h) => h.c)).toEqual([
      [0, 0, 2],
      [1, 0, 2],
      [2, 0, 2],
    ]);
  });
  it('does not drill blocks added later; removing a block takes its hole', () => {
    const more = add(OBJ, [2, 2, 2]);
    expect(HOLES.some((h) => h.c[1] === 2)).toBe(false);
    expect(keepHoles(more.filter((c) => !(c[0] === 2 && c[1] === 1)), HOLES)).toEqual([{ c: [2, 0, 2], axis: 'y' }]);
  });
  it('turns holes with the object (their axis turns too)', () => {
    const t = turnAllWith(OBJ, HOLES, 'x');
    expect(t.holes.every((h) => h.axis === 'z')).toBe(true);
    expect(sameObject(t.blocks, OBJ, false, t.holes, HOLES)).toBe(true);
    expect(sameObject(OBJ, OBJ, false, HOLES, [])).toBe(false);
    const sideways: Hole[] = HOLES.map((h) => ({ ...h, axis: 'x' }));
    expect(canonical(OBJ, false, HOLES)).not.toBe(canonical(OBJ, false, sideways));
    const w = turnWith(OBJ, HOLES, 'y', 1);
    expect(sameCells(w.blocks, turnWith(OBJ, HOLES, 'y', 5).blocks, w.holes, turnWith(OBJ, HOLES, 'y', 5).holes)).toBe(true);
    expect(isChiral(OBJ, HOLES)).toBe(isChiral(OBJ, HOLES));
    expect(readHoles([{ c: [1, 2, 3], axis: 'x' }, { c: [1], axis: 'x' }, { c: [1, 2, 3], axis: 'w' }, null])).toEqual([{ c: [1, 2, 3], axis: 'x' }]);
  });
  it('shows in views and cuts across the hole, and in the drawing', () => {
    const top = view(OBJ, 'top', HOLES);
    expect(top.holes).toEqual([[2, 2]]);
    expect(view(OBJ, 'front', HOLES).holes).toBeUndefined();
    expect(withoutHoles(top).holes).toBeUndefined();
    expect(section(OBJ, 'y', 0, HOLES).holes).toEqual([[2, 2]]);
    expect(section(OBJ, 'x', 2, HOLES).holes).toBeUndefined();
    expect(holesShown(OBJ, HOLES)).toBe(true);
    // A hole along z in the back block of a row is covered.
    expect(holesShown([[0, 0, 0], [0, 0, 1]], [{ c: [0, 0, 0], axis: 'z' }])).toBe(false);
    expect(drawingKey(OBJ, HOLES)).not.toBe(drawingKey(OBJ));
  });
  it('is a see-through cutout: light through it, or a closed grey bottom when a block blocks it', () => {
    // A column of two, drilled down through both: see-through from the top.
    const col: Blocks = [[0, 0, 0], [0, 1, 0]];
    const both: Hole[] = [{ c: [0, 0, 0], axis: 'y' }, { c: [0, 1, 0], axis: 'y' }];
    expect(view(col, 'top', both).holes).toEqual([[0, 0]]);
    expect(view(col, 'top', both).blind).toBeUndefined();
    // Only the top block drilled: the hole stops on the block below.
    const one: Hole[] = [{ c: [0, 1, 0], axis: 'y' }];
    const v = view(col, 'top', one);
    expect(v.blind).toEqual([[0, 0]]);
    expect(gridKey(v)).not.toBe(gridKey(view(col, 'top', both)));
    expect(withoutHoles(v).blind).toBeUndefined();
    expect(turnGrid(v).blind).toEqual([[0, 0]]);
    expect(mirrorGrid(v).blind).toEqual([[0, 0]]);
    expect(gridSvg(view(col, 'top', both))).toContain('fill="#fff" stroke');
    expect(gridSvg(v)).toContain('#adb5bd');
    // The drawing: an open tunnel (lit wall, shadow by the near rim); never a dark spot.
    const svg = isoSvg(col, { holes: both });
    expect(svg).not.toContain('#495057');
    expect(svg).toContain('#e9ecef');
    const face = isoFaces(col, both).find((f) => f.hole)!;
    expect(face.blind).toBe(false);
    expect(face.lit!.length).toBeGreaterThan(2);
    expect(isoFaces(col, one).find((f) => f.hole)!.blind).toBe(true);
    // At the drawing's angle a block-deep tunnel is too long to see light through.
    expect(face.far).toEqual([]);
  });
  it('clips one convex outline to another', () => {
    const sq = (x: number): [number, number][] => [[x, 0], [x + 2, 0], [x + 2, 2], [x, 2]];
    const c = clipConvex(sq(1), sq(0));
    expect(c.length).toBe(4);
    expect(clipConvex(sq(5), sq(0))).toEqual([]);
  });
  it('pieces must carry their holes to assemble', () => {
    const a: Blocks = OBJ.slice(0, 4);
    const b: Blocks = OBJ.slice(4);
    expect(assembles(OBJ, a, b, HOLES, [], keepHoles(b, HOLES))).toBe(true);
    expect(assembles(OBJ, a, b, HOLES, [], [])).toBe(false);
  });
});

const src = (): Source => ({ blocks: OBJ, holes: HOLES, marked: [0, 1, 0], figure: STARTER_FIGURE, fold: STARTER_FOLD });
const SETUPS: [Family, Partial<Params>][] = [
  ['same', {}],
  ['turn', { axis: 'y', quarters: 1 }],
  ['view', { side: 'top' }],
  ['reconstruct', {}],
  ['section', { axis: 'y', layer: 0 }],
  ['track', { axis: 'y', quarters: 1 }],
  ['assemble', {}],
];

describe('questions with holes', () => {
  for (const [family, over] of SETUPS)
    it(`${family}: ready, exactly one correct, holes part of the answer`, () => {
      for (const seed of [1, 2, 3]) {
        const q = buildQuestion(family, src(), { ...defaultParams(), ...over }, seed);
        expect(validate(q).issues).toEqual([]);
      }
    });
  it('offers "the hole missing" and "in another direction" as wrong answers', () => {
    const q = buildQuestion('same', src(), defaultParams(), 4);
    expect(q.options.some((o) => o.note.includes('hole'))).toBe(true);
    const v = buildQuestion('view', src(), { ...defaultParams(), side: 'top' }, 4);
    expect(v.options.some((o) => o.note === 'The hole not shown')).toBe(true);
  });
  it('refuses a hole the drawing cannot show', () => {
    const q = buildQuestion('same', { ...src(), holes: [{ c: [0, 0, 1], axis: 'z' }] }, defaultParams(), 1);
    expect(validate(q).issues.join()).toMatch(/hole cannot be seen/);
  });
});
