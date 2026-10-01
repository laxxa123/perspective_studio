// Question validation before commit (CUBE §31): spatial, artwork, question,
// metadata. Only a question with no errors can be committed.
import { FACE_IDS } from '../model/CubeModel';
import { DIFFICULTY_DIMENSIONS, type Question } from '../model/QuestionModel';
import { cubeState } from '../geometry/FoldingEngine';
import { validateNet } from '../geometry/NetValidator';
import { figureKey, isCorrectFigure, OPTION_COUNT } from './QuestionEngine';

export type IssueGroup = 'spatial' | 'artwork' | 'question' | 'metadata';

export interface QuestionIssue {
  group: IssueGroup;
  message: string;
  option?: number;
}

const finite = (...n: (number | undefined)[]) => n.every((x) => x === undefined || Number.isFinite(x));

/** All problems; empty = valid. `assetIds` are the assets the store holds. */
export function validateQuestion(q: Question, assetIds: ReadonlySet<string>): QuestionIssue[] {
  const out: QuestionIssue[] = [];
  const m = q.spatialModel;
  const type = q.presentation.type;

  // Spatial validity
  const net = validateNet(m.net.cells);
  for (const i of net.issues) out.push({ group: 'spatial', message: i.message });
  if (net.valid && !cubeState(m.net.cells)) out.push({ group: 'spatial', message: 'The net does not fold into a cube.' });

  // Artwork: references and transforms
  const used = new Set<string>();
  for (const f of FACE_IDS) {
    for (const e of m.faces[f].elements) {
      if (e.assetId) used.add(e.assetId);
      const t = e.transform;
      if (!finite(t.x, t.y, t.rotation, t.scaleX, t.scaleY, e.w, e.h) || !t.scaleX || !t.scaleY) out.push({ group: 'artwork', message: `Face ${f}: an element has an invalid transform.` });
    }
  }
  for (const p of m.patterns) {
    if (p.element.assetId) used.add(p.element.assetId);
    if (!p.fragments.length) out.push({ group: 'artwork', message: 'A pattern covers no face.' });
  }
  for (const id of used) if (!assetIds.has(id)) out.push({ group: 'artwork', message: `Image ${id} is missing from the asset store.` });
  const listed = new Set(q.assets.map((a) => a.id));
  for (const id of used) if (!listed.has(id)) out.push({ group: 'artwork', message: `Image ${id} is not listed in the question's assets.` });

  // Question
  if (q.options.length !== OPTION_COUNT) out.push({ group: 'question', message: `A question needs exactly ${OPTION_COUNT} options (has ${q.options.length}).` });
  const marked = q.options.filter((o) => o.correct);
  if (marked.length !== 1) out.push({ group: 'question', message: marked.length ? 'More than one option is marked correct.' : 'No option is marked correct.' });
  if (!q.presentation.stem.length) out.push({ group: 'question', message: 'The question shows nothing to start from.' });
  if (net.valid) {
    q.options.forEach((o, i) => {
      const fig = o.figure;
      if (type === 'net_to_cube' && fig.kind !== 'cube') out.push({ group: 'question', message: `Option ${i + 1} must be a cube.`, option: i + 1 });
      if (type === 'cube_to_net' && fig.kind !== 'net') out.push({ group: 'question', message: `Option ${i + 1} must be a net.`, option: i + 1 });
      const ok = isCorrectFigure(m, type, q.presentation.stem, fig);
      if (o.correct && !ok) out.push({ group: 'question', message: `Option ${i + 1} is marked correct but does not match.`, option: i + 1 });
      if (!o.correct && ok) out.push({ group: 'question', message: `Option ${i + 1} is also a correct answer (ambiguous).`, option: i + 1 });
      if (o.distractor?.code === 'D07' && fig.kind === 'net' && validateNet(fig.cells).valid) out.push({ group: 'question', message: `Option ${i + 1} should be an invalid net (D07) but folds.`, option: i + 1 });
    });
    const keys = q.options.map((o) => figureKey(m, o.figure));
    keys.forEach((k, i) => {
      const j = keys.indexOf(k);
      if (j < i) out.push({ group: 'question', message: `Options ${j + 1} and ${i + 1} look the same.`, option: i + 1 });
    });
  }
  if (q.answer.correctOption !== q.options.findIndex((o) => o.correct) + 1) out.push({ group: 'question', message: 'The answer does not point at the correct option.' });

  // Metadata
  for (const d of DIFFICULTY_DIMENSIONS) {
    const v = q.difficulty[d];
    if (!(Number.isInteger(v) && v >= 1 && v <= 5)) out.push({ group: 'metadata', message: `Difficulty "${d}" must be 1–5.` });
  }
  if (q.dna.operation !== type) out.push({ group: 'metadata', message: 'Question DNA does not match the question type.' });
  if (!q.explanation.reasoning.length) out.push({ group: 'metadata', message: 'The explanation is empty.' });
  return out;
}
