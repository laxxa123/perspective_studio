import { describe, expect, it } from 'vitest';
import { add, drill, keepHoles, readHoles, turnAllWith, type Blocks, type Hole } from './blocks';
import { STARTER_FIGURE } from './figure';
import { STARTER_FOLD } from './fold';
import { drawingKey, holesShown, isoSvg } from './iso';
import { buildQuestion, defaultParams, validate, type Family, type Params, type Source } from './questions';
import { assembles, canonical, isChiral, sameCells, sameObject, section, turnWith, view, withoutHoles } from './space';

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
    expect(isoSvg(OBJ, { holes: HOLES })).toContain('#495057');
    expect(drawingKey(OBJ, HOLES)).not.toBe(drawingKey(OBJ));
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
