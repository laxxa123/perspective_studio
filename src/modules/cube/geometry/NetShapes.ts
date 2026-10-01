// Net shapes (CUBE §11): all hexominoes, the 11 that fold into a cube, and the
// named presets. Shapes are cell positions only; faces are assigned later.
import { FACE_IDS, type NetCell } from '../model/CubeModel';
import { validateNet } from './NetValidator';

export type Cell = { col: number; row: number };
export type Shape = Cell[];

const normalise = (s: Shape): Shape => {
  const c0 = Math.min(...s.map((c) => c.col));
  const r0 = Math.min(...s.map((c) => c.row));
  return s.map((c) => ({ col: c.col - c0, row: c.row - r0 })).sort((a, b) => a.row - b.row || a.col - b.col);
};
const shapeKey = (s: Shape) => normalise(s).map((c) => `${c.col},${c.row}`).join(';');

/** The 8 rotations / reflections of a shape. */
export function variants(s: Shape): Shape[] {
  const out: Shape[] = [];
  let cur = s;
  for (let i = 0; i < 4; i++) {
    cur = cur.map((c) => ({ col: -c.row, row: c.col }));
    out.push(normalise(cur), normalise(cur.map((c) => ({ col: -c.col, row: c.row }))));
  }
  return out;
}

const canonical = (s: Shape) => variants(s).map(shapeKey).sort()[0];

/** All 35 free hexominoes. */
export const HEXOMINOES: readonly Shape[] = (() => {
  let level = new Map<string, Shape>([['0,0', [{ col: 0, row: 0 }]]]);
  for (let n = 2; n <= 6; n++) {
    const next = new Map<string, Shape>();
    for (const s of level.values()) {
      for (const c of s) {
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = { col: c.col + dc, row: c.row + dr };
          if (s.some((x) => x.col === nc.col && x.row === nc.row)) continue;
          const grown = [...s, nc];
          const k = canonical(grown);
          if (!next.has(k)) next.set(k, normalise(grown));
        }
      }
    }
    level = next;
  }
  return [...level.values()];
})();

const withFaces = (s: Shape): NetCell[] => s.map((c, i) => ({ face: FACE_IDS[i], col: c.col, row: c.row, turns: 0 }));

/** The 11 cube nets (Rule 7). */
export const CUBE_NETS: readonly Shape[] = HEXOMINOES.filter((s) => validateNet(withFaces(s)).valid);
/** Hexominoes that do not fold (for invalid-net distractors, D07). */
export const NON_NETS: readonly Shape[] = HEXOMINOES.filter((s) => !validateNet(withFaces(s)).valid);

export interface Preset {
  id: 'cross' | 'offset' | 'zigzag' | 'strip' | 'custom';
  label: string;
  shape: Shape;
}

/** Named starting layouts (CUBE §11); faces A…F in reading order, A on top as in the spec. */
export const PRESETS: readonly Preset[] = [
  { id: 'cross', label: 'Classic cross', shape: [{ col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 1, row: 2 }] },
  { id: 'offset', label: 'Offset cross', shape: [{ col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 2, row: 2 }] },
  { id: 'zigzag', label: 'Zig-zag', shape: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 2, row: 2 }, { col: 3, row: 2 }] },
  { id: 'strip', label: 'Long strip', shape: [{ col: 0, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 3, row: 2 }] },
];

export const presetCells = (p: Preset): NetCell[] => withFaces(p.shape);

/** Which of the 11 nets a shape is (index into CUBE_NETS), or −1. */
export const netIndex = (s: Shape): number => CUBE_NETS.findIndex((n) => canonical(n) === canonical(s));
