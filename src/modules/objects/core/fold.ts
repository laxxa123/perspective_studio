// Fold and punch (OBJECTS §A.4): a square sheet is folded (in half left
// over right, top over bottom, or along the diagonal), holes are punched
// through every layer, and the sheet is opened again. Pure, exact.
import type { Rng } from './random';

/** v: the right half folds over onto the left; h: the bottom half up onto the top; d: the lower-left triangle onto the upper-right (square only). */
export type Fold = 'v' | 'h' | 'd';
export type Hole = readonly [number, number];

export interface FoldSpec {
  /** Sheet size in cells (n × n, even). */
  n: number;
  folds: readonly Fold[];
  /** Holes punched in the folded sheet (cells of the folded region). */
  holes: readonly Hole[];
}

export const FOLD_TEXT: Record<Fold, string> = { v: 'right half onto the left', h: 'bottom half onto the top', d: 'along the diagonal' };

/** The folded region after each fold: its width and height, and whether it is a triangle. */
export function regions(spec: Pick<FoldSpec, 'n' | 'folds'>): { w: number; h: number; tri: boolean }[] {
  const out = [{ w: spec.n, h: spec.n, tri: false }];
  for (const f of spec.folds) {
    const p = out[out.length - 1];
    out.push(f === 'v' ? { ...p, w: p.w / 2 } : f === 'h' ? { ...p, h: p.h / 2 } : { ...p, tri: true });
  }
  return out;
}

/** Why the folds cannot be made (null when they can). */
export function foldProblem(spec: Pick<FoldSpec, 'n' | 'folds'>): string | null {
  let w = spec.n;
  let h = spec.n;
  let tri = false;
  for (const f of spec.folds) {
    if (tri) return 'Nothing can be folded after the diagonal fold.';
    if (f === 'v') {
      if (w % 2) return 'The sheet cannot be folded in half again across.';
      w /= 2;
    } else if (f === 'h') {
      if (h % 2) return 'The sheet cannot be folded in half again down.';
      h /= 2;
    } else {
      if (w !== h) return 'The diagonal fold needs a square.';
      tri = true;
    }
  }
  return null;
}

/** Whether a hole can be punched there in the folded sheet. */
export function canPunch(spec: Pick<FoldSpec, 'n' | 'folds'>, [c, r]: Hole): boolean {
  const last = regions(spec).at(-1)!;
  return c >= 0 && r >= 0 && c < last.w && r < last.h && (!last.tri || c >= r);
}

const sort = (hs: Iterable<Hole>) => [...new Map([...hs].map((h) => [h.join(','), h] as const)).values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);

/** Opens the sheet: every fold, last first, mirrors the holes across its line. */
export function unfold(spec: FoldSpec, skipLast = 0): Hole[] {
  const rs = regions(spec);
  let holes: Hole[] = sort(spec.holes);
  for (let i = spec.folds.length - 1 - skipLast; i >= 0; i--) {
    const f = spec.folds[i];
    const before = rs[i];
    const mirrored = holes.map(([c, r]): Hole => (f === 'v' ? [before.w - 1 - c, r] : f === 'h' ? [c, before.h - 1 - r] : [r, c]));
    holes = sort([...holes, ...mirrored]);
  }
  return holes;
}

/** Mirrors across the wrong line at one step (a common slip). */
export function wrongMirror(spec: FoldSpec): Hole[] {
  const n = spec.n;
  return sort(unfold(spec).map(([c, r]): Hole => [r, n - 1 - c]));
}

export const holesKey = (hs: readonly Hole[]) => sort(hs).map((h) => h.join(',')).join(';');

/** All holes moved by one cell in some direction that stays on the sheet. */
export function shiftHoles(hs: readonly Hole[], n: number, rng: Rng): Hole[] | null {
  for (const [dc, dr] of rng.shuffle([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])) {
    const moved = hs.map(([c, r]): Hole => [c + dc, r + dr]);
    if (moved.every(([c, r]) => c >= 0 && r >= 0 && c < n && r < n)) return sort(moved);
  }
  return null;
}

/** A starter: folded in half twice, one hole near the folded corner. */
export const STARTER_FOLD: FoldSpec = { n: 6, folds: ['v', 'h'], holes: [[2, 2]] };
