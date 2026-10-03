// Exact 3D operations on block objects (OBJECTS §A.3): the 24 rotations of
// the cube (48 with mirror images), canonical forms, standard views,
// cross-sections and small changes used for distractors. Pure.
import { bounds, connected, has, key, MAX_EXTENT, type Axis, type Blocks, type Cell } from './blocks';
import type { Rng } from './random';

/** A 3 × 3 integer matrix, row-major. */
export type Mat = readonly [number, number, number, number, number, number, number, number, number];

const I: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const TURN: Record<Axis, Mat> = {
  x: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  y: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  z: [0, -1, 0, 1, 0, 0, 0, 0, 1],
};
const MIRROR_X: Mat = [-1, 0, 0, 0, 1, 0, 0, 0, 1];

const mul = (a: Mat, b: Mat): Mat => {
  const o: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
  return o as unknown as Mat;
};
// No −0 in cells: 0 − v.
const z0 = (v: number) => (v === 0 ? 0 : v);
export const apply = (m: Mat, c: Cell): Cell => [z0(m[0] * c[0] + m[1] * c[1] + m[2] * c[2]), z0(m[3] * c[0] + m[4] * c[1] + m[5] * c[2]), z0(m[6] * c[0] + m[7] * c[1] + m[8] * c[2])];

/** The 24 rotations of the cube (identity first). */
export const ROTATIONS: readonly Mat[] = (() => {
  const out: Mat[] = [I];
  const seen = new Set([I.join()]);
  for (let i = 0; i < out.length; i++)
    for (const t of Object.values(TURN)) {
      const m = mul(t, out[i]);
      if (!seen.has(m.join())) {
        seen.add(m.join());
        out.push(m);
      }
    }
  return out;
})();

/** The 24 rotations followed by the 24 mirror images. */
export const SYMMETRIES: readonly Mat[] = [...ROTATIONS, ...ROTATIONS.map((r) => mul(r, MIRROR_X))];

export const transform = (b: Blocks, m: Mat): Blocks => b.map((c) => apply(m, c));

/** Moved so the smallest x, y, z are 0, cells sorted: the object independent of where it stands. */
export function normalise(b: Blocks): Blocks {
  const box = bounds(b);
  if (!box) return [];
  return b.map((c): Cell => [c[0] - box.min[0], c[1] - box.min[1], c[2] - box.min[2]]).sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
}

export const encode = (b: Blocks) => normalise(b).map(key).join(';');

/** The same object regardless of orientation (and of handedness when `mirror`). */
export function canonical(b: Blocks, mirror = false): string {
  let best = '';
  for (const m of mirror ? SYMMETRIES : ROTATIONS) {
    const e = encode(transform(b, m));
    if (!best || e < best) best = e;
  }
  return best;
}

/** Same object, turned (never mirrored unless allowed). */
export const sameObject = (a: Blocks, b: Blocks, mirror = false) => a.length === b.length && canonical(a, mirror) === canonical(b, mirror);
/** Same cells in the same orientation (position ignored). */
export const sameCells = (a: Blocks, b: Blocks) => a.length === b.length && encode(a) === encode(b);
/** A mirror image that cannot be turned into the original. */
export const isChiral = (b: Blocks) => canonical(b) !== canonical(transform(b, MIRROR_X));

export const mirror = (b: Blocks): Blocks => normalise(transform(b, MIRROR_X));

/** The matrix of `quarters` quarter turns about an axis (right-hand rule). */
export function turnMatrix(axis: Axis, quarters: number): Mat {
  let m = I;
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) m = mul(TURN[axis], m);
  return m;
}

/** Quarter turns about an axis (1–3; right-hand rule), set back at the origin. */
export const turnBy = (b: Blocks, axis: Axis, quarters: number): Blocks => normalise(transform(b, turnMatrix(axis, quarters)));

// ----- views and sections (OBJECTS §A.3, §A.5) -----

export type Side = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';
export const SIDES: readonly Side[] = ['front', 'top', 'right', 'back', 'bottom', 'left'];

/** A 2D grid of filled cells: column, row (row 0 at the top). */
export interface Grid {
  w: number;
  h: number;
  cells: readonly (readonly [number, number])[];
}

/** Where a cell lands in the view from a side (the viewer's right and down). */
function project(c: Cell, side: Side, W: number, H: number, D: number): [number, number] {
  const [x, y, z] = c;
  switch (side) {
    case 'front':
      return [x, H - 1 - y];
    case 'back':
      return [W - 1 - x, H - 1 - y];
    case 'right':
      return [D - 1 - z, H - 1 - y];
    case 'left':
      return [z, H - 1 - y];
    case 'top':
      return [x, z];
    case 'bottom':
      return [W - 1 - x, z];
  }
}

const viewSize = (side: Side, W: number, H: number, D: number): [number, number] =>
  side === 'front' || side === 'back' ? [W, H] : side === 'left' || side === 'right' ? [D, H] : [W, D];

function gridOf(cells: Iterable<readonly [number, number]>, w: number, h: number): Grid {
  const seen = new Map<string, [number, number]>();
  for (const [c, r] of cells) seen.set(`${c},${r}`, [c, r]);
  return { w, h, cells: [...seen.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]) };
}

/** The view of the object from a side: which squares are covered. */
export function view(b: Blocks, side: Side): Grid {
  const n = normalise(b);
  const box = bounds(n);
  if (!box) return { w: 0, h: 0, cells: [] };
  const [W, H, D] = [box.max[0] + 1, box.max[1] + 1, box.max[2] + 1];
  const [w, h] = viewSize(side, W, H, D);
  return gridOf(
    n.map((c) => project(c, side, W, H, D)),
    w,
    h,
  );
}

