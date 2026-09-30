// PS-07…PS-10 (ADR-0005): the horizon is the eye level.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dot3, v3 } from '../math/vec';
import { validPerspective } from './arbitraries.test-util';
import { deriveCamera, project } from './camera';
import { DEFAULT_PERSPECTIVE as ps } from './defaults';
import { moveHorizon, originDistance, pinWorldPoint, setEyeHeight, unitLengthAtOrigin, withScaleLock } from './eye';
import { dragHandle } from './handles';
import { isValid } from './validity';

describe('horizon = eye level (PS-08, ADR-0005)', () => {
  it('keeps rotation, focal length and origin distance; changes eye height only', () => {
    fc.assert(
      fc.property(validPerspective, fc.double({ min: -300, max: 300, noNaN: true }), (p, dy) => {
        const moved = moveHorizon(p, p.horizonY + dy);
        if (!isValid(moved)) return;
        const a = deriveCamera(p);
        const b = deriveCamera(moved);
        expect(b.f).toBeCloseTo(a.f, 6);
        for (const k of ['c0', 'c1', 'c2'] as const) expect(dot3(a.M[k], b.M[k])).toBeCloseTo(1, 9);
        expect(originDistance(b)).toBeCloseTo(originDistance(a), 6);
        // The anchor still shows the origin, and the eye-level plane projects onto the new horizon.
        const o = project(b, v3(0, 0, 0))!;
        expect(o.x).toBeCloseTo(moved.anchor.x, 5);
        const eyeLevelPoint = project(b, v3(b.C.x + 50 * (-b.C.x), b.C.y + 50 * (-b.C.y), moved.eyeHeight));
        if (eyeLevelPoint) expect(eyeLevelPoint.y).toBeCloseTo(moved.horizonY, 4);
      }),
      { numRuns: 1000 },
    );
  });

  it('raising the horizon raises the eye; lowering it lowers the eye, clamped above the floor', () => {
    const up = dragHandle(ps, 'horizon', { x: 0, y: ps.horizonY - 100 });
    expect(up.ps.eyeHeight).toBeGreaterThan(ps.eyeHeight);
    const down = dragHandle(ps, 'horizon', { x: 0, y: ps.anchor.y + 500 });
    expect(down.clamped).toBe(true);
    expect(isValid(down.ps)).toBe(true);
    expect(down.ps.eyeHeight).toBeLessThan(ps.eyeHeight);
    expect(down.ps.horizonY).toBeLessThan(ps.anchor.y);
  });

  it('moves VP-V with the horizon in 3pt (PV-2 unaffected)', () => {
    const m = moveHorizon(ps, ps.horizonY + 40);
    expect(m.vpVerticalY! - m.horizonY).toBeCloseTo(ps.vpVerticalY! - ps.horizonY, 9);
  });

  it('keeps the box size roughly steady (no ballooning)', () => {
    const before = unitLengthAtOrigin(ps);
    const after = unitLengthAtOrigin(moveHorizon(ps, ps.horizonY - 60));
    expect(after / before).toBeGreaterThan(0.8);
    expect(after / before).toBeLessThan(1.25);
  });
});

describe('eye height edit (PS-07 revised)', () => {
  it('moves the horizon to reach the requested eye height', () => {
    for (const target of [0.5, 1.2, 2.5, 6]) {
      const r = setEyeHeight(ps, target);
      expect(isValid(r)).toBe(true);
      expect(r.eyeHeight).toBeCloseTo(target, 4);
      expect(originDistance(deriveCamera(r))).toBeCloseTo(originDistance(deriveCamera(ps)), 5);
    }
    expect(setEyeHeight(ps, 3).horizonY).toBeLessThan(ps.horizonY);
  });
});

describe('scale lock and pin (PS-09, PS-10)', () => {
  it('keeps the 1 u reference length while a VP moves', () => {
    const target = unitLengthAtOrigin(ps);
    const moved = dragHandle(ps, 'vpR', { x: 2600, y: ps.horizonY }).ps;
    expect(Math.abs(unitLengthAtOrigin(moved) - target)).toBeGreaterThan(1);
    expect(unitLengthAtOrigin(withScaleLock(moved, target))).toBeCloseTo(target, 3);
  });

  it('keeps a pinned world point on its paper spot', () => {
    const P = v3(2, 1, 0);
    const q = project(deriveCamera(ps), P)!;
    const moved = dragHandle(ps, 'vpL', { x: -1200, y: ps.horizonY }).ps;
    const pinned = pinWorldPoint(moved, P, q);
    const at = project(deriveCamera(pinned), P)!;
    expect(at.x).toBeCloseTo(q.x, 3);
    expect(at.y).toBeCloseTo(q.y, 3);
  });
});

describe('2pt centre of vision (PS-11)', () => {
  it('slides along the horizon between VP-L and VP-R', () => {
    const two = { ...ps, mode: '2pt' as const, vpVerticalY: null };
    const r = dragHandle(two, 'cv', { x: 1400, y: 999 });
    expect(r.ps.verticalX).toBe(1400);
    expect(r.ps.horizonY).toBe(two.horizonY);
    expect(dragHandle(two, 'cv', { x: 5000, y: 0 }).clamped).toBe(true);
  });
});
