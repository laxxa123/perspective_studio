// The cube-net grid and the grids' snap points (SKETCH §13). Pure.
//
// Cube net: a 4 × 4 square of cells across the page, centred vertically; the
// six faces of an unfolded cube (a cross: A on top, B C D E across, F below)
// are outlined and lettered, and each face carries a 4 × 4 dot grid. Every
// dot is a soft snap point. On the 3 × 3 grid the snap points sit along the
// lines.
import type { Pt, Segment } from './geometry';
import type { GuideModel } from './types';
import { DOC_H, DOC_W } from './types';

/** Page margin, cell edge and top of the cube net, document px. */
const M = 40;
export const CUBE_CELL = (DOC_W - 2 * M) / 4;
const TOP = (DOC_H - 4 * CUBE_CELL) / 2;
/** The faces: column, row (in the 4 × 4 square) and letter. */
export const CUBE_FACES: readonly [number, number, string][] = [
  [1, 0, 'A'],
  [0, 1, 'B'],
  [1, 1, 'C'],
  [2, 1, 'D'],
  [3, 1, 'E'],
  [1, 2, 'F'],
];
/** Dot steps per face edge. */
const DOTS = 4;

/** The shapes never change: built once. */
const memo: { lines?: Segment[]; outline?: Segment[]; letters?: Segment[]; dots?: Pt[]; thirds?: Pt[] } = {};

const cellAt = (c: number, r: number) => ({ x: M + c * CUBE_CELL, y: TOP + r * CUBE_CELL });

/** The faint 4 × 4 square. */
export function cubeLines(): readonly Segment[] {
  return (memo.lines ??= makeLines());
}
function makeLines(): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i <= 4; i++) {
    const x = M + i * CUBE_CELL;
    const y = TOP + i * CUBE_CELL;
    out.push([x, TOP, x, TOP + 4 * CUBE_CELL], [M, y, M + 4 * CUBE_CELL, y]);
  }
  return out;
}

/** The faces' outlines (each edge once). */
export function cubeOutline(): readonly Segment[] {
  return (memo.outline ??= makeOutline());
}
function makeOutline(): Segment[] {
  const seen = new Map<string, Segment>();
  for (const [c, r] of CUBE_FACES) {
    const { x, y } = cellAt(c, r);
    const s = CUBE_CELL;
    for (const e of [
      [x, y, x + s, y],
      [x + s, y, x + s, y + s],
      [x, y + s, x + s, y + s],
      [x, y, x, y + s],
    ] as Segment[])
      seen.set(e.join(','), e);
  }
  return [...seen.values()];
}

// Stroke letters on a 0.7 × 1 box (the renderer draws lines, not text).
const poly = (...p: number[]): Segment[] => {
  const out: Segment[] = [];
  for (let i = 0; i + 3 < p.length; i += 2) out.push([p[i], p[i + 1], p[i + 2], p[i + 3]]);
  return out;
};
const GLYPHS: Record<string, Segment[]> = {
  A: [...poly(0, 1, 0.35, 0, 0.7, 1), ...poly(0.13, 0.62, 0.57, 0.62)],
  B: [...poly(0, 0, 0, 1), ...poly(0, 0, 0.45, 0, 0.6, 0.12, 0.6, 0.36, 0.45, 0.48, 0, 0.48), ...poly(0.45, 0.48, 0.68, 0.6, 0.68, 0.86, 0.5, 1, 0, 1)],
  C: poly(0.68, 0.15, 0.5, 0, 0.2, 0, 0, 0.2, 0, 0.8, 0.2, 1, 0.5, 1, 0.68, 0.85),
  D: poly(0, 0, 0.4, 0, 0.68, 0.25, 0.68, 0.75, 0.4, 1, 0, 1, 0, 0),
  E: [...poly(0.65, 0, 0, 0, 0, 1, 0.65, 1), ...poly(0, 0.5, 0.5, 0.5)],
  F: [...poly(0.65, 0, 0, 0, 0, 1), ...poly(0, 0.5, 0.5, 0.5)],
};
const LETTER = 34;

/** The faces' letters, top left in each face. */
export function cubeLetters(): readonly Segment[] {
  return (memo.letters ??= makeLetters());
}
function makeLetters(): Segment[] {
  return CUBE_FACES.flatMap(([c, r, l]) => {
    const { x, y } = cellAt(c, r);
    const ox = x + 16;
    const oy = y + 16;
    return GLYPHS[l].map(([x0, y0, x1, y1]) => [ox + x0 * LETTER, oy + y0 * LETTER, ox + x1 * LETTER, oy + y1 * LETTER] as Segment);
  });
}

/** Every dot of the faces (shared edges once). */
export function cubeDots(): readonly Pt[] {
  return (memo.dots ??= makeDots());
}
function makeDots(): Pt[] {
  const seen = new Map<string, Pt>();
  const step = CUBE_CELL / DOTS;
  for (const [c, r] of CUBE_FACES) {
    const o = cellAt(c, r);
    for (let i = 0; i <= DOTS; i++) for (let j = 0; j <= DOTS; j++) seen.set(`${i + c * DOTS},${j + r * DOTS}`, { x: o.x + i * step, y: o.y + j * step });
  }
  return [...seen.values()];
}

/** Snap points along the 3 × 3 lines: sixths across, twelfths down (the crossings included). */
export function thirdsPoints(): readonly Pt[] {
  return (memo.thirds ??= makeThirds());
}
function makeThirds(): Pt[] {
  const out: Pt[] = [];
  for (const x of [DOC_W / 3, (2 * DOC_W) / 3]) for (let k = 0; k <= 12; k++) out.push({ x, y: (DOC_H * k) / 12 });
  for (const y of [DOC_H / 3, (2 * DOC_H) / 3])
    for (let k = 0; k <= 6; k++) if (k !== 2 && k !== 4) out.push({ x: (DOC_W * k) / 6, y });
  return out;
}

/** The grid's snap points (none for the perspective grids). */
export function snapPoints(g: GuideModel): readonly Pt[] {
  if (!g.visible) return [];
  if (g.type === 'cube') return cubeDots();
  if (g.type === 'thirds') return thirdsPoints();
  return [];
}

/** The snap point within `radius` of p, nearest first; null when none is that close. */
export function nearestSnap(points: readonly Pt[], p: Pt, radius: number): Pt | null {
  let best: Pt | null = null;
  let bestD = radius;
  for (const q of points) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}
