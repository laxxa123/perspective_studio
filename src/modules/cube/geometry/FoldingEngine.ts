// Folding (CUBE §22): net cells → cube sides and face orientations, the cube
// state, its 24 views, and unfolding a cube onto any net shape.
//
// The net lies on z = 0 with the first cell as the bottom face; each step over
// a shared edge folds the neighbour up by 90°. A frame is (P, U, V, N): the
// cell's top-left corner P, its +col axis U, +row axis V and outward normal N.
import type { CubeModel, FaceId, NetCell, Turns } from '../model/CubeModel';
import { FACE_IDS, mirrorVisible, symmetryOf } from '../model/CubeModel';
import { add, apply, eq, neg, ROTATIONS, sideOf, SIDE_NORMAL, type Rot, type Side, type V3 } from './CubeGeometry';

interface Frame {
  P: V3;
  U: V3;
  V: V3;
  N: V3;
}

/** Where one net cell ends up on the folded cube. */
export interface Placement {
  cell: NetCell;
  side: Side;
  /** The face's own x and y axes (CUBE §15) in 3D. */
  x: V3;
  y: V3;
  /** The cell's frame (col / row axes). */
  U: V3;
  V: V3;
}

const key = (c: { col: number; row: number }) => `${c.col},${c.row}`;

const NEIGHBOURS: { dc: number; dr: number; step: (f: Frame) => Frame }[] = [
  { dc: 1, dr: 0, step: (f) => ({ P: add(f.P, f.U), U: neg(f.N), V: f.V, N: f.U }) },
  { dc: -1, dr: 0, step: (f) => ({ P: add(f.P, neg(f.N)), U: f.N, V: f.V, N: neg(f.U) }) },
  { dc: 0, dr: 1, step: (f) => ({ P: add(f.P, f.V), U: f.U, V: neg(f.N), N: f.V }) },
  { dc: 0, dr: -1, step: (f) => ({ P: add(f.P, neg(f.N)), U: f.U, V: f.N, N: neg(f.V) }) },
];

/** The face's x / y axes from its cell frame and clockwise turns (Rule 6). */
export function faceAxes(U: V3, V: V3, turns: Turns): { x: V3; y: V3 } {
  switch (turns) {
    case 0:
      return { x: U, y: V };
    case 1:
      return { x: V, y: neg(U) };
    case 2:
      return { x: neg(U), y: neg(V) };
    case 3:
      return { x: neg(V), y: U };
  }
}

/**
 * Folds connected cells (breadth-first from the first cell). Returns one
 * placement per reached cell, in cell order; unreachable cells are omitted.
 */
export function foldCells(cells: readonly NetCell[]): Placement[] {
  if (!cells.length) return [];
  const byKey = new Map(cells.map((c) => [key(c), c]));
  const frames = new Map<NetCell, Frame>();
  const start = cells[0];
  frames.set(start, { P: [0, 0, 0], U: [1, 0, 0], V: [0, 1, 0], N: [0, 0, -1] });
  const queue = [start];
  while (queue.length) {
    const c = queue.shift()!;
    const f = frames.get(c)!;
    for (const n of NEIGHBOURS) {
      const nb = byKey.get(key({ col: c.col + n.dc, row: c.row + n.dr }));
      if (!nb || frames.has(nb)) continue;
      frames.set(nb, n.step(f));
      queue.push(nb);
    }
  }
  return cells
    .filter((c) => frames.has(c))
    .map((c) => {
      const f = frames.get(c)!;
      return { cell: c, side: sideOf(f.N), U: f.U, V: f.V, ...faceAxes(f.U, f.V, c.turns) };
    });
}

/** The folded cube: per face, its outward normal, its x axis, mirrored or not. */
export type CubeState = Record<FaceId, { n: V3; x: V3; mirrored: boolean }>;

/** The state of a valid net (six placements on six distinct sides); null otherwise. */
export function cubeState(cells: readonly NetCell[]): CubeState | null {
  const ps = foldCells(cells);
  if (ps.length !== 6 || new Set(ps.map((p) => p.side)).size !== 6 || new Set(ps.map((p) => p.cell.face)).size !== 6) return null;
  const out = {} as CubeState;
  for (const p of ps) out[p.cell.face] = { n: SIDE_NORMAL[p.side], x: p.x, mirrored: !!p.cell.mirrored };
  return out;
}

