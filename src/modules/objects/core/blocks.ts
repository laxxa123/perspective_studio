// Block objects (OBJECTS §A.3): a set of unit cells on an integer grid.
// +X right, +Y up, +Z towards the viewer (right-handed, OBJECTS §13). Pure.

export type Cell = readonly [number, number, number];
export type Blocks = readonly Cell[];
export type Axis = 'x' | 'y' | 'z';

/** The largest object: 6 × 6 × 6 cells, 30 blocks (OBJECTS §A.3). */
export const MAX_EXTENT = 6;
export const MAX_BLOCKS = 30;

export const key = (c: Cell) => `${c[0]},${c[1]},${c[2]}`;
export const has = (b: Blocks, c: Cell) => b.some((d) => d[0] === c[0] && d[1] === c[1] && d[2] === c[2]);

export interface Box {
  min: Cell;
  max: Cell;
}

export function bounds(b: Blocks): Box | null {
  if (!b.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const c of b)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], c[i]);
      max[i] = Math.max(max[i], c[i]);
    }
  return { min: min as unknown as Cell, max: max as unknown as Cell };
}

const NEIGHBOURS: Cell[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export type Refusal = 'occupied' | 'full' | 'too-big' | 'below-floor' | 'detached' | null;

/** Why a block cannot go at `c` (null when it can). The floor is y = 0; a new block touches the object face to face (OBJECTS §A.3). */
export function cannotAdd(b: Blocks, c: Cell): Refusal {
  if (c[1] < 0) return 'below-floor';
  if (has(b, c)) return 'occupied';
  if (b.length && !NEIGHBOURS.some((n) => has(b, [c[0] + n[0], c[1] + n[1], c[2] + n[2]]))) return 'detached';
  if (b.length >= MAX_BLOCKS) return 'full';
  const box = bounds([...b, c])!;
  for (let i = 0; i < 3; i++) if (box.max[i] - box.min[i] + 1 > MAX_EXTENT) return 'too-big';
  return null;
}

export const add = (b: Blocks, c: Cell): Blocks => (cannotAdd(b, c) ? b : [...b, c]);
export const remove = (b: Blocks, c: Cell): Blocks => b.filter((d) => !(d[0] === c[0] && d[1] === c[1] && d[2] === c[2]));


/** True when every block touches the others face to face (one piece). */
export function connected(b: Blocks): boolean {
  if (b.length < 2) return true;
  const all = new Set(b.map(key));
  const seen = new Set<string>([key(b[0])]);
  const queue: Cell[] = [b[0]];
  while (queue.length) {
    const c = queue.pop()!;
    for (const n of NEIGHBOURS) {
      const d: Cell = [c[0] + n[0], c[1] + n[1], c[2] + n[2]];
      const k = key(d);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(d);
      }
    }
  }
  return seen.size === all.size;
}

/** Quarter turn about an axis (right-hand rule, positive = anticlockwise looking from +axis). */
export function turn(c: Cell, axis: Axis): Cell {
  const [x, y, z] = c;
  // 0 − v, not −v: no −0 in cells.
  if (axis === 'x') return [x, 0 - z, y];
  if (axis === 'y') return [z, y, 0 - x];
  return [0 - y, x, z];
}

/** Turns the whole object a quarter about an axis and sets it back on the floor, centred where it was. */
export function turnAll(b: Blocks, axis: Axis): Blocks {
  return turnAllWith(b, [], axis).blocks;
}

/** The same turn for the object and its holes (a hole's axis turns with it). */
export function turnAllWith(b: Blocks, holes: readonly Hole[], axis: Axis): { blocks: Blocks; holes: Hole[] } {
  if (!b.length) return { blocks: b, holes: [...holes] };
  const before = bounds(b)!;
  const t = b.map((c) => turn(c, axis));
  const after = bounds(t)!;
  // Keep the footprint's centre (rounded to cells) and stand on y = 0.
  const cx = Math.floor((before.min[0] + before.max[0]) / 2) - Math.floor((after.min[0] + after.max[0]) / 2);
  const cz = Math.floor((before.min[2] + before.max[2]) / 2) - Math.floor((after.min[2] + after.max[2]) / 2);
  const place = (c: Cell): Cell => [c[0] + cx, c[1] - after.min[1], c[2] + cz];
  const unit: Record<Axis, Cell> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  return { blocks: t.map(place), holes: holes.map((h) => ({ c: place(turn(h.c, axis)), axis: axisOf(turn(unit[h.axis], axis)) })) };
}

// ----- holes (OBJECTS §A.14) -----

/** A round hole through a block, along an axis. */
export interface Hole {
  c: Cell;
  axis: Axis;
}
export const holeKey = (h: Hole) => `${key(h.c)}:${h.axis}`;
/** The axis a face normal (or any axis-aligned vector) points along. */
export const axisOf = (n: Cell): Axis => (n[0] ? 'x' : n[1] ? 'y' : 'z');
const AX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

/**
 * The Hole tool: a tap on a face drills straight through every block in the
 * line perpendicular to that face; a tap on a face whose line is drilled
 * fills it again. Blocks added later are not drilled.
 */
export function drill(b: Blocks, holes: readonly Hole[], c: Cell, normal: Cell): Hole[] {
  const axis = axisOf(normal);
  const i = AX[axis];
  const line = b.filter((d) => [0, 1, 2].every((k) => k === i || d[k] === c[k]));
  const drilled = (d: Cell) => holes.some((h) => h.axis === axis && key(h.c) === key(d));
  if (drilled(c)) return holes.filter((h) => !(h.axis === axis && line.some((d) => key(d) === key(h.c))));
  return [...holes, ...line.filter((d) => !drilled(d)).map((d) => ({ c: d, axis }))];
}

/** Holes of blocks that still exist (a removed block takes its holes with it). */
export const keepHoles = (b: Blocks, holes: readonly Hole[]): Hole[] => holes.filter((h) => has(b, h.c));

/** Reads saved holes; anything unusable is dropped. */
export function readHoles(raw: unknown): Hole[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h): Hole[] => {
    const o = h as Record<string, unknown>;
    const c = o?.c;
    if (!Array.isArray(c) || c.length !== 3 || !c.every((v) => Number.isInteger(v)) || !['x', 'y', 'z'].includes(o.axis as string)) return [];
    return [{ c: [c[0], c[1], c[2]] as Cell, axis: o.axis as Axis }];
  });
}

/** A starter object: every block visible in the drawing, so every question type can use it. */
export const STARTER: Blocks = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 2],
  [1, 0, 2],
  [2, 0, 2],
  [2, 1, 2],
  [0, 1, 0],
];

/** Reads a saved block list; anything unusable is dropped. */
export function readBlocks(raw: unknown): Blocks | null {
  if (!Array.isArray(raw)) return null;
  const out: Cell[] = [];
  for (const c of raw as unknown[]) {
    if (!Array.isArray(c) || c.length !== 3 || !c.every((v) => Number.isInteger(v))) continue;
    const cell: Cell = [c[0] as number, c[1] as number, c[2] as number];
    if (!has(out, cell)) out.push(cell);
  }
  return out.slice(0, MAX_BLOCKS);
}
