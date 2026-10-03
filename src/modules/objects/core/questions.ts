// The question engine (OBJECTS §A.5, §A.8, §A.9; §34–§40, §64–§66): question
// types, the exact correct answer, intentional distractors, validation,
// profile and explanation. Every answer is data drawn by the renderer; the
// correct option is computed, never guessed. Pure.
import { bounds, connected, has, key, type Axis, type Blocks, type Cell } from './blocks';
import { applyOp, applyOps, figureKey, nudgeFigure, OP_TEXT, REFLECTIONS, sameFigure, sameShape, turnArrow, TURNS, type Figure, type Op } from './figure';
import { canPunch, foldProblem, holesKey, shiftHoles, unfold, wrongMirror, type FoldSpec, type Hole } from './fold';
import { drawingKey, hiddenCount, visibleBlocks } from './iso';
import { rng, type Rng } from './random';
import { addOne, apply, canonical, encode, isChiral, mirror, mirrorGrid, moveOne, normalise, removeOne, ROTATIONS, sameCells, sameGrid, sameObject, section, SIDES, split, transform, turnBy, turnGrid, turnMatrix, view, assembles, gridKey, layers, type Grid, type Mat, type Side } from './space';

export const QUESTION_SCHEMA = 'creative.objects.question.v1';
export const OPTION_COUNT = 5;

export type Family = 'same' | 'turn' | 'view' | 'reconstruct' | 'count' | 'section' | 'track' | 'assemble' | 'f-turn' | 'f-reflect' | 'f-same' | 'f-steps' | 'fold';
export type Kind = 'blocks' | 'figure';

export const FAMILIES: { id: Family; kind: Kind; label: string }[] = [
  { id: 'same', kind: 'blocks', label: 'Same object' },
  { id: 'turn', kind: 'blocks', label: 'Turn' },
  { id: 'view', kind: 'blocks', label: 'View' },
  { id: 'reconstruct', kind: 'blocks', label: 'From views' },
  { id: 'count', kind: 'blocks', label: 'Count' },
  { id: 'section', kind: 'blocks', label: 'Cut' },
  { id: 'track', kind: 'blocks', label: 'Track' },
  { id: 'assemble', kind: 'blocks', label: 'Pieces' },
  { id: 'f-turn', kind: 'figure', label: 'Turn' },
  { id: 'f-reflect', kind: 'figure', label: 'Mirror' },
  { id: 'f-same', kind: 'figure', label: 'Same figure' },
  { id: 'f-steps', kind: 'figure', label: 'Two steps' },
  { id: 'fold', kind: 'figure', label: 'Fold & punch' },
];
export const familyLabel = (f: Family) => FAMILIES.find((x) => x.id === f)!.label;
export const kindOf = (f: Family): Kind => FAMILIES.find((x) => x.id === f)!.kind;

/** What an option (or a stem figure) is: data, drawn by the renderer (OBJECTS §A.9). */
export type Item =
  | { kind: 'blocks'; blocks: Blocks; tint?: readonly Cell[] }
  | { kind: 'grid'; grid: Grid; label?: string }
  | { kind: 'figure'; figure: Figure }
  | { kind: 'holes'; n: number; holes: readonly Hole[] }
  | { kind: 'number'; value: number }
  | { kind: 'pair'; a: Blocks; b: Blocks }
  | { kind: 'folds'; spec: FoldSpec };

/** Distractor classes (OBJECTS §35). */
export const RULES: Record<string, string> = {
  correct: 'Correct',
  D01: 'Wrong turn',
  D02: 'Wrong viewpoint',
  D03: 'Mirror image',
  D04: 'Moved',
  D06: 'Part missing',
  D07: 'Part added',
  D08: 'Wrong place',
  D10: 'Wrong projection',
  D11: 'Wrong cut',
  D12: 'Orientation reversed',
  author: 'Author’s option',
};

export interface Option {
  item: Item;
  /** `correct`, a distractor class (D01 …) or `author`. */
  rule: string;
  note: string;
}

export interface Source {
  blocks: Blocks;
  /** The marked block (Track). */
  marked: Cell | null;
  figure: Figure;
  fold: FoldSpec;
}

export interface Params {
  axis: Axis;
  quarters: 1 | 2 | 3;
  side: Side;
  layer: number;
  /** Count: all blocks or the hidden ones. */
  count: 'all' | 'hidden';
  /** 2D: the turn / reflection, or the two steps. */
  ops: Op[];
}

export const defaultParams = (): Params => ({ axis: 'y', quarters: 1, side: 'front', layer: 0, count: 'all', ops: ['r90'] });