/** The cells cut by a plane across `axis` through layer `k` (0 = lowest / leftmost / farthest), seen as from the front (z), right (x) or top (y). */
export function section(b: Blocks, axis: Axis, k: number): Grid {
  const n = normalise(b);
  const box = bounds(n);
  if (!box) return { w: 0, h: 0, cells: [] };
  const [W, H, D] = [box.max[0] + 1, box.max[1] + 1, box.max[2] + 1];
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const side: Side = axis === 'x' ? 'right' : axis === 'y' ? 'top' : 'front';
  const [w, h] = viewSize(side, W, H, D);
  return gridOf(
    n.filter((c) => c[i] === k).map((c) => project(c, side, W, H, D)),
    w,
    h,
  );
}

export const layers = (b: Blocks, axis: Axis) => {
  const box = bounds(normalise(b));
  return box ? box.max[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] + 1 : 0;
};

export const gridKey = (g: Grid) => `${g.w}x${g.h}:${g.cells.map((c) => c.join(',')).join(';')}`;
export const sameGrid = (a: Grid, b: Grid) => gridKey(a) === gridKey(b);
export const mirrorGrid = (g: Grid): Grid => gridOf(g.cells.map(([c, r]) => [g.w - 1 - c, r] as [number, number]), g.w, g.h);
/** Quarter turn clockwise. */
export const turnGrid = (g: Grid): Grid => gridOf(g.cells.map(([c, r]) => [g.h - 1 - r, c] as [number, number]), g.h, g.w);

// ----- small changes (distractors, OBJECTS §A.5) -----

const NB: Cell[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Empty cells touching the object (not below the floor, within the size limit). */
export function frontier(b: Blocks): Cell[] {
  const out = new Map<string, Cell>();
  for (const c of b)
    for (const n of NB) {
      const d: Cell = [c[0] + n[0], c[1] + n[1], c[2] + n[2]];
      if (d[1] < 0 || has(b, d)) continue;
      const box = bounds([...b, d])!;
      if ([0, 1, 2].some((i) => box.max[i] - box.min[i] + 1 > MAX_EXTENT)) continue;
      out.set(key(d), d);
    }
  return [...out.values()];
}

/** One block moved to another place; the object stays in one piece. */
export function moveOne(b: Blocks, r: Rng): Blocks | null {
  for (let tries = 0; tries < 40; tries++) {
    const i = r.int(b.length);
    const rest = b.filter((_, j) => j !== i);
    if (!connected(rest)) continue;
    const spots = frontier(rest).filter((d) => !(d[0] === b[i][0] && d[1] === b[i][1] && d[2] === b[i][2]));
    if (!spots.length) continue;
    return [...rest, r.pick(spots)];
  }
  return null;
}

/** One block added where it touches the object. */
export function addOne(b: Blocks, r: Rng): Blocks | null {
  const spots = frontier(b);
  return spots.length && b.length < 30 ? [...b, r.pick(spots)] : null;
}

/** One block taken away; the object stays in one piece. */
export function removeOne(b: Blocks, r: Rng): Blocks | null {
  if (b.length < 3) return null;
  for (const i of r.shuffle(b.map((_, j) => j))) {
    const rest = b.filter((_, j) => j !== i);
    if (connected(rest)) return rest;
  }
  return null;
}

/** Splits an object into two pieces, each in one piece with at least two blocks. */
export function split(b: Blocks, r: Rng): [Blocks, Blocks] | null {
  if (b.length < 4) return null;
  for (let tries = 0; tries < 60; tries++) {
    const size = 2 + r.int(b.length - 3);
    const start = r.pick(b);
    const piece: Cell[] = [start];
    while (piece.length < size) {
      const grow = frontier(piece).filter((d) => has(b, d) && !has(piece, d));
      if (!grow.length) break;
      piece.push(r.pick(grow));
    }
    if (piece.length !== size) continue;
    const rest = b.filter((c) => !has(piece, c));
    if (rest.length >= 2 && connected(rest)) return [normalise(piece), normalise(rest)];
  }
  return null;
}

/** Whether two pieces (turned as needed, never mirrored) fill the object exactly. */
export function assembles(obj: Blocks, a: Blocks, b: Blocks): boolean {
  if (a.length + b.length !== obj.length) return false;
  const target = normalise(obj);
  const box = bounds(target)!;
  const want = canonical(b);
  // Cheap filter before the canonical form: the remainder's box must have b's dimensions (in some order).
  const dims = (x: Blocks) => {
    const bx = bounds(x)!;
    return [0, 1, 2].map((i) => bx.max[i] - bx.min[i]).sort().join();
  };
  const wantDims = dims(b);
  const tried = new Set<string>();
  for (const m of ROTATIONS) {
    const ra = normalise(transform(a, m));
    const k = encode(ra);
    if (tried.has(k)) continue;
    tried.add(k);
    const rb = bounds(ra)!;
    for (let dx = 0; dx + rb.max[0] <= box.max[0]; dx++)
      for (let dy = 0; dy + rb.max[1] <= box.max[1]; dy++)
        for (let dz = 0; dz + rb.max[2] <= box.max[2]; dz++) {
          const placed = ra.map((c): Cell => [c[0] + dx, c[1] + dy, c[2] + dz]);
          if (!placed.every((c) => has(target, c))) continue;
          const rest = target.filter((c) => !has(placed, c));
          if (dims(rest) === wantDims && canonical(rest) === want) return true;
        }
  }
  return false;
}
