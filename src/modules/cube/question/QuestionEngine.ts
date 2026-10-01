// Question construction (CUBE §23–§30, §36): stems, the correct option, four
// intentional distractors, explanation, difficulty and DNA — all from the
// CubeModel. The author can override everything afterwards (CUBE §27).
import { FACE_IDS, hasArtwork, mirrorVisible, symmetryOf, type CubeModel } from '../model/CubeModel';
import {
  DISTRACTORS,
  QUESTION_SCHEMA,
  type Difficulty,
  type DistractorCode,
  type Figure,
  type Question,
  type QuestionDNA,
  type QuestionOption,
  type QuestionType,
  type ReasoningStep,
} from '../model/QuestionModel';
import { ROTATIONS } from '../geometry/CubeGeometry';
import { allViews, cubeState, oppositeOf, showsView, viewKey, viewOf, type CubeState } from '../geometry/FoldingEngine';
import { netIndex, PRESETS } from '../geometry/NetShapes';
import { bestView, correctNet, cubeViewCandidates, netCandidates, type Candidate } from './DistractorEngine';
import { rng, type Rng } from './Random';

export const OPTION_COUNT = 5;

export const PROMPTS: Record<QuestionType, string> = {
  net_to_cube: 'Which cube can be made from this net?',
  cube_to_net: 'Which net folds into this cube?',
};

/** Distractor rules that make sense for each question type, in default order of preference. */
export const DISTRACTOR_CHOICES: Record<QuestionType, DistractorCode[]> = {
  net_to_cube: ['D01', 'D03', 'D04', 'D02', 'D05', 'D06', 'D08', 'D09'],
  cube_to_net: ['D01', 'D04', 'D07', 'D02', 'D05', 'D06', 'D08'],
};

export interface GenerateSettings {
  type: QuestionType;
  stemCount: 1 | 2;
  /** Preferred distractor rules; the engine falls back to others when one cannot apply. */
  distractors: DistractorCode[];
  seed: number;
}

/** The authored cube; throws when the net is not valid (validate first). */
export function authoredState(m: CubeModel): CubeState {
  const s = cubeState(m.net.cells);
  if (!s) throw new Error('The net does not fold into a cube.');
  return s;
}

/** A figure written so that figures that look the same compare equal. */
export function figureKey(m: CubeModel, f: Figure): string {
  if (f.kind === 'cube') return `c:${viewKey(m, f.view)}`;
  const c0 = Math.min(...f.cells.map((c) => c.col));
  const r0 = Math.min(...f.cells.map((c) => c.row));
  return `n:${f.cells
    .map((c) => `${c.col - c0},${c.row - r0}:${c.face}${c.turns % (4 / symmetryOf(m, c.face))}${c.mirrored && mirrorVisible(m, c.face) ? 'm' : ''}`)
    .sort()
    .join(';')}`;
}

/** Whether an option figure is a correct answer for the stem (CUBE §31: ambiguity check uses this for every option). */
export function isCorrectFigure(m: CubeModel, type: QuestionType, stem: Figure[], fig: Figure): boolean {
  if (type === 'net_to_cube') {
    if (fig.kind !== 'cube') return false;
    const s = cubeState(m.net.cells);
    return !!s && showsView(m, s, fig.view);
  }
  if (fig.kind !== 'net') return false;
  const t = cubeState(fig.cells);
  if (!t) return false;
  return stem.every((st) => st.kind === 'cube' && showsView(m, t, st.view));
}

function makeStem(m: CubeModel, s: CubeState, set: GenerateSettings, r: Rng): Figure[] {
  if (set.type === 'net_to_cube') {
    const stem: Figure[] = [{ kind: 'net', cells: m.net.cells.map((c) => ({ ...c })) }];
    if (set.stemCount === 2) stem.push({ kind: 'net', cells: correctNet(s, r) });
    return stem;
  }
  const v1 = bestView(m, s, r);
  const stem: Figure[] = [{ kind: 'cube', view: v1 }];
  if (set.stemCount === 2) {
    // The opposite corner shows the three faces the first view hides.
    const seen = new Set(v1.map((x) => x.face));
    const v2 = r.shuffle(allViews(s)).find((v) => v.every((x) => !seen.has(x.face))) ?? viewOf(s, ROTATIONS[5]);
    stem.push({ kind: 'cube', view: v2 });
  }
  return stem;
}

function candidates(m: CubeModel, s: CubeState, type: QuestionType, code: DistractorCode, r: Rng): Candidate[] {
  if (type === 'net_to_cube') return cubeViewCandidates(m, s, viewOf(s, r.pick(ROTATIONS)), code, r);
  return netCandidates(m, s, correctNet(s, r), code, r);
}