export interface Profile {
  /** Blocks or filled cells. */
  size: number;
  hidden: number;
  /** Quarter turns, operations or folds. */
  steps: number;
  mirror: boolean;
  /** 1 (easy) … 5 (hard): computed, the author may set it. */
  difficulty: number;
  difficultySet: boolean;
}

export interface Question {
  schema: typeof QUESTION_SCHEMA;
  questionId: string | null;
  version: number;
  family: Family;
  stem: string;
  source: Source;
  params: Params;
  options: Option[];
  correct: number;
  seed: number;
  profile: Profile;
  explanation: string[];
  createdAt: string;
}

// ----- wording -----

const TURN_TEXT: Record<Axis, Record<1 | 2 | 3, string>> = {
  y: { 1: '90° so that the front turns to the right', 2: '180° about the upright axis', 3: '90° so that the front turns to the left' },
  x: { 1: '90° so that the top turns towards you', 2: '180° about the left–right axis', 3: '90° so that the top turns away from you' },
  z: { 1: '90° anticlockwise as you face the front', 2: '180° about the front–back axis', 3: '90° clockwise as you face the front' },
};
export const turnText = (axis: Axis, q: 1 | 2 | 3) => TURN_TEXT[axis][q];
const CUT_TEXT: Record<Axis, string> = { y: 'level (seen from the top)', z: 'front to back (seen from the front)', x: 'left to right (seen from the right)' };

export function stemText(family: Family, p: Params): string {
  switch (family) {
    case 'same':
      return 'Which object is the same as this one, only turned?';
    case 'turn':
      return `The object is turned ${turnText(p.axis, p.quarters)}. Which shows the result?`;
    case 'view':
      return `Which is the view from the ${p.side}? (The front faces down-left in the drawing.)`;
    case 'reconstruct':
      return 'Which object has these three views?';
    case 'count':
      return p.count === 'all'
        ? 'How many blocks make up this object? Every block rests on the floor or on another block.'
        : 'How many blocks cannot be seen? Every block rests on the floor or on another block.';
    case 'section':
      return `The object is cut through the shaded layer, ${CUT_TEXT[p.axis]}. Which shape does the cut show?`;
    case 'track':
      return `The object is turned ${turnText(p.axis, p.quarters)}. Where is the shaded block now?`;
    case 'assemble':
      return 'Which two pieces fit together to make this object?';
    case 'f-turn':
    case 'f-reflect':
      return `Which shows this figure ${OP_TEXT[p.ops[0]]}?`;
    case 'f-same':
      return 'Which figure is the same as this one, only turned?';
    case 'f-steps':
      return `The figure is ${OP_TEXT[p.ops[0]]}, then ${OP_TEXT[p.ops[1] ?? 'fv']}. Which shows the result?`;
    case 'fold':
      return 'The sheet is folded as shown and punched. What does it look like opened out?';
  }
}

// ----- the stem and the correct answer -----

/** Transforms an object and its marked block together, back at the origin. */
function moveWithMark(b: Blocks, mark: Cell | null, m: Mat): { blocks: Blocks; mark: Cell | null } {
  const t = transform(b, m);
  const box = bounds(t)!;
  const back = (c: Cell): Cell => [c[0] - box.min[0], c[1] - box.min[1], c[2] - box.min[2]];
  return { blocks: normalise(t), mark: mark ? back(apply(m, mark)) : null };
}

export function stemItems(family: Family, s: Source, p: Params): Item[] {
  switch (family) {
    case 'reconstruct':
      return (['front', 'top', 'right'] as Side[]).map((side) => ({ kind: 'grid', grid: view(s.blocks, side), label: side[0].toUpperCase() + side.slice(1) }));
    case 'section': {
      const n = normalise(s.blocks);
      const i = p.axis === 'x' ? 0 : p.axis === 'y' ? 1 : 2;
      return [{ kind: 'blocks', blocks: n, tint: n.filter((c) => c[i] === p.layer) }];
    }
    case 'track':
      return [{ kind: 'blocks', blocks: s.blocks, tint: s.marked ? [s.marked] : [] }];
    case 'f-turn':
    case 'f-reflect':
    case 'f-same':
    case 'f-steps':
      return [{ kind: 'figure', figure: s.figure }];
    case 'fold':
      return [{ kind: 'folds', spec: s.fold }];
    default:
      return [{ kind: 'blocks', blocks: s.blocks }];
  }
}

