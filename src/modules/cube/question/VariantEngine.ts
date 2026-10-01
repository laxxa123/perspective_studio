// Variants (CUBE §38): same skill profile, different visual content — the
// faces' artwork is reshuffled and recoloured, the net is laid out as another
// of the 11 nets, and fresh distractors of the same kinds are made.
import { FACE_IDS, type CubeModel, type FaceModel } from '../model/CubeModel';
import type { DistractorCode, Question } from '../model/QuestionModel';
import { ROTATIONS } from '../geometry/CubeGeometry';
import { cubeState, unfold } from '../geometry/FoldingEngine';
import { CUBE_NETS, netIndex, variants } from '../geometry/NetShapes';
import { buildQuestion, refreshDerived } from './QuestionEngine';
import { rng } from './Random';

const PALETTE = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599', '#e64980', '#212529'];

export function makeVariant(q: Question, seed: number, now = new Date()): Question {
  const r = rng(seed);
  const m0 = q.spatialModel;
  const s = cubeState(m0.net.cells);
  if (!s) throw new Error('The net does not fold into a cube.');

  // Recolour: a consistent permutation of the palette.
  const shifted = r.shuffle(PALETTE);
  const recolour = (c: string | null | undefined) => {
    if (!c) return c;
    const i = PALETTE.indexOf(c.toLowerCase());
    return i >= 0 ? shifted[i] : c;
  };
  const faces = { ...m0.faces };
  for (const f of FACE_IDS) {
    const fm = m0.faces[f];
    faces[f] = { ...fm, elements: fm.elements.map((e) => ({ ...e, fill: recolour(e.fill), stroke: recolour(e.stroke) })) };
  }
  // Reshuffle which face carries which artwork (not when patterns tie faces together).
  let model: CubeModel = { ...m0, faces, patterns: m0.patterns.map((p) => ({ ...p, element: { ...p.element, fill: recolour(p.element.fill), stroke: recolour(p.element.stroke) } })) };
  if (!m0.patterns.length) {
    const perm = r.shuffle(FACE_IDS);
    model = { ...model, faces: Object.fromEntries(FACE_IDS.map((f, i) => [f, { ...faces[perm[i]], id: f } as FaceModel])) as CubeModel['faces'] };
  }
  // Another net layout of the same cube.
  const current = netIndex(m0.net.cells);
  const choices = CUBE_NETS.map((_, i) => i).filter((i) => i !== current);
  const shape = r.pick(variants(CUBE_NETS[r.pick(choices)]));
  const cells = unfold(s, shape, r.pick(ROTATIONS))!;
  model = { ...model, net: { cells } };

  const codes = q.options.filter((o) => o.distractor).map((o) => o.distractor!.code) as DistractorCode[];
  const fresh = buildQuestion(model, { type: q.presentation.type, stemCount: q.presentation.stem.length === 2 ? 2 : 1, distractors: codes, seed: seed + 1 }, now);
  return refreshDerived({ ...fresh, title: q.title ? `${q.title} (variant)` : '', difficulty: q.difficulty });
}
