import { describe, expect, it } from 'vitest';
import type { BoxEntity, RectEntity } from '../document/types';
import { deriveCamera, project } from '../perspective/camera';
import { DEFAULT_PERSPECTIVE as ps, setMode } from '../perspective';
import { boxSnapTarget, isHanging, isResting, placementAt } from './boxSnap';
import { bestFitDirection, nearestFamily, onGuide, softSnap } from './strokeSnap';

const cam = deriveCamera(ps);
const base: BoxEntity = { id: 'a', kind: 'box', layerId: 'l', visible: true, locked: false, position: { x: -0.5, y: -0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, uniform: true };

describe('placement (BX-02 revised, BX-08, PL-01)', () => {
  it('rests on a visible top face, else the ground, else nothing', () => {
    const onTop = placementAt([base], cam, project(cam, { x: 0, y: 0, z: 1 })!);
    expect(onTop).toMatchObject({ supportId: 'a', mode: 'rest' });
    expect(onTop!.point.z).toBeCloseTo(1);
    expect(placementAt([base], cam, project(cam, { x: 3, y: 0, z: 0 })!)!.supportId).toBeNull();
    expect(placementAt([base], cam, { x: 600, y: 100 })).toBeNull();
  });

  it('never lands on a top face above the eye (it cannot be seen)', () => {
    const tall: BoxEntity = { ...base, id: 't', size: { x: 1, y: 1, z: 4 } };
    const q = project(cam, { x: 0, y: 0, z: 4 })!;
    const p = placementAt([tall], cam, q);
    expect(p?.supportId === 't' && p.mode === 'rest').toBe(false);
  });

  it('hangs from an underside above the eye (a lamp under a ceiling)', () => {
    const ceiling: RectEntity = { id: 'c', kind: 'rect', layerId: 'l', visible: true, locked: false, plane: 'ground', position: { x: -3, y: -3, z: 2.7 }, size: { x: 6, y: 6 } };
    const q = project(cam, { x: 0, y: 0, z: 2.7 })!;
    const p = placementAt([ceiling], cam, q)!;
    expect(p).toMatchObject({ mode: 'hang', supportId: 'c' });
    expect(p.point.z).toBeCloseTo(2.7);
  });

  it('uses the working plane when nothing is hit', () => {
    const q = { x: 600, y: 100 }; // above the horizon, empty
    const p = placementAt([], cam, q, { workingPlane: 2.4 })!;
    expect(p.mode).toBe('hang');
    expect(p.point.z).toBeCloseTo(2.4);
    expect(placementAt([], cam, q, { workingPlane: cam.C.z })).toBeNull();
  });
});

describe('box snapping (BX-06, BX-08)', () => {
  it('stacks a resting box when moved over another', () => {
    const b: BoxEntity = { ...base, id: 'b', position: { x: 3, y: -0.5, z: 0 } };
    expect(isResting(b, [base])).toBe(true);
    const p = boxSnapTarget(b, [base, b], cam, project(cam, { x: 0, y: 0, z: 1 })!);
    expect(p.z).toBeCloseTo(1);
  });

  it('keeps a hanging box hanging when moved', () => {
    const ceiling: RectEntity = { id: 'c', kind: 'rect', layerId: 'l', visible: true, locked: false, plane: 'ground', position: { x: -5, y: -5, z: 2.7 }, size: { x: 10, y: 10 } };
    const lamp: BoxEntity = { ...base, id: 'lamp', position: { x: 0, y: 0, z: 2.2 }, size: { x: 0.5, y: 0.5, z: 0.5 } };
    expect(isHanging(lamp, [ceiling])).toBe(true);
    const p = boxSnapTarget(lamp, [ceiling, lamp], cam, project(cam, { x: 1, y: 1, z: 2.2 })!);
    expect(p.z).toBeCloseTo(2.2);
  });

  it('snaps flush with a neighbour within tolerance', () => {
    const b: BoxEntity = { ...base, id: 'b', position: { x: 0.55, y: -0.5, z: 0 } };
    const p = boxSnapTarget(b, [base, b], cam, project(cam, { x: 1, y: 0, z: 0 })!);
    expect(p.x).toBeCloseTo(0.5, 9);
  });
});

describe('stroke snapping (SK-04)', () => {
  const start = { x: 600, y: 600 };
  it('picks the family whose guide matches the direction', () => {
    const towardR = { x: ps.vpRightX - start.x, y: ps.horizonY - start.y };
    expect(nearestFamily(ps, start, towardR)).toBe('R');
    expect(nearestFamily(ps, start, { x: 0, y: 1 })).toBe('V');
  });
  it('locks points onto a guide (vertical in 2pt)', () => {
    const p = onGuide(setMode(ps, '2pt'), 'V', start, { x: 650, y: 900 });
    expect(p.x).toBeCloseTo(600);
  });
  it('soft-snaps a nearly straight stroke within 6°, not a wobbly one', () => {
    const toVp = (t: number) => ({ x: start.x + (ps.vpRightX - start.x) * t, y: start.y + (ps.horizonY - start.y) * t });
    const almost = [0, 0.05, 0.1, 0.15].map((t, i) => ({ x: toVp(t).x, y: toVp(t).y + (i % 2 ? 2 : -2) }));
    const snapped = softSnap(ps, almost)!;
    expect(snapped.family).toBe('R');
    const far = [start, { x: 700, y: 650 }, { x: 800, y: 700 }];
    expect(softSnap(ps, far)).toBeNull();
    expect(bestFitDirection([start])).toBeNull();
  });
});