/** The correct answer for `turn`, `view`, `count`, `section`, `track`, 2D and `fold` (others are any matching item). */
export function expected(family: Family, s: Source, p: Params): Item | null {
  switch (family) {
    case 'turn':
      return { kind: 'blocks', blocks: turnBy(s.blocks, p.axis, p.quarters) };
    case 'view':
      return { kind: 'grid', grid: view(s.blocks, p.side) };
    case 'count':
      return { kind: 'number', value: p.count === 'all' ? s.blocks.length : hiddenCount(s.blocks) };
    case 'section':
      return { kind: 'grid', grid: section(s.blocks, p.axis, p.layer) };
    case 'track': {
      const t = moveWithMark(s.blocks, s.marked, turnMatrix(p.axis, p.quarters));
      return { kind: 'blocks', blocks: t.blocks, tint: t.mark ? [t.mark] : [] };
    }
    case 'f-turn':
    case 'f-reflect':
    case 'f-steps':
      return { kind: 'figure', figure: applyOps(s.figure, family === 'f-steps' ? p.ops.slice(0, 2) : p.ops.slice(0, 1)) };
    case 'fold':
      return { kind: 'holes', n: s.fold.n, holes: unfold(s.fold) };
    default:
      return null;
  }
}

/** "Draws the same" for block options (shading included). */
const drawKey = (i: Item) => (i.kind === 'blocks' ? drawingKey(i.blocks) + tintKey(i) : '');

const tintKey = (i: Item) => (i.kind === 'blocks' && i.tint?.length ? `#${i.tint.map(key).join('|')}` : '');

/** Whether an option answers the question (OBJECTS §65: exact, under the question's sameness rule). */
export function isCorrect(family: Family, s: Source, p: Params, item: Item): boolean {
  const e = expected(family, s, p);
  switch (family) {
    case 'same':
      return item.kind === 'blocks' && sameObject(item.blocks, s.blocks);
    case 'reconstruct':
      return item.kind === 'blocks' && (['front', 'top', 'right'] as Side[]).every((side) => sameGrid(view(item.blocks, side), view(s.blocks, side)));
    case 'assemble':
      return item.kind === 'pair' && assembles(s.blocks, item.a, item.b);
    case 'f-same':
      return item.kind === 'figure' && sameShape(item.figure, s.figure);
    case 'turn':
      return item.kind === 'blocks' && e?.kind === 'blocks' && sameCells(item.blocks, e.blocks);
    case 'track':
      return item.kind === 'blocks' && e?.kind === 'blocks' && sameCells(item.blocks, e.blocks) && tintKey(item) === tintKey(e);
    case 'view':
    case 'section':
      return item.kind === 'grid' && e?.kind === 'grid' && sameGrid(item.grid, e.grid);
    case 'count':
      return item.kind === 'number' && e?.kind === 'number' && item.value === e.value;
    case 'f-turn':
    case 'f-reflect':
    case 'f-steps':
      return item.kind === 'figure' && e?.kind === 'figure' && sameFigure(item.figure, e.figure);
    case 'fold':
      return item.kind === 'holes' && e?.kind === 'holes' && holesKey(item.holes) === holesKey(e.holes);
  }
}

/** Two options are "the same answer" when this key matches (OBJECTS §66). */
export function itemKey(family: Family, i: Item): string {
  switch (i.kind) {
    case 'blocks':
      return family === 'same' ? `c:${canonical(i.blocks)}` : `e:${encode(i.blocks)}${tintKey(i)}`;
    case 'grid':
      return `g:${gridKey(i.grid)}`;
    case 'figure': {
      if (family !== 'f-same') return `f:${figureKey(i.figure)}`;
      // Same figure: turned copies are one answer.
      const keys = [i.figure, ...TURNS.map((o) => applyOp(i.figure, o))].map((f) => figureKey(shiftFig(f)));
      return `s:${keys.sort()[0]}`;
    }
    case 'holes':
      return `h:${holesKey(i.holes)}`;
    case 'number':
      return `n:${i.value}`;
    case 'pair':
      return `p:${[canonical(i.a), canonical(i.b)].sort().join('+')}`;
    case 'folds':
      return 'folds';
  }
}

function shiftFig(f: Figure): Figure {
  const xs = [...f.cells.map((c) => c[0]), ...f.marks.map((m) => m.c)];
  const ys = [...f.cells.map((c) => c[1]), ...f.marks.map((m) => m.r)];
  if (!xs.length) return f;
  const dx = Math.min(...xs);
  const dy = Math.min(...ys);
  return { n: f.n, cells: f.cells.map(([c, r]) => [c - dx, r - dy] as const), marks: f.marks.map((m) => ({ ...m, c: m.c - dx, r: m.r - dy })) };
}