/** One distractor of a given rule (or any rule) that is wrong and looks unlike the taken figures. */
export function pickDistractor(
  m: CubeModel,
  type: QuestionType,
  stem: Figure[],
  taken: Figure[],
  codes: DistractorCode[],
  r: Rng,
): Candidate | null {
  const s = authoredState(m);
  const keys = new Set(taken.map((f) => figureKey(m, f)));
  for (const code of codes) {
    for (let attempt = 0; attempt < 6; attempt++) {
      for (const c of candidates(m, s, type, code, r)) {
        if (keys.has(figureKey(m, c.figure))) continue;
        if (isCorrectFigure(m, type, stem, c.figure)) continue;
        return c;
      }
    }
  }
  return null;
}

/** Stem + five options (one correct, four distractors), shuffled. */
export function generateOptions(m: CubeModel, set: GenerateSettings): { stem: Figure[]; options: QuestionOption[] } {
  const r = rng(set.seed);
  const s = authoredState(m);
  const stem = makeStem(m, s, set, r);
  let correct: Figure;
  if (set.type === 'net_to_cube') {
    const stemKeys = new Set(stem.map((f) => figureKey(m, f)));
    correct = { kind: 'cube', view: bestView(m, s, r) };
    if (stemKeys.has(figureKey(m, correct))) correct = { kind: 'cube', view: viewOf(s, r.pick(ROTATIONS)) };
  } else {
    correct = { kind: 'net', cells: correctNet(s, r) };
  }
  const options: QuestionOption[] = [{ id: 'o1', figure: correct, correct: true }];
  const preferred = set.distractors.length ? set.distractors : DISTRACTOR_CHOICES[set.type];
  const all = DISTRACTOR_CHOICES[set.type];
  let k = 0;
  while (options.length < OPTION_COUNT) {
    const order = [preferred[k % preferred.length], ...r.shuffle(preferred), ...r.shuffle(all)];
    const c = pickDistractor(m, set.type, stem, [...stem, ...options.map((o) => o.figure)], order, r);
    if (!c) break;
    options.push({ id: `o${options.length + 1}`, figure: c.figure, correct: false, distractor: { code: c.code, type: DISTRACTORS[c.code].type, rule: c.rule, note: c.note } });
    k++;
  }
  return { stem, options: r.shuffle(options) };
}

// ----- explanation, difficulty, DNA -----

export function explain(m: CubeModel, type: QuestionType, options: QuestionOption[]): Question['explanation'] {
  const s = authoredState(m);
  const correctIdx = options.findIndex((o) => o.correct);
  const reasoning: ReasoningStep[] = [];
  const pairs = new Set<string>();
  for (const f of FACE_IDS) {
    const o = oppositeOf(s, f);
    const k = [f, o].sort().join('');
    if (pairs.has(k)) continue;
    pairs.add(k);
    reasoning.push({ rule: 'opposition', statement: `${f} is opposite ${o}.` });
  }
  const c = options[correctIdx];
  if (c?.figure.kind === 'cube') {
    const [t, fr, ri] = c.figure.view.map((x) => x.face);
    reasoning.push({ rule: 'corner', statement: `${t}, ${fr} and ${ri} meet at one corner, in this order around it.`, option: correctIdx + 1 });
  } else if (c?.figure.kind === 'net') {
    reasoning.push({ rule: 'net', statement: `Option ${correctIdx + 1} folds into the same cube: same opposite pairs, same neighbours, artwork turned as on the cube.`, option: correctIdx + 1 });
  }
  if (FACE_IDS.some((f) => hasArtwork(m, f))) reasoning.push({ rule: 'orientation', statement: 'Artwork turns with its face when the net is folded; it is never mirrored.' });
  if (m.patterns.some((p) => p.fragments.length > 1)) reasoning.push({ rule: 'continuity', statement: 'A pattern crossing a fold continues on the neighbouring face.' });
  const RULE: Record<DistractorCode, ReasoningStep['rule']> = {
    D01: 'opposition', D02: 'adjacency', D03: 'corner', D04: 'orientation', D05: 'mirror', D06: 'orientation', D07: 'net', D08: 'continuity', D09: 'viewpoint',
  };
  options.forEach((o, i) => {
    if (!o.correct && o.distractor) reasoning.push({ rule: RULE[o.distractor.code], statement: `Option ${i + 1}: ${o.distractor.note}`, option: i + 1 });
    else if (!o.correct) reasoning.push({ rule: 'net', statement: `Option ${i + 1} does not match the cube.`, option: i + 1 });
  });
  void type;
  return { correctOption: correctIdx + 1, reasoning };
}

const clamp5 = (n: number) => Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;

const TOPOLOGY_BY_PRESET: Record<string, number> = { cross: 1, offset: 2, strip: 2, zigzag: 3 };

