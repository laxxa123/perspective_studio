// 2D figures (OBJECTS §A.4): filled cells and small marks on a square grid,
// and the 8 symmetries of the square. Pure.
import type { Rng } from './random';

/** Arrow directions: 0 up, 1 right, 2 down, 3 left. */
export type Dir = 0 | 1 | 2 | 3;
export interface Mark {
  c: number;
  r: number;
  kind: 'dot' | 'arrow';
  dir: Dir;
}
export interface Figure {
  /** Grid size (n × n). */
  n: number;
  cells: readonly (readonly [number, number])[];
  marks: readonly Mark[];
}

export const GRID_SIZES = [6, 8] as const;
export const emptyFigure = (n = 6): Figure => ({ n, cells: [], marks: [] });

/** A starter: an asymmetric shape with an arrow, so turns and mirror images differ. */
export const STARTER_FIGURE: Figure = {
  n: 6,
  cells: [
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 2],
    [1, 3],
    [2, 3],
  ],
  marks: [{ c: 3, r: 1, kind: 'arrow', dir: 1 }],
};

/** Clockwise quarter turns and reflections (in the vertical, horizontal, \\ and / lines through the centre). */
export type Op = 'r90' | 'r180' | 'r270' | 'fv' | 'fh' | 'fd' | 'fa';
export const OPS: readonly Op[] = ['r90', 'r180', 'r270', 'fv', 'fh', 'fd', 'fa'];
export const TURNS: readonly Op[] = ['r90', 'r180', 'r270'];
export const REFLECTIONS: readonly Op[] = ['fv', 'fh', 'fd', 'fa'];

export const OP_TEXT: Record<Op, string> = {
  r90: 'turned 90° clockwise',
  r180: 'turned 180°',
  r270: 'turned 90° anticlockwise',
  fv: 'reflected in the vertical line',
  fh: 'reflected in the horizontal line',
  fd: 'reflected in the diagonal ╲',
  fa: 'reflected in the diagonal ╱',
};

function cellOp(op: Op, n: number, c: number, r: number): [number, number] {
  const m = n - 1;
  switch (op) {
    case 'r90':
      return [m - r, c];
    case 'r180':
      return [m - c, m - r];
    case 'r270':
      return [r, m - c];
    case 'fv':
      return [m - c, r];
    case 'fh':
      return [c, m - r];
    case 'fd':
      return [r, c];
    case 'fa':
      return [m - r, m - c];
  }
}

function dirOp(op: Op, d: Dir): Dir {
  switch (op) {
    case 'r90':
      return ((d + 1) % 4) as Dir;
    case 'r180':
      return ((d + 2) % 4) as Dir;
    case 'r270':
      return ((d + 3) % 4) as Dir;
    case 'fv':
      return d === 1 ? 3 : d === 3 ? 1 : d;
    case 'fh':
      return d === 0 ? 2 : d === 2 ? 0 : d;
    case 'fd':
      return ([3, 2, 1, 0] as Dir[])[d];
    case 'fa':
      return ([1, 0, 3, 2] as Dir[])[d];
  }
}

const sortCells = (cs: readonly (readonly [number, number])[]) => [...cs].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const sortMarks = (ms: Mark[]) => [...ms].sort((a, b) => a.r - b.r || a.c - b.c);

export function applyOp(f: Figure, op: Op): Figure {
  return {
    n: f.n,
    cells: sortCells(f.cells.map(([c, r]) => cellOp(op, f.n, c, r))),
    marks: sortMarks(f.marks.map((m) => {
      const [c, r] = cellOp(op, f.n, m.c, m.r);
      return { ...m, c, r, dir: m.kind === 'arrow' ? dirOp(op, m.dir) : 0 };
    })),
  };
}

export const applyOps = (f: Figure, ops: readonly Op[]) => ops.reduce(applyOp, f);

/** The figure as text, where it stands on the grid. */
export function figureKey(f: Figure): string {
  const cells = sortCells(f.cells).map((c) => c.join(','));
  const marks = sortMarks([...f.marks]).map((m) => `${m.kind[0]}${m.c},${m.r}${m.kind === 'arrow' ? `>${m.dir}` : ''}`);
  return `${f.n}|${[...new Set(cells)].join(';')}|${marks.join(';')}`;
}
export const sameFigure = (a: Figure, b: Figure) => figureKey(a) === figureKey(b);