/** Whether every block of an option's drawing can be seen (no hidden-block ambiguity, OBJECTS §A.6). */
function drawable(i: Item): boolean {
  if (i.kind === 'blocks') return hiddenCount(i.blocks) === 0 && (i.tint ?? []).every((t) => visibleBlocks(i.blocks).has(key(t)));
  if (i.kind === 'pair') return hiddenCount(i.a) === 0 && hiddenCount(i.b) === 0;
  return true;
}

// ----- distractors -----

const randomTurn = (b: Blocks, r: Rng, avoid: string[] = []): Blocks | null => {
  for (const m of r.shuffle(ROTATIONS)) {
    const t = normalise(transform(b, m));
    if (hiddenCount(t) === 0 && !avoid.includes(drawingKey(t))) return t;
  }
  return null;
};

const opt = (item: Item | null, rule: string, note: string): Option | null => (item ? { item, rule, note } : null);
const blocksOpt = (b: Blocks | null, rule: string, note: string) => opt(b ? { kind: 'blocks', blocks: normalise(b) } : null, rule, note);

function changeCell(g: Grid, r: Rng): Grid | null {
  if (!g.w || !g.h) return null;
  for (let t = 0; t < 20; t++) {
    const c = r.int(g.w);
    const w = r.int(g.h);
    const on = g.cells.some((x) => x[0] === c && x[1] === w);
    const cells = on ? g.cells.filter((x) => !(x[0] === c && x[1] === w)) : [...g.cells, [c, w] as const];
    if (cells.length) return { ...g, cells: [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]) };
  }
  return null;
}

