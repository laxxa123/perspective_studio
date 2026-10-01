// Geometry quality gates (CUBE §58): nets, opposites, adjacency, determinism, orientation.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FACE_IDS, newCubeModel, type NetCell, type Turns } from '../model/CubeModel';
import { cross, dot, eq, neg, ROTATIONS, SIDE_NORMAL, CORNERS } from './CubeGeometry';
import { allViews, cubeState, faceOn, foldCells, oppositeOf, sameCube, showsView, unfold, viewOf, type CubeState } from './FoldingEngine';
import { CUBE_NETS, HEXOMINOES, NON_NETS, PRESETS, presetCells } from './NetShapes';
import { validateNet } from './NetValidator';

const cells = (shape: { col: number; row: number }[], turns: Turns[] = []): NetCell[] =>
  shape.map((c, i) => ({ face: FACE_IDS[i], col: c.col, row: c.row, turns: turns[i] ?? 0 }));

describe('cube topology', () => {
  it('has 24 distinct proper rotations, identity first', () => {
    expect(ROTATIONS).toHaveLength(24);
    expect(new Set(ROTATIONS.map((r) => r.flat().join(','))).size).toBe(24);
    expect(ROTATIONS[0].flat()).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (const r of ROTATIONS) expect(eq(cross(r[0], r[1]), r[2])).toBe(true);
  });
  it('has 8 corners of three mutually adjacent sides', () => {
    expect(CORNERS).toHaveLength(8);
    for (const c of CORNERS) for (const a of c) for (const b of c) if (a !== b) expect(dot(SIDE_NORMAL[a], SIDE_NORMAL[b])).toBe(0);
  });
});

describe('nets (Rule 7)', () => {
  it('finds 35 hexominoes, of which exactly 11 fold into a cube', () => {
    expect(HEXOMINOES).toHaveLength(35);
    expect(CUBE_NETS).toHaveLength(11);
    expect(NON_NETS).toHaveLength(24);
  });
  it('accepts every preset', () => {
    for (const p of PRESETS) expect(validateNet(presetCells(p)).valid).toBe(true);
  });
  it('explains invalid nets', () => {
    const cross = presetCells(PRESETS[0]);
    expect(validateNet(cross.slice(0, 5)).issues[0].code).toBe('too_few');
    expect(validateNet([...cross, { ...cross[0], face: 'A', col: 9 }]).issues.map((i) => i.code)).toContain('too_many');
    expect(validateNet(cross.map((c, i) => (i === 5 ? { ...c, col: 7 } : c))).issues[0].code).toBe('disconnected');
    expect(validateNet(cross.map((c, i) => (i === 5 ? { ...c, col: 1, row: 1 } : c))).issues[0].code).toBe('overlap');
    const block = cells([{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }]);
    expect(validateNet(block).issues[0].code).toBe('collision');
    expect(validateNet(cross.map((c, i) => (i === 1 ? { ...c, face: 'A' } : c))).issues[0].code).toBe('duplicate_face');
  });
});

describe('folding (CUBE §22)', () => {
  it('cross: A–F opposite, C–E opposite, B–D opposite; every face has 4 neighbours', () => {
    const s = cubeState(presetCells(PRESETS[0]))!;
    expect(oppositeOf(s, 'A')).toBe('F');
    expect(oppositeOf(s, 'C')).toBe('E');
    expect(oppositeOf(s, 'B')).toBe('D');
    for (const f of FACE_IDS) expect(FACE_IDS.filter((g) => g !== f && dot(s[f].n, s[g].n) === 0)).toHaveLength(4);
  });

  it('is a rigid motion: every face keeps a right-handed frame (no silent mirroring)', () => {
    for (const shape of CUBE_NETS) {
      fc.assert(
        fc.property(fc.array(fc.constantFrom<Turns>(0, 1, 2, 3), { minLength: 6, maxLength: 6 }), (turns) => {
          for (const p of foldCells(cells(shape, turns))) expect(eq(cross(p.x, SIDE_NORMAL[p.side]), p.y)).toBe(true);
        }),
        { numRuns: 30 },
      );
    }
  });

  it('is deterministic and independent of which cell folding starts from (up to rotation)', () => {
    const m = newCubeModel({ cells: [] });
    for (const shape of CUBE_NETS) {
      const c = cells(shape, [0, 1, 2, 3, 0, 1]);
      const a = cubeState(c)!;
      expect(cubeState(c)).toEqual(a);
      const rotatedStart = cubeState([...c.slice(3), ...c.slice(0, 3)])!;
      expect(sameCube(m, a, rotatedStart)).toBe(true);
    }
  });

  it('unfolds a cube onto any of the 11 nets and folds back to the same cube (artwork orientation survives)', () => {
    const m = { ...newCubeModel({ cells: [] }) };
    // Give every face artwork so orientation matters.
    for (const f of FACE_IDS) m.faces[f] = { ...m.faces[f], elements: [{ id: f, kind: 'text', transform: { x: 0.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 }, w: 1, h: 1, opacity: 1, text: f }] };
    const s = cubeState(cells(CUBE_NETS[3], [1, 0, 3, 2, 0, 1]))!;
    for (const shape of CUBE_NETS) {
      for (const r of [ROTATIONS[0], ROTATIONS[7], ROTATIONS[19]]) {
        const net = unfold(s, shape, r)!;
        expect(validateNet(net).valid).toBe(true);
        expect(sameCube(m, s, cubeState(net)!)).toBe(true);
      }
    }
  });

  it('views: 24 per cube, three mutually adjacent faces each, and a turned face is a different cube', () => {
    const m = newCubeModel({ cells: [] });
    for (const f of FACE_IDS) m.faces[f] = { ...m.faces[f], symmetry: 1 };
    const s = cubeState(presetCells(PRESETS[0]))!;
    const views = allViews(s);
    expect(views).toHaveLength(24);
    for (const v of views) {
      const [t, fr, r] = v.map((sl) => sl.face);
      expect(oppositeOf(s, t)).not.toBe(fr);
      expect(oppositeOf(s, t)).not.toBe(r);
      expect(oppositeOf(s, fr)).not.toBe(r);
      expect(showsView(m, s, v)).toBe(true);
    }
    const turned: CubeState = { ...s, A: { ...s.A, x: neg(s.A.x) } };
    expect(sameCube(m, s, turned)).toBe(false);
    expect(viewOf(s)[0].face).toBe(faceOn(s, '+Z'));
  });
});
