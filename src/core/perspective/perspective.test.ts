import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { v3 } from '../math/vec';
import { validPerspective } from './arbitraries.test-util';
import { deriveCamera, project, projectSegment, unproject, vanishingPoint } from './camera';
import { DEFAULT_PERSPECTIVE } from './defaults';
import { setHorizon, setMode } from './edit';
import type { PerspectiveSystem } from './types';
import { clampPerspective, isValid, violations } from './validity';

const ps = DEFAULT_PERSPECTIVE;

describe('validity (§6.3)', () => {
  it('accepts the default system', () => expect(violations(ps)).toEqual([]));

  it('names each violated constraint', () => {
    expect(violations({ ...ps, verticalX: -800 })).toContain('PV-1');
    expect(violations({ ...ps, vpVerticalY: 300 })).toContain('PV-2');
    expect(violations({ ...ps, vpLeftX: 590, vpRightX: 610 })).toContain('PV-3');
    expect(violations({ ...ps, anchor: { x: 600, y: 100 } })).toContain('PV-4');
    expect(violations({ ...ps, eyeHeight: 0 })).toContain('PV-5');
    expect(violations({ ...ps, horizonY: NaN })).toEqual(['NaN']);
    expect(violations({ ...ps, mode: '2pt' })).toContain('PV-2'); // 2pt must have vpVerticalY = null
  });

  it('clamps any finite system to a valid one, and leaves valid ones unchanged', () => {
    const anySystem = fc.record({
      mode: fc.constantFrom('3pt' as const, '2pt' as const),
      horizonY: fc.double({ min: -3000, max: 3000, noNaN: true }),
      vpLeftX: fc.double({ min: -5000, max: 5000, noNaN: true }),
      vpRightX: fc.double({ min: -5000, max: 5000, noNaN: true }),
      verticalX: fc.double({ min: -6000, max: 6000, noNaN: true }),
      vpVerticalY: fc.option(fc.double({ min: -6000, max: 6000, noNaN: true })),
      anchor: fc.record({ x: fc.double({ min: -5000, max: 5000, noNaN: true }), y: fc.double({ min: -5000, max: 5000, noNaN: true }) }),
      eyeHeight: fc.double({ min: -10, max: 100, noNaN: true }),
    });
    fc.assert(
      fc.property(anySystem, (raw: PerspectiveSystem) => {
        const fixed = clampPerspective(raw);
        expect(violations(fixed)).toEqual([]);
        expect(clampPerspective(fixed)).toBe(fixed);
        // A valid camera exists for every clamped system.
        expect(() => deriveCamera(fixed)).not.toThrow();
      }),
      { numRuns: 1000 },
    );
  });

  it('keeps VP-V on its side of the horizon when pushing it (PV-2)', () => {
    const above = clampPerspective({ ...ps, vpVerticalY: 250 });
    expect(above.vpVerticalY!).toBeLessThan(ps.horizonY);
    const below = clampPerspective({ ...ps, vpVerticalY: 310 });
    expect(below.vpVerticalY!).toBeGreaterThan(ps.horizonY);
  });

  it('rejects non-finite input', () => {
    expect(() => clampPerspective({ ...ps, eyeHeight: Infinity })).toThrow();
  });
});

describe('camera (§6.2)', () => {
  it('refuses an invalid system', () => {
    expect(() => deriveCamera({ ...ps, vpVerticalY: 300 })).toThrow(/PV-2/);
  });

  it('places VP-V at infinity in 2pt, finite in 3pt', () => {
    expect(vanishingPoint(deriveCamera(setMode(ps, '2pt')), 'V').w).toBe(0);
    const v = vanishingPoint(deriveCamera(ps), 'V');
    expect(v.x / v.w).toBeCloseTo(600, 6);
    expect(v.y / v.w).toBeCloseTo(3200, 6);
  });

  it('makes a 1 u cube a sensible size on the default paper (OD-3)', () => {
    const cam = deriveCamera(ps);
    const a = project(cam, v3(0, 0, 0))!;
    const b = project(cam, v3(1, 0, 0))!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(20);
  });
});

describe('projection & clipping (§6.2, §6.5)', () => {
  const cam = deriveCamera(ps);

  it('returns null behind the camera', () => {
    // Points beyond the camera centre, on the far side from the world origin.
    const behind1 = v3(cam.C.x * 2, cam.C.y * 2, cam.C.z * 2);
    const behind2 = v3(cam.C.x * 3, cam.C.y * 3, cam.C.z * 3);
    expect(project(cam, behind1)).toBeNull();
    expect(projectSegment(cam, behind1, behind2)).toBeNull();
  });

  it('clips a segment crossing the near plane to its visible part', () => {
    const front = v3(0, 0, 0);
    const back = v3(cam.C.x * 2, cam.C.y * 2, cam.C.z * 2);
    const seg = projectSegment(cam, front, back)!;
    expect(seg).not.toBeNull();
    expect(seg[0]).toEqual(project(cam, front));
    const seg2 = projectSegment(cam, back, front)!;
    expect(seg2[1]).toEqual(project(cam, front));
  });

  it('unprojects nothing at or above the horizon onto the ground', () => {
    expect(unproject(cam, { x: 600, y: 200 }, 0)).toBeNull();
  });

  it('unprojects onto the ground below the horizon', () => {
    const P = unproject(cam, ps.anchor, 0)!;
    expect(Math.hypot(P.x, P.y, P.z)).toBeLessThan(1e-9);
  });
});

describe('edits (§6.4)', () => {
  it('moves VP-L / VP-R with the horizon and keeps VP-V when allowed', () => {
    const moved = setHorizon(ps, 300);
    expect(moved.horizonY).toBe(300);
    expect(moved.vpVerticalY).toBe(3200);
  });

  it('pushes VP-V when the horizon comes too close (PV-2)', () => {
    const moved = setHorizon({ ...ps, anchor: { x: 600, y: 3300 } }, 3100);
    expect(isValid(moved)).toBe(true);
    expect(moved.vpVerticalY).not.toBe(3200);
  });

  it('switches 3pt ⇄ 2pt', () => {
    const two = setMode(ps, '2pt');
    expect(two.vpVerticalY).toBeNull();
    const three = setMode(two, '3pt');
    expect(three.mode).toBe('3pt');
    expect(three.vpVerticalY!).toBeGreaterThan(three.horizonY);
    expect(isValid(three)).toBe(true);
    expect(setMode(ps, '3pt')).toBe(ps);
  });

  it('keeps every random valid system valid under edits', () => {
    fc.assert(
      fc.property(validPerspective, fc.double({ min: -2000, max: 2000, noNaN: true }), (p, h) => {
        expect(isValid(setHorizon(p, h))).toBe(true);
        expect(isValid(setMode(p, p.mode === '3pt' ? '2pt' : '3pt'))).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });
});