/** Candidate wrong answers, in order of preference (each records why it is wrong). */
function pool(family: Family, s: Source, p: Params, r: Rng): (Option | null)[] {
  const b = s.blocks;
  const out: (Option | null)[] = [];
  const stemKey = drawingKey(normalise(b));
  switch (family) {
    case 'same': {
      if (isChiral(b)) out.push(blocksOpt(randomTurn(mirror(b), r, [stemKey]), 'D03', 'Mirror image of the object'));
      for (let i = 0; i < 6; i++) {
        const m = moveOne(b, r);
        out.push(blocksOpt(m && randomTurn(m, r, [stemKey]), 'D04', 'One block moved'));
      }
      out.push(blocksOpt(randomTurn(addOne(b, r) ?? b, r, [stemKey]), 'D07', 'One block added'));
      out.push(blocksOpt(randomTurn(removeOne(b, r) ?? b, r, [stemKey]), 'D06', 'One block missing'));
      break;
    }
    case 'turn': {
      const q = p.quarters;
      for (const a of (['x', 'y', 'z'] as Axis[]).filter((x) => x !== p.axis)) out.push(blocksOpt(turnBy(b, a, q), 'D01', `Turned about the ${a === 'y' ? 'upright' : a === 'x' ? 'left–right' : 'front–back'} axis instead`));
      if (q !== 2) out.push(blocksOpt(turnBy(b, p.axis, 4 - q), 'D01', 'Turned the other way'));
      if (q !== 2) out.push(blocksOpt(turnBy(b, p.axis, 2), 'D01', 'Turned 180° instead of 90°'));
      out.push(blocksOpt(mirror(turnBy(b, p.axis, q)), 'D03', 'Mirror image of the result'));
      for (let i = 0; i < 10; i++) out.push(blocksOpt(moveOne(turnBy(b, p.axis, q), r), 'D04', 'One block moved'));
      break;
    }
    case 'view': {
      const right = view(b, p.side);
      for (const side of SIDES.filter((x) => x !== p.side)) out.push(opt({ kind: 'grid', grid: view(b, side) }, 'D02', `The view from the ${side}`));
      out.push(opt({ kind: 'grid', grid: mirrorGrid(right) }, 'D03', 'The view, mirrored'));
      if (right.w === right.h) out.push(opt({ kind: 'grid', grid: turnGrid(right) }, 'D01', 'The view, turned'));
      for (let i = 0; i < 3; i++) out.push(opt(changeCell(right, r) && { kind: 'grid', grid: changeCell(right, r)! }, 'D10', 'One square wrong'));
      break;
    }
    case 'reconstruct': {
      out.push(blocksOpt(isChiral(b) ? mirror(b) : null, 'D03', 'Mirror image of the object'));
      for (let i = 0; i < 8; i++) {
        const m = moveOne(b, r);
        const twoOfThree = m && (['front', 'top', 'right'] as Side[]).filter((side) => sameGrid(view(m, side), view(b, side))).length === 2;
        out.push(blocksOpt(m, twoOfThree ? 'D10' : 'D04', twoOfThree ? 'Matches two of the three views' : 'One block moved'));
      }
      break;
    }
    case 'count': {
      const v = p.count === 'all' ? b.length : hiddenCount(b);
      if (p.count === 'all' && hiddenCount(b) > 0) out.push(opt({ kind: 'number', value: b.length - hiddenCount(b) }, 'D06', 'Only the blocks that can be seen'));
      for (const d of [1, -1, 2, -2, 3]) if (v + d >= 0) out.push(opt({ kind: 'number', value: v + d }, d > 0 ? 'D07' : 'D06', d > 0 ? `${d} too many` : `${-d} too few`));
      break;
    }
    case 'section': {
      const right = section(b, p.axis, p.layer);
      for (const k of [p.layer - 1, p.layer + 1, p.layer + 2]) if (k >= 0 && k < layers(b, p.axis)) out.push(opt({ kind: 'grid', grid: section(b, p.axis, k) }, 'D11', 'Another layer'));
      out.push(opt({ kind: 'grid', grid: mirrorGrid(right) }, 'D03', 'The cut, mirrored'));
      if (right.w === right.h) out.push(opt({ kind: 'grid', grid: turnGrid(right) }, 'D01', 'The cut, turned'));
      const side: Side = p.axis === 'x' ? 'right' : p.axis === 'y' ? 'top' : 'front';
      out.push(opt({ kind: 'grid', grid: view(b, side) }, 'D10', 'The whole view instead of the cut'));
      for (let i = 0; i < 6; i++) out.push(opt(changeCell(right, r) && { kind: 'grid', grid: changeCell(right, r)! }, 'D11', 'One square wrong'));
      break;
    }
    case 'track': {
      const e = expected(family, s, p);
      if (e?.kind !== 'blocks') break;
      for (const c of r.shuffle(e.blocks).slice(0, 8)) out.push(opt({ kind: 'blocks', blocks: e.blocks, tint: [c] }, 'D08', 'The shaded block in the wrong place'));
      for (const [a, q] of [
        [p.axis, 4 - p.quarters],
        [p.axis === 'y' ? 'x' : 'y', p.quarters],
      ] as [Axis, number][]) {
        const t = moveWithMark(b, s.marked, turnMatrix(a, q));
        out.push(opt({ kind: 'blocks', blocks: t.blocks, tint: t.mark ? [t.mark] : [] }, 'D01', 'Turned the wrong way'));
      }
      break;
    }
    case 'assemble': {
      const parts = split(b, r);
      if (!parts) break;
      const [a, c] = parts;
      if (isChiral(c)) out.push(opt({ kind: 'pair', a: randomTurn(a, r) ?? a, b: randomTurn(mirror(c), r) ?? mirror(c) }, 'D03', 'One piece is a mirror image'));
      if (isChiral(a)) out.push(opt({ kind: 'pair', a: randomTurn(mirror(a), r) ?? mirror(a), b: randomTurn(c, r) ?? c }, 'D03', 'One piece is a mirror image'));
      for (let i = 0; i < 10; i++) {
        const m = moveOne(i % 2 ? a : c, r);
        if (m) out.push(opt({ kind: 'pair', a: randomTurn(i % 2 ? m : a, r) ?? a, b: randomTurn(i % 2 ? c : m, r) ?? c }, 'D04', 'One piece has a block moved'));
      }
      for (const [x, y] of [
        [a, c],
        [c, a],
      ]) {
        const big = addOne(y, r);
        if (big) out.push(opt({ kind: 'pair', a: randomTurn(x, r) ?? x, b: randomTurn(big, r) ?? big }, 'D07', 'One piece is a block too big'));
        const small = removeOne(y, r);
        if (small) out.push(opt({ kind: 'pair', a: randomTurn(x, r) ?? x, b: randomTurn(small, r) ?? small }, 'D06', 'One piece is a block too small'));
      }
      break;
    }
    case 'f-turn':
    case 'f-reflect':
    case 'f-same': {
      const f = s.figure;
      const e = family === 'f-same' ? applyOp(f, r.pick(TURNS)) : applyOp(f, p.ops[0]);
      const turns = family === 'f-reflect' ? TURNS : TURNS.filter((o) => o !== p.ops[0]);
      const refl = family === 'f-reflect' ? REFLECTIONS.filter((o) => o !== p.ops[0]) : REFLECTIONS;
      for (const o of refl) out.push(opt({ kind: 'figure', figure: applyOp(f, o) }, 'D03', family === 'f-reflect' ? 'Reflected in another line' : 'A mirror image'));
      if (family !== 'f-same') for (const o of turns) out.push(opt({ kind: 'figure', figure: applyOp(f, o) }, 'D01', OP_TEXT[o].replace(/^./, (x) => x.toUpperCase())));
      out.push(opt(turnArrow(e, r) && { kind: 'figure', figure: turnArrow(e, r)! }, 'D12', 'The arrow points the wrong way'));
      for (let i = 0; i < 3; i++) out.push(opt(nudgeFigure(e, r) && { kind: 'figure', figure: nudgeFigure(e, r)! }, 'D04', 'One square moved'));
      break;
    }
    case 'f-steps': {
      const [a, c] = [p.ops[0], p.ops[1] ?? 'fv'];
      const f = s.figure;
      out.push(opt({ kind: 'figure', figure: applyOps(f, [c, a]) }, 'D01', 'The steps in the other order'));
      out.push(opt({ kind: 'figure', figure: applyOp(f, a) }, 'D06', 'Only the first step'));
      out.push(opt({ kind: 'figure', figure: applyOp(f, c) }, 'D06', 'Only the second step'));
      for (const o of REFLECTIONS) out.push(opt({ kind: 'figure', figure: applyOps(f, [a, o]) }, 'D03', 'Reflected in the wrong line'));
      out.push(opt(turnArrow(applyOps(f, [a, c]), r) && { kind: 'figure', figure: turnArrow(applyOps(f, [a, c]), r)! }, 'D12', 'The arrow points the wrong way'));
      break;
    }
    case 'fold': {
      const spec = s.fold;
      const right = unfold(spec);
      if (spec.folds.length > 1) out.push(opt({ kind: 'holes', n: spec.n, holes: unfold(spec, 1) }, 'D06', 'One fold not opened'));
      out.push(opt({ kind: 'holes', n: spec.n, holes: wrongMirror(spec) }, 'D03', 'Mirrored across the wrong line'));
      out.push(opt({ kind: 'holes', n: spec.n, holes: [...spec.holes] }, 'D06', 'Only the punched holes, not opened'));
      out.push(opt(shiftHoles(right, spec.n, r) && { kind: 'holes', n: spec.n, holes: shiftHoles(right, spec.n, r)! }, 'D04', 'Holes moved'));
      if (right.length > 1) out.push(opt({ kind: 'holes', n: spec.n, holes: right.slice(1) }, 'D06', 'A hole missing'));
      for (let i = 0; i < 2; i++) {
        const extra: Hole = [r.int(spec.n), r.int(spec.n)];
        out.push(opt({ kind: 'holes', n: spec.n, holes: [...right, extra] }, 'D07', 'An extra hole'));
      }
      break;
    }
  }
  return out;
}