/** Moved to the top-left corner (for "same shape anywhere"). */
function shifted(f: Figure): Figure {
  const xs = [...f.cells.map((c) => c[0]), ...f.marks.map((m) => m.c)];
  const ys = [...f.cells.map((c) => c[1]), ...f.marks.map((m) => m.r)];
  if (!xs.length) return f;
  const dx = Math.min(...xs);
  const dy = Math.min(...ys);
  return { n: f.n, cells: f.cells.map(([c, r]) => [c - dx, r - dy] as const), marks: f.marks.map((m) => ({ ...m, c: m.c - dx, r: m.r - dy })) };
}

/** The same figure turned (and reflected when `reflect`), wherever it stands. */
export function sameShape(a: Figure, b: Figure, reflect = false): boolean {
  const target = figureKey(shifted(b));
  const ops: (Op | null)[] = [null, ...TURNS, ...(reflect ? REFLECTIONS : [])];
  return ops.some((op) => figureKey(shifted(op ? applyOp(a, op) : a)) === target);
}

/** Toggles a filled cell (marks on it stay). */
export function toggleCell(f: Figure, c: number, r: number): Figure {
  const on = f.cells.some((x) => x[0] === c && x[1] === r);
  return { ...f, cells: on ? f.cells.filter((x) => !(x[0] === c && x[1] === r)) : sortCells([...f.cells, [c, r]]) };
}

/** Places a mark; tapping an arrow again turns it; tapping the same dot removes it. */
export function toggleMark(f: Figure, c: number, r: number, kind: Mark['kind']): Figure {
  const at = f.marks.find((m) => m.c === c && m.r === r);
  const rest = f.marks.filter((m) => m !== at);
  if (at && at.kind === kind) return kind === 'arrow' && at.dir < 3 ? { ...f, marks: sortMarks([...rest, { ...at, dir: (at.dir + 1) as Dir }]) } : { ...f, marks: rest };
  return { ...f, marks: sortMarks([...rest, { c, r, kind, dir: 0 }]) };
}

export const clearAt = (f: Figure, c: number, r: number): Figure => ({
  ...f,
  cells: f.cells.filter((x) => !(x[0] === c && x[1] === r)),
  marks: f.marks.filter((m) => !(m.c === c && m.r === r)),
});

/** A figure with one filled cell moved to a neighbouring empty place. */
export function nudgeFigure(f: Figure, rng: Rng): Figure | null {
  if (!f.cells.length) return null;
  for (let t = 0; t < 30; t++) {
    const [c, r] = rng.pick(f.cells);
    const [dc, dr] = rng.pick([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]);
    const to: [number, number] = [c + dc, r + dr];
    if (to[0] < 0 || to[1] < 0 || to[0] >= f.n || to[1] >= f.n || f.cells.some((x) => x[0] === to[0] && x[1] === to[1])) continue;
    return { ...f, cells: sortCells([...f.cells.filter((x) => !(x[0] === c && x[1] === r)), to]) };
  }
  return null;
}

/** An arrow turned a quarter (a common slip), or null when there is none. */
export function turnArrow(f: Figure, rng: Rng): Figure | null {
  const arrows = f.marks.filter((m) => m.kind === 'arrow');
  if (!arrows.length) return null;
  const a = rng.pick(arrows);
  return { ...f, marks: f.marks.map((m) => (m === a ? { ...m, dir: ((m.dir + (rng.next() < 0.5 ? 1 : 3)) % 4) as Dir } : m)) };
}

/** Reads a saved figure; anything unusable is dropped. */
export function readFigure(raw: unknown): Figure | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const n = o.n === 8 ? 8 : 6;
  const inside = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const cells = (Array.isArray(o.cells) ? o.cells : []).filter((c): c is [number, number] => Array.isArray(c) && inside(c[0]) && inside(c[1])).map(([c, r]) => [c, r] as const);
  const marks = (Array.isArray(o.marks) ? o.marks : []).flatMap((m): Mark[] => {
    const x = m as Record<string, unknown>;
    if (!inside(x.c) || !inside(x.r) || (x.kind !== 'dot' && x.kind !== 'arrow')) return [];
    return [{ c: x.c as number, r: x.r as number, kind: x.kind, dir: ([0, 1, 2, 3].includes(x.dir as number) ? x.dir : 0) as Dir }];
  });
  return { n, cells: sortCells(cells), marks: sortMarks(marks) };
}