export const rotateState = (s: CubeState, r: Rot): CubeState =>
  Object.fromEntries(FACE_IDS.map((f) => [f, { n: apply(r, s[f].n), x: apply(r, s[f].x), mirrored: s[f].mirrored }])) as CubeState;

/** Which face lies on a side. */
export const faceOn = (s: CubeState, side: Side): FaceId => FACE_IDS.find((f) => eq(s[f].n, SIDE_NORMAL[side]))!;

export const oppositeOf = (s: CubeState, f: FaceId): FaceId => FACE_IDS.find((g) => eq(s[g].n, neg(s[f].n)))!;

// ----- views (CUBE §20, §23) -----

/** One visible face of a cube figure: which face, its clockwise turns on screen, mirrored. */
export interface Slot {
  face: FaceId;
  turns: Turns;
  mirrored: boolean;
}

/** A corner view: the top, front and right faces as a viewer above-front-right sees them. */
export type CubeView = [Slot, Slot, Slot];

/** Screen slots: side, and the 3D directions of a face's x / y when it is unturned. */
export const VIEW_SLOTS: { name: 'top' | 'front' | 'right'; side: Side; refX: V3; refY: V3; origin: V3 }[] = [
  { name: 'top', side: '+Z', refX: [1, 0, 0], refY: [0, -1, 0], origin: [0, 1, 1] },
  { name: 'front', side: '-Y', refX: [1, 0, 0], refY: [0, 0, -1], origin: [0, 0, 1] },
  { name: 'right', side: '+X', refX: [0, 1, 0], refY: [0, 0, -1], origin: [1, 0, 1] },
];

function turnsFrom(x: V3, refX: V3, refY: V3): Turns {
  if (eq(x, refX)) return 0;
  if (eq(x, refY)) return 1;
  if (eq(x, neg(refX))) return 2;
  if (eq(x, neg(refY))) return 3;
  throw new Error('face axis not in the slot plane');
}

/** The view of the cube after rotation `r`. */
export function viewOf(s: CubeState, r: Rot = ROTATIONS[0]): CubeView {
  const t = rotateState(s, r);
  return VIEW_SLOTS.map((slot) => {
    const f = faceOn(t, slot.side);
    return { face: f, turns: turnsFrom(t[f].x, slot.refX, slot.refY), mirrored: t[f].mirrored };
  }) as CubeView;
}

/** All 24 views of a cube. */
export const allViews = (s: CubeState): CubeView[] => ROTATIONS.map((r) => viewOf(s, r));

/** A view written so that looks-the-same views compare equal (face symmetry, invisible mirroring). */
export function viewKey(m: CubeModel, v: CubeView): string {
  return v.map((sl) => `${sl.face}${sl.turns % (4 / symmetryOf(m, sl.face))}${sl.mirrored && mirrorVisible(m, sl.face) ? 'm' : ''}`).join('|');
}

/** Whether a cube shows view `v` from some direction (CUBE §31: consistency). */
export function showsView(m: CubeModel, s: CubeState, v: CubeView): boolean {
  const k = viewKey(m, v);
  return allViews(s).some((w) => viewKey(m, w) === k);
}

/** Two cubes look the same from every direction (identical up to rotation). */
export function sameCube(m: CubeModel, a: CubeState, b: CubeState): boolean {
  const keys = new Set(allViews(b).map((v) => viewKey(m, v)));
  return allViews(a).every((v) => keys.has(viewKey(m, v)));
}

// ----- unfolding -----

/**
 * Unfolds a cube onto a net shape (cells of any valid net, faces ignored):
 * the cube is turned by `r`, then each cell takes the face lying on its side,
 * with the turns that keep the artwork's physical orientation.
 */
export function unfold(s: CubeState, shape: readonly { col: number; row: number }[], r: Rot = ROTATIONS[0]): NetCell[] | null {
  const probe = shape.map((c, i) => ({ face: FACE_IDS[i], col: c.col, row: c.row, turns: 0 as Turns }));
  const ps = foldCells(probe);
  if (ps.length !== 6 || new Set(ps.map((p) => p.side)).size !== 6) return null;
  const t = rotateState(s, r);
  return ps.map((p) => {
    const f = faceOn(t, p.side);
    const x = t[f].x;
    const turns: Turns = eq(x, p.U) ? 0 : eq(x, p.V) ? 1 : eq(x, neg(p.U)) ? 2 : 3;
    return { face: f, col: p.cell.col, row: p.cell.row, turns, ...(t[f].mirrored ? { mirrored: true } : {}) };
  });
}