/** The correct option (shown turned or placed so it is not simply the stem again). */
function correctOption(family: Family, s: Source, p: Params, r: Rng): Option | null {
  const stemKey = drawingKey(normalise(s.blocks));
  switch (family) {
    case 'same': {
      const t = randomTurn(s.blocks, r, [stemKey]);
      return t && { item: { kind: 'blocks', blocks: t }, rule: 'correct', note: 'The same object, turned' };
    }
    case 'reconstruct':
      return { item: { kind: 'blocks', blocks: normalise(s.blocks) }, rule: 'correct', note: 'The object' };
    case 'assemble': {
      const parts = split(s.blocks, r);
      if (!parts) return null;
      return { item: { kind: 'pair', a: randomTurn(parts[0], r) ?? parts[0], b: randomTurn(parts[1], r) ?? parts[1] }, rule: 'correct', note: 'These two pieces make the object' };
    }
    case 'f-same':
      return { item: { kind: 'figure', figure: applyOp(s.figure, r.pick(TURNS)) }, rule: 'correct', note: 'The same figure, turned' };
    default: {
      const e = expected(family, s, p);
      return e && { item: e, rule: 'correct', note: 'The answer' };
    }
  }
}

// ----- building, checking -----

/** Problems with the source for this question type (empty when it can be asked). */
export function sourceIssues(family: Family, s: Source, p: Params): string[] {
  const out: string[] = [];
  if (kindOf(family) === 'blocks') {
    if (s.blocks.length < 2) out.push('Build an object of at least two blocks.');
    else if (!connected(s.blocks)) out.push('The object is not in one piece.');
    if (['same', 'turn', 'reconstruct', 'track'].includes(family) && hiddenCount(s.blocks) > 0) out.push('Some blocks are hidden in the drawing; this question needs every block visible.');
    if (family === 'count' && s.blocks.some((c) => c[1] > 0 && !has(s.blocks, [c[0], c[1] - 1, c[2]]))) out.push('A block has nothing under it; counting needs every block resting on another or the floor.');
    if (family === 'count' && p.count === 'hidden' && hiddenCount(s.blocks) === 0) out.push('No block is hidden in this object.');
    if (family === 'track' && (!s.marked || !has(s.blocks, s.marked))) out.push('Mark a block (Build → Mark).');
    if ((family === 'turn' || family === 'track') && !out.length) {
      const e = expected(family, s, p);
      if (e && !drawable(e)) out.push(family === 'track' ? 'After this turn the shaded block or another block is hidden in the drawing; choose another turn.' : 'After this turn a block is hidden in the drawing; choose another turn.');
    }
    if (family === 'section' && (p.layer < 0 || p.layer >= layers(s.blocks, p.axis))) out.push('Choose a layer inside the object.');
    if (family === 'assemble' && s.blocks.length < 4) out.push('Pieces need an object of at least four blocks.');
  } else if (family === 'fold') {
    const why = foldProblem(s.fold);
    if (why) out.push(why);
    if (!s.fold.holes.length) out.push('Punch at least one hole.');
    if (s.fold.holes.some((h) => !canPunch(s.fold, h))) out.push('A hole is outside the folded sheet.');
  } else {
    if (!s.figure.cells.length && !s.figure.marks.length) out.push('Draw a figure first.');
    if (family === 'f-steps' && p.ops.length < 2) out.push('Choose two steps.');
  }
  return out;
}

