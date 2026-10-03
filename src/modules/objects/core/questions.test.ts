import { describe, expect, it } from 'vitest';
import type { Blocks } from './blocks';
import { STARTER_FIGURE } from './figure';
import { STARTER_FOLD } from './fold';
import { buildQuestion, defaultParams, FAMILIES, isCorrect, moveOption, regenerateOption, replaceOption, sourceIssues, validate, type Family, type Params, type Source } from './questions';
import { questionSheet, itemSvg } from './sheet';
import { mirror, sameObject } from './space';

// An object with every block visible from the drawing's corner (also after the turns tested), supported.
const OBJ: Blocks = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 2],
  [1, 0, 2],
  [2, 0, 2],
  [2, 1, 2],
  [0, 1, 0],
];
// A chiral one (it has a mirror image that no turn makes).
const CHIRAL: Blocks = [
  [0, 0, 1],
  [1, 0, 1],
  [1, 0, 0],
  [2, 0, 0],
  [1, 1, 1],
  [0, 1, 1],
];
const src = (over: Partial<Source> = {}): Source => ({ blocks: OBJ, holes: [], marked: [2, 1, 2], figure: STARTER_FIGURE, fold: STARTER_FOLD, ...over });
const params = (over: Partial<Params> = {}): Params => ({ ...defaultParams(), ...over });

const SETUPS: [Family, Partial<Params>][] = [
  ['same', {}],
  ['turn', { axis: 'y', quarters: 1 }],
  ['turn', { axis: 'x', quarters: 3 }],
  ['view', { side: 'front' }],
  ['view', { side: 'top' }],
  ['reconstruct', {}],
  ['count', { count: 'all' }],
  ['section', { axis: 'y', layer: 0 }],
  ['track', { axis: 'y', quarters: 1 }],
  ['assemble', {}],
  ['f-turn', { ops: ['r90'] }],
  ['f-reflect', { ops: ['fv'] }],
  ['f-same', {}],
  ['f-steps', { ops: ['r90', 'fh'] }],
  ['fold', {}],
  ['view', { side: 'right' }],
  ['section', { axis: 'z', layer: 2 }],
  ['turn', { axis: 'z', quarters: 2 }],
  ['f-turn', { ops: ['r270'] }],
  ['f-reflect', { ops: ['fd'] }],
  ['f-steps', { ops: ['fa', 'r180'] }],
];

