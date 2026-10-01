// CubeModel edits: patterns across folds (CUBE §16, §17), the net, stacking.
import { describe, expect, it } from 'vitest';
import { newCubeModel, type ArtworkElement } from './CubeModel';
import { applyPreset, clearFace, elementAt, moveCell, place, removeElement, reorder, rotateCell, updateElement } from './edit';
import { PRESETS, presetCells } from '../geometry/NetShapes';
import { cubeState } from '../geometry/FoldingEngine';
import { continuityKept } from '../geometry/PatternContinuity';
import { validateNet } from '../geometry/NetValidator';

const bar = (x: number, y: number, id = 'bar'): ArtworkElement => ({
  id,
  kind: 'path',
  path: 'M -0.05 -0.5 L 0.05 -0.5 L 0.05 0.5 L -0.05 0.5 Z',
  fill: '#000',
  w: 0.1,
  h: 1,
  opacity: 1,
  transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
});

describe('placing artwork', () => {
  const m0 = newCubeModel({ cells: presetCells(PRESETS[0]) });

  it('keeps an element inside one face as that face’s element', () => {
    const { model, ref } = place(m0, 'C', { ...bar(0.5, 0.5), h: 0.5, path: 'M 0 -0.25 L 0 0.25' });
    expect(ref).toEqual({ face: 'C', id: 'bar' });
    expect(model.faces.C.elements).toHaveLength(1);
    expect(model.patterns).toHaveLength(0);
  });

  it('turns an element that crosses a fold into one surface pattern with face-local fragments', () => {
    // A (top) sits above C in the cross: a bar at A's bottom edge runs into C.
    const { model, ref } = place(m0, 'A', bar(0.3, 0.9));
    expect(ref.pattern).toBe(true);
    expect(model.patterns).toHaveLength(1);
    const p = model.patterns[0];
    expect(p.fragments.map((f) => f.face).sort()).toEqual(['A', 'C']);
    const onC = p.fragments.find((f) => f.face === 'C')!.transform;
    expect(onC.x).toBeCloseTo(0.3, 9);
    expect(onC.y).toBeCloseTo(-0.1, 9);
    // No copies: one source element.
    expect(model.faces.A.elements).toHaveLength(0);
    expect(model.faces.C.elements).toHaveLength(0);
    // The folded cube keeps it continuous; turning C breaks it (D08).
    const s = cubeState(model.net.cells)!;
    expect(continuityKept(model, s, s)).toBe(true);
    const turned = cubeState(rotateCell(model, 'C', 1).net.cells)!;
    expect(continuityKept(model, s, turned)).toBe(false);
  });

  it('moves an element dragged fully onto a neighbour into that face’s frame', () => {
    const { model, ref } = place(m0, 'C', { ...bar(0.5, 0.5), h: 0.3, path: 'M 0 -0.15 L 0 0.15' });
    const moved = updateElement(model, ref, { transform: { x: 1.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 } });
    expect(moved.ref.face).toBe('D');
    expect(elementAt(moved.model, moved.ref)!.transform.x).toBeCloseTo(0.5, 9);
  });

  it('removes, reorders and clears', () => {
    let m = place(m0, 'B', { ...bar(0.3, 0.5, 'a'), h: 0.2 }).model;
    m = place(m, 'B', { ...bar(0.6, 0.5, 'b'), h: 0.2 }).model;
    m = reorder(m, { face: 'B', id: 'a' }, 1);
    expect(m.faces.B.elements.map((e) => e.id)).toEqual(['b', 'a']);
    m = removeElement(m, { face: 'B', id: 'b' });
    expect(m.faces.B.elements.map((e) => e.id)).toEqual(['a']);
    m = place(m, 'A', bar(0.3, 0.9, 'p')).model;
    m = reorder(m, { face: 'A', id: 'p', pattern: true }, -1);
    m = clearFace(m, 'C');
    expect(m.patterns).toHaveLength(0);
  });
});

describe('editing the net', () => {
  it('moves faces, swapping with an occupied cell; rotates; applies presets', () => {
    const m0 = newCubeModel({ cells: presetCells(PRESETS[0]) });
    const swapped = moveCell(m0, 'F', 1, 0);
    expect(swapped.net.cells.find((c) => c.face === 'A')).toMatchObject({ col: 1, row: 2 });
    expect(validateNet(swapped.net.cells).valid).toBe(true);
    const away = moveCell(m0, 'F', 5, 5);
    expect(validateNet(away.net.cells).valid).toBe(false);
    expect(rotateCell(m0, 'B', -1).net.cells.find((c) => c.face === 'B')!.turns).toBe(3);
    const z = applyPreset(m0, 'zigzag');
    expect(validateNet(z.net.cells).valid).toBe(true);
    expect(applyPreset(m0, 'nope')).toBe(m0);
  });
});