/** Fills the five options from the correct answer and the pool, in a seeded order. Fewer than five when the object allows no more. */
function fill(family: Family, s: Source, p: Params, r: Rng, keep: Option[] = []): Option[] {
  const opts: Option[] = [...keep];
  const keys = new Set(opts.map((o) => itemKey(family, o.item)));
  const drawn = new Set(opts.map((o) => drawKey(o.item)).filter(Boolean));
  for (const o of pool(family, s, p, r)) {
    if (opts.length >= OPTION_COUNT) break;
    if (!o || isCorrect(family, s, p, o.item) || !drawable(o.item)) continue;
    const k = itemKey(family, o.item);
    const d = drawKey(o.item);
    if (keys.has(k) || (d && drawn.has(d))) continue;
    keys.add(k);
    if (d) drawn.add(d);
    opts.push(o);
  }
  return opts;
}

export function profileOf(family: Family, s: Source, p: Params, options: Option[], prev?: Profile): Profile {
  const blocks = kindOf(family) === 'blocks';
  const size = blocks ? s.blocks.length : family === 'fold' ? s.fold.holes.length : s.figure.cells.length;
  const hidden = blocks ? hiddenCount(s.blocks) : 0;
  const steps = family === 'turn' || family === 'track' ? (p.quarters === 2 ? 2 : 1) : family === 'f-steps' ? 2 : family === 'fold' ? s.fold.folds.length : 1;
  const mirrorD = options.some((o) => o.rule === 'D03');
  const base: Record<Family, number> = { count: 1, view: 2, 'f-turn': 1, 'f-reflect': 2, 'f-same': 2, same: 3, turn: 3, section: 3, 'f-steps': 3, fold: 3, reconstruct: 4, track: 4, assemble: 4 };
  const computed = Math.max(1, Math.min(5, base[family] + (size > 8 ? 1 : 0) + (hidden > 0 && family !== 'count' ? 1 : 0) + (steps > 1 ? 1 : 0)));
  return { size, hidden, steps, mirror: mirrorD, difficulty: prev?.difficultySet ? prev.difficulty : computed, difficultySet: prev?.difficultySet ?? false };
}

