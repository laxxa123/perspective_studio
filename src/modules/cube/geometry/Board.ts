// The design board (CUBE §10, §18; v1.2): the net sits on a fixed 4 × 4 grid
// of cells; artwork may be drawn anywhere on it and is trimmed to the faces.
// Soft snap points inside each face give placements and sizes that repeat.
import type { NetCell } from '../model/CubeModel';

/** Cells per side of the board (all cube nets but the 2 × 5 one fit). */
export const BOARD = 4;

type P = { x: number; y: number };

/** The board's size in cells: 4 × 4, or larger when a net does not fit. */
export function boardSize(cells: readonly NetCell[]): { cols: number; rows: number } {
  return {
    cols: Math.max(BOARD, ...cells.map((c) => c.col + 1)),
    rows: Math.max(BOARD, ...cells.map((c) => c.row + 1)),
  };
}

/** Moves a net so its top-left cell is at (0, 0); the same array when it already is. */
export function normaliseCells(cells: NetCell[]): NetCell[] {
  const c0 = Math.min(...cells.map((c) => c.col));
  const r0 = Math.min(...cells.map((c) => c.row));
  if (c0 === 0 && r0 === 0) return cells;
  return cells.map((c) => ({ ...c, col: c.col - c0, row: c.row - r0 }));
}

/** Keeps a cell on the board. */
export const clampCell = (col: number, row: number, size: { cols: number; rows: number }) => ({
  col: Math.max(0, Math.min(size.cols - 1, col)),
  row: Math.max(0, Math.min(size.rows - 1, row)),
});

/** Snap points inside a face, in face units: edges, quarters, centre (5 × 5). */
export const SNAP_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
/** How close (face units) a point must come to be pulled onto a snap point. */
export const SNAP_RADIUS = 0.07;

/** Pulls a face-local point onto the nearest snap point when it is close (soft snap). */
export function snapToPoint(p: P, radius = SNAP_RADIUS): P {
  const nearest = (v: number) => SNAP_STEPS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const s = { x: nearest(p.x), y: nearest(p.y) };
  return Math.hypot(s.x - p.x, s.y - p.y) <= radius ? s : p;
}

/**
 * The face a drawing made on the board belongs to: the face under the centre
 * of its bounds, else the face whose centre is nearest.
 */
export function anchorCell(cells: readonly NetCell[], pts: readonly P[]): NetCell {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const under = cells.find((k) => c.x >= k.col && c.x < k.col + 1 && c.y >= k.row && c.y < k.row + 1);
  if (under) return under;
  return cells.reduce((a, b) => (Math.hypot(b.col + 0.5 - c.x, b.row + 0.5 - c.y) < Math.hypot(a.col + 0.5 - c.x, a.row + 0.5 - c.y) ? b : a));
}
