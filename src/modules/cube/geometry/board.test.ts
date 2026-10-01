// The design board (CUBE v1.2): 4 × 4 cells, soft snap points, anchoring drawings.
import { describe, expect, it } from 'vitest';
import { anchorCell, BOARD, boardSize, clampCell, normaliseCells, snapToPoint } from './Board';
import { PRESETS, presetCells, CUBE_NETS } from './NetShapes';
import { overlappingFaces, coveredFaces } from './PatternContinuity';
import { newCubeModel } from '../model/CubeModel';
import { normaliseNet } from '../model/edit';

describe('board', () => {
  it('is 4 × 4 and holds every preset and all nets but the 2 × 5 one', () => {
    for (const p of PRESETS) expect(boardSize(presetCells(p))).toEqual({ cols: BOARD, rows: BOARD });
    const fit = CUBE_NETS.filter((n) => Math.max(...n.map((c) => c.col)) < BOARD && Math.max(...n.map((c) => c.row)) < BOARD);
    expect(fit.length).toBeGreaterThanOrEqual(10);
    expect(boardSize([{ face: 'A', col: 4, row: 1, turns: 0 }])).toEqual({ cols: 5, rows: 4 });
  });
  it('moves a net to the top-left corner and keeps faces on the board', () => {
    const cells = presetCells(PRESETS[0]).map((c) => ({ ...c, col: c.col + 3, row: c.row - 2 }));
    const n = normaliseCells(cells);
    expect(Math.min(...n.map((c) => c.col))).toBe(0);
    expect(Math.min(...n.map((c) => c.row))).toBe(0);
    const already = presetCells(PRESETS[0]);
    expect(normaliseCells(already)).toBe(already);
    const m = newCubeModel({ cells });
    expect(normaliseNet(m).net.cells).toEqual(n);
    const ok = newCubeModel({ cells: already });
    expect(normaliseNet(ok)).toBe(ok);
    expect(clampCell(-1, 7, { cols: 4, rows: 4 })).toEqual({ col: 0, row: 3 });
  });
  it('snaps softly to the quarter points', () => {
    expect(snapToPoint({ x: 0.27, y: 0.49 })).toEqual({ x: 0.25, y: 0.5 });
    expect(snapToPoint({ x: 0.37, y: 0.4 })).toEqual({ x: 0.37, y: 0.4 });
    expect(snapToPoint({ x: 0.98, y: 0.03 })).toEqual({ x: 1, y: 0 });
  });
  it('anchors a drawing to the face under its middle, else the nearest face', () => {
    const cells = presetCells(PRESETS[0]);
    expect(anchorCell(cells, [{ x: 1.2, y: 1.2 }, { x: 1.8, y: 1.6 }]).face).toBe(cells.find((c) => c.col === 1 && c.row === 1)!.face);
    // Bare board at (3.5, 3.5): the nearest face centre is the one at (3, 1).
    expect(anchorCell(cells, [{ x: 3.4, y: 3.4 }, { x: 3.6, y: 3.6 }]).face).toBe(cells.find((c) => c.col === 3 && c.row === 1)!.face);
  });
  it('knows when a drawing lies entirely off the faces', () => {
    const net = { cells: presetCells(PRESETS[0]) };
    const anchor = net.cells.find((c) => c.col === 1 && c.row === 2)!.face;
    const el = { w: 0.2, h: 0.2 };
    expect(overlappingFaces(el, { x: 2.5, y: 1.5, rotation: 0, scaleX: 1, scaleY: 1 }, anchor, net)).toEqual([]);
    expect(coveredFaces(el, { x: 2.5, y: 1.5, rotation: 0, scaleX: 1, scaleY: 1 }, anchor, net)).toEqual([anchor]);
    expect(overlappingFaces(el, { x: 0.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 }, anchor, net)).toEqual([anchor]);
  });
});