export function explain(family: Family, s: Source, p: Params, correct: number): string[] {
  const n = `Option ${correct + 1}`;
  switch (family) {
    case 'same':
      return [`${n} is the object turned; the others are a mirror image or have a block moved, added or missing.`];
    case 'turn':
      return [`Turning the object ${turnText(p.axis, p.quarters)} gives ${n}.`];
    case 'view':
      return [`From the ${p.side}, the covered squares are those of ${n}.`];
    case 'reconstruct':
      return [`${n} has exactly the front, top and right views shown.`];
    case 'count':
      return [`The object has ${s.blocks.length} blocks, ${hiddenCount(s.blocks)} of them hidden in the drawing: ${n}.`];
    case 'section':
      return [`The shaded layer cuts the squares shown in ${n}.`];
    case 'track':
      return [`Turning the object ${turnText(p.axis, p.quarters)} carries the shaded block to where ${n} shows it.`];
    case 'assemble':
      return [`The two pieces of ${n}, turned, fill the object exactly; pieces cannot be mirrored.`];
    case 'f-turn':
    case 'f-reflect':
      return [`The figure ${OP_TEXT[p.ops[0]]} is ${n}.`];
    case 'f-same':
      return [`${n} is the figure turned; mirror images and changed figures are not the same.`];
    case 'f-steps':
      return [`${OP_TEXT[p.ops[0]].replace(/^./, (x) => x.toUpperCase())}, then ${OP_TEXT[p.ops[1] ?? 'fv']}: ${n}.`];
    case 'fold':
      return [`Opening each fold mirrors the holes across its line: ${n}.`];
  }
}

/** A complete candidate question (OBJECTS §67): the author reviews, may change it, and commits. */
export function buildQuestion(family: Family, s: Source, p: Params, seed: number, now = new Date()): Question {
  const r = rng(seed);
  const issues = sourceIssues(family, s, p);
  const correct = issues.length ? null : correctOption(family, s, p, r);
  const options = correct ? r.shuffle(fill(family, s, p, r, [correct])) : [];
  const ci = options.findIndex((o) => o.rule === 'correct');
  return {
    schema: QUESTION_SCHEMA,
    questionId: null,
    version: 0,
    family,
    stem: stemText(family, p),
    source: s,
    params: p,
    options,
    correct: ci,
    seed,
    profile: profileOf(family, s, p, options),
    explanation: ci >= 0 ? explain(family, s, p, ci) : [],
    createdAt: now.toISOString(),
  };
}

/** Re-derives the correct index, profile and explanation after the author changed options. */
export function refresh(q: Question): Question {
  const ci = q.options.findIndex((o) => isCorrect(q.family, q.source, q.params, o.item));
  return { ...q, correct: ci, profile: profileOf(q.family, q.source, q.params, q.options, q.profile), explanation: ci >= 0 ? explain(q.family, q.source, q.params, ci) : [] };
}

/** Replaces one wrong option with another from the pool (OBJECTS §36). */
export function regenerateOption(q: Question, index: number, seed: number): Question {
  if (index === q.correct) return q;
  const keep = q.options.filter((_, i) => i !== index);
  const r = rng(seed);
  const next = fill(q.family, q.source, q.params, r, keep);
  const fresh = next.find((o) => !keep.includes(o));
  if (!fresh) return q;
  const options = [...q.options];
  options[index] = fresh;
  return refresh({ ...q, options });
}

export function moveOption(q: Question, from: number, to: number): Question {
  if (to < 0 || to >= q.options.length) return q;
  const options = [...q.options];
  const [o] = options.splice(from, 1);
  options.splice(to, 0, o);
  return refresh({ ...q, options });
}

export function replaceOption(q: Question, index: number, item: Item): Question {
  const options = [...q.options];
  options[index] = { item, rule: 'author', note: 'Set by the author' };
  return refresh({ ...q, options });
}

export interface Check {
  ready: boolean;
  issues: string[];
}

/** Commit only when everything holds (OBJECTS §64). */
export function validate(q: Question): Check {
  const issues = [...sourceIssues(q.family, q.source, q.params)];
  if (!q.stem.trim()) issues.push('Write the question.');
  if (!issues.length && q.options.length !== OPTION_COUNT) issues.push(`${q.options.length} options; a question needs ${OPTION_COUNT}. Change the object or the settings for more possible answers.`);
  const right = q.options.map((o) => isCorrect(q.family, q.source, q.params, o.item));
  const nRight = right.filter(Boolean).length;
  if (q.options.length && nRight === 0) issues.push('No option is correct.');
  if (nRight > 1) issues.push(`Options ${right.flatMap((x, i) => (x ? [i + 1] : [])).join(' and ')} are both correct.`);
  const keys = q.options.map((o) => itemKey(q.family, o.item));
  const drawn = q.options.map((o) => drawKey(o.item));
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) if (keys[i] === keys[j] || (drawn[i] && drawn[i] === drawn[j])) issues.push(`Options ${i + 1} and ${j + 1} look the same.`);
  q.options.forEach((o, i) => {
    if (!drawable(o.item)) issues.push(`Option ${i + 1} has blocks hidden in its drawing.`);
  });
  return { ready: issues.length === 0, issues };
}