/** A starting difficulty profile (CUBE §29); the author adjusts it. */
export function suggestDifficulty(m: CubeModel, type: QuestionType, stem: Figure[], options: QuestionOption[]): Difficulty {
  const shape = netIndex(m.net.cells);
  const preset = PRESETS.find((p) => netIndex(p.shape) === shape);
  const codes = options.filter((o) => o.distractor).map((o) => o.distractor!.code);
  const oriented = FACE_IDS.filter((f) => symmetryOf(m, f) < 4).length;
  const elements = FACE_IDS.reduce((n, f) => n + m.faces[f].elements.length, 0) + m.patterns.length;
  const c = options.find((o) => o.correct)?.figure;
  const turned = c ? (c.kind === 'cube' ? c.view.filter((x) => x.turns).length : c.cells.filter((x) => x.turns).length) : 0;
  const subtle = codes.filter((x) => ['D04', 'D05', 'D06', 'D08', 'D09'].includes(x)).length;
  return {
    topology: clamp5(preset ? TOPOLOGY_BY_PRESET[preset.id] : 3),
    adjacency: clamp5(type === 'net_to_cube' ? 3 : stem.length === 2 ? 2 : 3),
    oppositeFaceReasoning: clamp5(1 + codes.filter((x) => x === 'D01' || x === 'D03').length),
    orientation: clamp5(1 + oriented * 0.7),
    patternComplexity: clamp5(1 + m.patterns.filter((p) => p.fragments.length > 1).length * 1.5),
    transformationComplexity: clamp5(1 + turned),
    distractorSimilarity: clamp5(1 + subtle),
    visualComplexity: clamp5(1 + elements / 3),
  };
}

export function buildDNA(m: CubeModel, type: QuestionType, stem: Figure[], options: QuestionOption[], difficulty: Difficulty): QuestionDNA {
  return {
    family: 'cube',
    operation: type,
    faceCount: 6,
    optionCount: 5,
    stemFigures: stem.length,
    netShape: netIndex(m.net.cells),
    optionNetShapes: options.map((o) => (o.figure.kind === 'net' ? netIndex(o.figure.cells) : -1)),
    patterns: m.patterns.filter((p) => p.fragments.length > 1).length,
    facesWithArtwork: FACE_IDS.filter((f) => hasArtwork(m, f)).length,
    skills: { ...difficulty },
    distractors: options.filter((o) => o.distractor).map((o) => o.distractor!.type),
  };
}

/** Recomputes the answer, explanation, DNA and rules after any change to the options. */
export function refreshDerived(q: Question): Question {
  const i = q.options.findIndex((o) => o.correct);
  const m = q.spatialModel;
  return {
    ...q,
    answer: { correctOption: i + 1, optionId: q.options[i]?.id ?? '' },
    explanation: explain(m, q.presentation.type, q.options),
    dna: buildDNA(m, q.presentation.type, q.presentation.stem, q.options, q.difficulty),
    rules: [...new Set(q.options.filter((o) => o.distractor).map((o) => o.distractor!.rule))],
  };
}

/** A new, uncommitted question from the model (CUBE §24). */
export function buildQuestion(m: CubeModel, set: GenerateSettings, now = new Date()): Question {
  const { stem, options } = generateOptions(m, set);
  const difficulty = suggestDifficulty(m, set.type, stem, options);
  return refreshDerived({
    schema: QUESTION_SCHEMA,
    questionId: null,
    version: 1,
    createdAt: now.toISOString(),
    title: '',
    spatialModel: m,
    presentation: { type: set.type, optionCount: 5, prompt: PROMPTS[set.type], stem },
    options,
    answer: { correctOption: 0, optionId: '' },
    difficulty,
    dna: buildDNA(m, set.type, stem, options, difficulty),
    rules: [],
    explanation: { correctOption: 0, reasoning: [] },
    assets: [],
  });
}

/** Replaces one option with a fresh distractor (CUBE §27: regenerate one option). */
export function regenerateOption(q: Question, index: number, code: DistractorCode | null, seed: number): Question {
  const m = q.spatialModel;
  const others = q.options.filter((_, i) => i !== index).map((o) => o.figure);
  if (q.options[index]?.correct) {
    // A fresh correct figure: another view of the cube / another net of it.
    const r = rng(seed);
    const s = authoredState(m);
    const keys = new Set([...q.presentation.stem, ...others].map((f) => figureKey(m, f)));
    for (let i = 0; i < 40; i++) {
      const figure: Figure = q.presentation.type === 'net_to_cube' ? { kind: 'cube', view: viewOf(s, r.pick(ROTATIONS)) } : { kind: 'net', cells: correctNet(s, r) };
      if (keys.has(figureKey(m, figure))) continue;
      return refreshDerived({ ...q, options: q.options.map((o, j) => (j === index ? { id: o.id, figure, correct: true } : o)) });
    }
    return q;
  }
  const codes = code ? [code] : DISTRACTOR_CHOICES[q.presentation.type];
  const c = pickDistractor(m, q.presentation.type, q.presentation.stem, [...q.presentation.stem, ...others], codes, rng(seed));
  if (!c) return q;
  const options = q.options.map((o, i) =>
    i === index ? { id: o.id, figure: c.figure, correct: false, distractor: { code: c.code, type: DISTRACTORS[c.code].type, rule: c.rule, note: c.note } } : o,
  );
  return refreshDerived({ ...q, options });
}