describe('question engine (OBJECTS §A.5)', () => {
  it('lists the Phase 1a question types', () => {
    expect(FAMILIES.map((f) => f.id)).toHaveLength(13);
  });

  for (const [family, over] of SETUPS) {
    it(`${family} ${JSON.stringify(over)}: five options, exactly one correct, ready to commit, reproducible`, () => {
      for (const seed of [1, 2, 3, 42]) {
        const q = buildQuestion(family, src(), params(over), seed);
        const check = validate(q);
        expect(check.issues).toEqual([]);
        expect(q.options).toHaveLength(5);
        expect(q.options.filter((o) => isCorrect(family, q.source, q.params, o.item))).toHaveLength(1);
        expect(q.options[q.correct].rule).toBe('correct');
        expect(q.options.filter((o) => o.rule !== 'correct').every((o) => o.rule.startsWith('D'))).toBe(true);
        expect(q.explanation[0]).toContain(`Option ${q.correct + 1}`);
        expect(q.profile.difficulty).toBeGreaterThanOrEqual(1);
        expect(q.profile.difficulty).toBeLessThanOrEqual(5);
        // Same input + seed → same question (OBJECTS §37).
        expect(JSON.stringify(buildQuestion(family, src(), params(over), seed, new Date(q.createdAt)))).toBe(JSON.stringify(q));
      }
    });
  }

  it('the "same object" answer is the object turned, never its mirror image', () => {
    const q = buildQuestion('same', src({ blocks: CHIRAL }), params(), 5);
    expect(validate(q).ready).toBe(true);
    const answer = q.options[q.correct].item;
    expect(answer.kind === 'blocks' && sameObject(answer.blocks, CHIRAL)).toBe(true);
    const m = q.options.find((o) => o.rule === 'D03')!.item;
    expect(m.kind === 'blocks' && sameObject(m.blocks, mirror(CHIRAL))).toBe(true);
  });

  it('says why a source cannot be asked', () => {
    expect(sourceIssues('same', src({ blocks: [[0, 0, 0]] }), params())).toContain('Build an object of at least two blocks.');
    const HID: Blocks = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
    expect(sourceIssues('same', src({ blocks: HID }), params()).join()).toMatch(/hidden/);
    expect(sourceIssues('count', src({ blocks: [[0, 0, 0], [0, 1, 0], [1, 1, 0]] }), params()).join()).toMatch(/nothing under/);
    expect(sourceIssues('track', src({ marked: null }), params()).join()).toMatch(/Mark a block/);
    expect(sourceIssues('turn', src({ blocks: CHIRAL }), params({ axis: 'y', quarters: 1 })).join()).toMatch(/choose another turn/);
    expect(sourceIssues('fold', src({ fold: { n: 6, folds: ['v'], holes: [[5, 0]] } }), params()).join()).toMatch(/outside/);
    expect(sourceIssues('f-turn', src({ figure: { n: 6, cells: [], marks: [] } }), params()).join()).toMatch(/Draw/);
    const q = buildQuestion('same', src({ blocks: HID }), params(), 1);
    expect(q.options).toHaveLength(0);
    expect(validate(q).ready).toBe(false);
  });

  it('lets the author reorder, regenerate and replace options; validation catches a second answer', () => {
    const q = buildQuestion('turn', src(), params(), 9);
    const moved = moveOption(q, q.correct, q.correct === 0 ? 1 : 0);
    expect(moved.options[moved.correct].rule).toBe('correct');
    const wrong = q.correct === 0 ? 1 : 0;
    const regen = regenerateOption(q, wrong, 77);
    expect(validate(regen).ready).toBe(true);
    expect(regenerateOption(q, q.correct, 1)).toBe(q);
    // Replacing a wrong option by the correct answer gives two correct options.
    const two = replaceOption(q, wrong, q.options[q.correct].item);
    expect(validate(two).issues.join()).toMatch(/both correct/);
    expect(two.options[wrong].rule).toBe('author');
    const none = replaceOption(q, q.correct, q.options[wrong].item);
    expect(validate(none).issues.join()).toMatch(/No option is correct|look the same/);
  });

  it('draws the sheet with the stem, five numbered options and, for the author, the answer', () => {
    const q = buildQuestion('reconstruct', src(), params(), 4);
    const sheet = questionSheet({ ...q, questionId: 'OBJECTS-Q-1', version: 2 }, { author: true });
    expect(sheet).toMatch(/^<svg /);
    expect(sheet).toContain('OBJECTS-Q-1.2');
    expect(sheet).toContain('✓');
    expect(sheet).toContain('Front');
    expect(questionSheet(q)).not.toContain('✓');
    const fold = buildQuestion('fold', src(), params(), 4);
    expect(questionSheet(fold)).toContain('stroke-dasharray');
    expect(itemSvg({ kind: 'number', value: 7 })).toContain('>7<');
    expect(itemSvg({ kind: 'pair', a: OBJ, b: OBJ })).toContain('+');
  });
});

describe('counting hidden blocks', () => {
  it('asks how many cannot be seen in a supported object', () => {
    // A 2 × 2 × 2 cube with one block on top: the back corner and the block straight behind the top one are hidden.
    const cube: Blocks = [];
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) (cube as [number, number, number][]).push([x, y, z]);
    const q = buildQuestion('count', src({ blocks: [...cube, [1, 2, 1]] }), params({ count: 'hidden' }), 2);
    expect(validate(q).issues).toEqual([]);
    const right = q.options[q.correct].item;
    expect(right.kind === 'number' && right.value).toBe(2);
    const all = buildQuestion('count', src({ blocks: cube }), params({ count: 'all' }), 2);
    expect(all.options.some((o) => o.rule === 'D06' && o.note.includes('seen'))).toBe(true);
    expect(sourceIssues('count', src(), params({ count: 'hidden' })).join()).toMatch(/No block is hidden/);
  });
  it('draws the folded sheet for punching, with a greyed half after a diagonal fold', async () => {
    const { foldedSvg, gridSvg, figureSvg } = await import('./sheet');
    expect(foldedSvg({ n: 4, folds: ['v', 'h', 'd'], holes: [[1, 0]] })).toContain('#dee2e6');
    expect(gridSvg({ w: 2, h: 1, cells: [[0, 0]] })).toContain('#e9ecef');
    expect(figureSvg({ n: 6, cells: [[0, 0]], marks: [{ c: 0, r: 0, kind: 'dot', dir: 0 }, { c: 1, r: 1, kind: 'arrow', dir: 2 }] })).toContain('<circle');
  });
});

describe('canonical JSON (OBJECTS §44)', () => {
  it('round-trips through JSON and the schema, and refuses malformed questions', async () => {
    const { parseQuestion } = await import('./schema');
    for (const [family, over] of SETUPS) {
      const q = buildQuestion(family, src(), params(over), 3);
      expect(parseQuestion(JSON.parse(JSON.stringify(q)))).toEqual(JSON.parse(JSON.stringify(q)));
    }
    expect(() => parseQuestion({ schema: 'other' })).toThrow();
  });
});
