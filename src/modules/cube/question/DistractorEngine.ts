// Distractors (CUBE §26): each one is made by a named spatial error rule, so
// the generator always knows why an option is wrong.
import { FACE_IDS, hasArtwork, mirrorVisible, symmetryOf, type CubeModel, type FaceId, type NetCell, type Turns } from '../model/CubeModel';
import type { DistractorCode, Figure } from '../model/QuestionModel';
import { ROTATIONS } from '../geometry/CubeGeometry';
import { cubeState, oppositeOf, unfold, viewOf, type CubeState, type CubeView, type Slot } from '../geometry/FoldingEngine';
import { CUBE_NETS, NON_NETS, variants } from '../geometry/NetShapes';
import { patternFaces } from '../geometry/PatternContinuity';
import type { Rng } from './Random';

export interface Candidate {
  code: DistractorCode;
  rule: string;
  note: string;
  figure: Figure;
}

const turn = (t: Turns, by: number): Turns => (((t + by) % 4) + 4) % 4 as Turns;
const cubeFig = (view: CubeView): Figure => ({ kind: 'cube', view });
const netFig = (cells: NetCell[]): Figure => ({ kind: 'net', cells });
const SLOT = ['top', 'front', 'right'];

/** Cube-view distractors (Net → Cube options), made from a true view of the cube. */
export function cubeViewCandidates(m: CubeModel, s: CubeState, base: CubeView, code: DistractorCode, r: Rng): Candidate[] {
  const out: Candidate[] = [];
  const set = (i: number, slot: Slot): CubeView => base.map((x, j) => (j === i ? slot : x)) as CubeView;
  const order = r.shuffle([0, 1, 2]);
  const pf = patternFaces(m);
  for (const i of order) {
    const sl = base[i];
    const others = base.filter((_, j) => j !== i).map((x) => x.face);
    switch (code) {
      case 'D01':
        // Rule 4: show the face opposite a visible neighbour next to it.
        for (const o of others) {
          const opp = oppositeOf(s, o);
          if (!others.includes(opp) && opp !== sl.face) out.push({ code, rule: 'OPPOSITE_01', note: `${opp} is opposite ${o}, so they cannot touch.`, figure: cubeFig(set(i, { ...sl, face: opp })) });
        }
        break;
      case 'D02': {
        const j = order.find((k) => k !== i)!;
        const v = [...base] as CubeView;
        [v[i], v[j]] = [v[j], v[i]];
        out.push({ code, rule: 'ADJACENCY_01', note: `${base[i].face} and ${base[j].face} swapped places.`, figure: cubeFig(v) });
        break;
      }
      case 'D03': {
        // Rule 5: the corner's third face replaced by its own opposite (mirror corner).
        const opp = oppositeOf(s, sl.face);
        out.push({ code, rule: 'CORNER_01', note: `${others.join(' and ')} meet ${sl.face} at this corner, not ${opp}.`, figure: cubeFig(set(i, { ...sl, face: opp })) });
        break;
      }
      case 'D04':
        if (symmetryOf(m, sl.face) < 4) for (const by of r.shuffle([1, 3])) out.push({ code, rule: 'ORIENTATION_01', note: `${sl.face} is turned a quarter on the ${SLOT[i]} face.`, figure: cubeFig(set(i, { ...sl, turns: turn(sl.turns, by) })) });
        break;
      case 'D06':
        if (symmetryOf(m, sl.face) === 1) out.push({ code, rule: 'ORIENTATION_02', note: `${sl.face} is upside down on the ${SLOT[i]} face.`, figure: cubeFig(set(i, { ...sl, turns: turn(sl.turns, 2) })) });
        break;
      case 'D05':
        if (mirrorVisible(m, sl.face)) out.push({ code, rule: 'MIRROR_01', note: `${sl.face} is mirrored; artwork never flips when folded.`, figure: cubeFig(set(i, { ...sl, mirrored: !sl.mirrored })) });
        break;
      case 'D08':
        if (pf.has(sl.face) && others.some((o) => pf.has(o))) for (const by of r.shuffle([1, 2, 3])) out.push({ code, rule: 'CONTINUITY_01', note: `The pattern on ${sl.face} no longer meets its continuation.`, figure: cubeFig(set(i, { ...sl, turns: turn(sl.turns, by) })) });
        break;
      case 'D09': {
        // The same three faces, presented in the other cyclic order.
        const v: CubeView = [base[0], base[2], base[1]];
        out.push({ code, rule: 'VIEWPOINT_01', note: 'The three faces are right, but they go round the corner the other way.', figure: cubeFig(v) });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

const cellsOf = (shape: { col: number; row: number }[], faces: FaceId[]): NetCell[] => shape.map((c, i) => ({ face: faces[i], col: c.col, row: c.row, turns: 0 }));

/** Net distractors (Cube → Net options), made from a correct net. */
export function netCandidates(m: CubeModel, s: CubeState, base: NetCell[], code: DistractorCode, r: Rng): Candidate[] {
  const out: Candidate[] = [];
  const at = (i: number, c: Partial<NetCell>) => base.map((x, j) => (j === i ? { ...x, ...c } : x));
  const pf = patternFaces(m);
  for (const i of r.shuffle(base.map((_, k) => k))) {
    const cell = base[i];
    switch (code) {
      case 'D01':
      case 'D02':
        for (const j of r.shuffle(base.map((_, k) => k))) {
          if (j === i) continue;
          const swapped = base.map((x, k) => (k === i ? { ...x, face: base[j].face, turns: base[j].turns } : k === j ? { ...x, face: cell.face, turns: cell.turns } : x));
          const t = cubeState(swapped);
          if (!t) continue;
          // Swapping two opposite faces keeps the opposite pairs; any other swap breaks them.
          const brokeOpposite = FACE_IDS.some((f) => oppositeOf(s, f) !== oppositeOf(t, f));
          if (code === 'D01' && brokeOpposite) out.push({ code, rule: 'OPPOSITE_02', note: `Swapping ${cell.face} and ${base[j].face} puts opposite faces side by side.`, figure: netFig(swapped) });
          if (code === 'D02' && !brokeOpposite) out.push({ code, rule: 'ADJACENCY_02', note: `${cell.face} and ${base[j].face} swapped: the neighbours change.`, figure: netFig(swapped) });
        }
        break;
      case 'D04':
        if (symmetryOf(m, cell.face) < 4) for (const by of r.shuffle([1, 3])) out.push({ code, rule: 'ORIENTATION_03', note: `${cell.face} is turned a quarter on the net.`, figure: netFig(at(i, { turns: turn(cell.turns, by) })) });
        break;
      case 'D06':
        if (symmetryOf(m, cell.face) === 1) out.push({ code, rule: 'ORIENTATION_04', note: `${cell.face} is upside down on the net.`, figure: netFig(at(i, { turns: turn(cell.turns, 2) })) });
        break;
      case 'D05':
        if (mirrorVisible(m, cell.face)) out.push({ code, rule: 'MIRROR_02', note: `${cell.face} is mirrored on the net.`, figure: netFig(at(i, { mirrored: !cell.mirrored })) });
        break;
      case 'D08':
        if (pf.has(cell.face)) for (const by of r.shuffle([1, 2, 3])) out.push({ code, rule: 'CONTINUITY_02', note: `The pattern on ${cell.face} is broken at the fold.`, figure: netFig(at(i, { turns: turn(cell.turns, by) })) });
        break;
      default:
        break;
    }
  }
  if (code === 'D07') {
    // Plausible-looking hexominoes that cannot fold (Rule 7), faces in their correct-net order.
    for (const shape of r.shuffle(NON_NETS).slice(0, 6)) {
      const v = r.pick(variants(shape));
      out.push({ code, rule: 'NET_01', note: 'These six squares cannot fold into a cube.', figure: netFig(cellsOf(v, base.map((c) => c.face)).map((c, k) => ({ ...c, turns: base[k].turns }))) });
    }
  }
  return out;
}

/** A correct net for the cube: one of the 11 nets, any orientation, any turn of the cube. */
export function correctNet(s: CubeState, r: Rng, preferShape?: number): NetCell[] {
  const shapeIdx = preferShape ?? r.int(CUBE_NETS.length);
  const shape = r.pick(variants(CUBE_NETS[shapeIdx]));
  return unfold(s, shape, r.pick(ROTATIONS))!;
}

/** A view of the cube that shows as much artwork as possible. */
export function bestView(m: CubeModel, s: CubeState, r: Rng, avoid: string[] = []): CubeView {
  const scored = r
    .shuffle(ROTATIONS)
    .map((rot) => viewOf(s, rot))
    .filter((v) => !avoid.includes(v.map((x) => x.face).sort().join('')))
    .map((v) => ({ v, score: v.filter((x) => hasArtwork(m, x.face)).length }));
  scored.sort((a, b) => b.score - a.score);
  return (scored[0] ?? { v: viewOf(s) }).v;
}
