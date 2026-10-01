// Question-engine quality gates (CUBE §58): five options, one deterministic
// correct answer, intentional distractors, ambiguity detected.
import { describe, expect, it } from 'vitest';
import { FACE_IDS, newCubeModel, type CubeModel, type FaceId } from '../model/CubeModel';
import type { QuestionType } from '../model/QuestionModel';
import { PRESETS, presetCells } from '../geometry/NetShapes';
import { fragmentsFor } from '../geometry/PatternContinuity';
import { validateNet } from '../geometry/NetValidator';
import { buildQuestion, isCorrectFigure, refreshDerived, regenerateOption } from './QuestionEngine';
import { validateQuestion } from './QuestionValidator';

function letters(presetIdx = 0, withPattern = false): CubeModel {
  const m = newCubeModel({ cells: presetCells(PRESETS[presetIdx]) });
  for (const f of FACE_IDS) {
    m.faces[f] = { ...m.faces[f], elements: [{ id: `t${f}`, kind: 'text', text: f, fontSize: 0.6, w: 0.6, h: 0.6, opacity: 1, transform: { x: 0.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 } }] };
  }
  if (withPattern) {
    // A bar from A down across the fold into C.
    const el = { id: 'p1', kind: 'path' as const, path: 'M -0.05 -0.5 L 0.05 -0.5 L 0.05 0.5 L -0.05 0.5 Z', fill: '#e03131', w: 0.1, h: 1, opacity: 1, transform: { x: 0.3, y: 0.9, rotation: 0, scaleX: 1, scaleY: 1 } };
    m.patterns.push({ id: 'p1', element: el, anchor: 'A' as FaceId, fragments: fragmentsFor(el, 'A', m.net), continuityMode: 'fold' });
  }
  return m;
}

const TYPES: QuestionType[] = ['net_to_cube', 'cube_to_net'];

describe('question generation (CUBE §23–§26)', () => {
  for (const type of TYPES) {
    for (const stemCount of [1, 2] as const) {
      it(`${type}, ${stemCount} stem figure(s): 5 options, exactly one correct, no ambiguity, across seeds`, () => {
        for (let seed = 1; seed <= 25; seed++) {
          const m = letters(seed % PRESETS.length, seed % 3 === 0);
          const q = buildQuestion(m, { type, stemCount, distractors: [], seed });
          expect(q.options).toHaveLength(5);
          expect(q.options.filter((o) => o.correct)).toHaveLength(1);
          const problems = validateQuestion(q, new Set());
          expect(problems).toEqual([]);
          for (const o of q.options) expect(isCorrectFigure(m, type, q.presentation.stem, o.figure)).toBe(o.correct);
          expect(q.options.filter((o) => o.distractor).every((o) => o.distractor!.rule && o.distractor!.type)).toBe(true);
        }
      });
    }
  }

  it('is deterministic for a seed', () => {
    const m = letters();
    const a = buildQuestion(m, { type: 'net_to_cube', stemCount: 1, distractors: [], seed: 42 }, new Date(0));
    const b = buildQuestion(m, { type: 'net_to_cube', stemCount: 1, distractors: [], seed: 42 }, new Date(0));
    expect(a).toEqual(b);
  });

  it('honours requested distractor rules where they apply', () => {
    const m = letters();
    const q = buildQuestion(m, { type: 'cube_to_net', stemCount: 2, distractors: ['D07', 'D05', 'D04', 'D01'], seed: 7 });
    const codes = q.options.filter((o) => o.distractor).map((o) => o.distractor!.code).sort();
    expect(codes).toEqual(['D01', 'D04', 'D05', 'D07']);
    const invalid = q.options.find((o) => o.distractor?.code === 'D07')!;
    expect(invalid.figure.kind === 'net' && validateNet(invalid.figure.cells).valid).toBe(false);
  });

  it('detects a second correct answer and a wrong key (CUBE §31)', () => {
    const m = letters();
    const q = buildQuestion(m, { type: 'net_to_cube', stemCount: 1, distractors: [], seed: 3 });
    const correct = q.options.find((o) => o.correct)!;
    const dup = refreshDerived({ ...q, options: q.options.map((o) => (o.correct ? o : o === q.options.find((x) => !x.correct) ? { ...o, figure: correct.figure } : o)) });
    expect(validateQuestion(dup, new Set()).some((i) => /also a correct answer/.test(i.message))).toBe(true);
    const wrongKey = refreshDerived({ ...q, options: q.options.map((o) => ({ ...o, correct: !o.correct && o === q.options.find((x) => !x.correct) })) });
    expect(validateQuestion(wrongKey, new Set()).some((i) => /marked correct but does not match/.test(i.message))).toBe(true);
  });

  it('regenerates one distractor or the correct option, staying valid', () => {
    const m = letters(1, true);
    let q = buildQuestion(m, { type: 'cube_to_net', stemCount: 2, distractors: [], seed: 11 });
    const d = q.options.findIndex((o) => !o.correct);
    const c = q.options.findIndex((o) => o.correct);
    q = regenerateOption(q, d, 'D04', 99);
    expect(q.options[d].distractor?.code).toBe('D04');
    q = regenerateOption(q, c, null, 5);
    expect(q.options[c].correct).toBe(true);
    expect(validateQuestion(q, new Set())).toEqual([]);
  });

  it('records DNA, difficulty (1–5 on 8 dimensions) and an explanation', () => {
    const q = buildQuestion(letters(0, true), { type: 'net_to_cube', stemCount: 1, distractors: [], seed: 5 });
    expect(q.dna).toMatchObject({ family: 'cube', operation: 'net_to_cube', faceCount: 6, optionCount: 5, patterns: 1, facesWithArtwork: 6 });
    expect(Object.values(q.difficulty).every((v) => v >= 1 && v <= 5)).toBe(true);
    expect(Object.keys(q.difficulty)).toHaveLength(8);
    expect(q.explanation.correctOption).toBe(q.answer.correctOption);
    expect(q.explanation.reasoning.filter((r) => r.rule === 'opposition' && !r.option)).toHaveLength(3);
  });
});

describe('variants (CUBE §38)', () => {
  it('keeps the type, skill profile and validity while changing the layout', async () => {
    const { makeVariant } = await import('./VariantEngine');
    const { netIndex } = await import('../geometry/NetShapes');
    const q = buildQuestion(letters(0), { type: 'cube_to_net', stemCount: 2, distractors: ['D04', 'D01', 'D05', 'D07'], seed: 4 });
    const v = makeVariant(q, 77);
    expect(v.presentation.type).toBe(q.presentation.type);
    expect(v.difficulty).toEqual(q.difficulty);
    expect(netIndex(v.spatialModel.net.cells)).not.toBe(netIndex(q.spatialModel.net.cells));
    expect(validateQuestion(v, new Set())).toEqual([]);
  });
});
