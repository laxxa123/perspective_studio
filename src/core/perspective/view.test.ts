// ADR-0006: the eye is the stored setting (PS-12…PS-14).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { det } from '../math/mat3';
import { dot3, v3 } from '../math/vec';
import { validPerspective } from './arbitraries.test-util';
import { deriveCamera, project, vanishingPoint } from './camera';
import { DEFAULT_PERSPECTIVE } from './defaults';
import { setMode } from './edit';
import {
  cameraFromEye,
  eyeFromPerspective,
  horizonOf,
  isValidEye,
  modeOf,
  orbit,
  perspectiveOf,
  rotationOf,
} from './view';

const RUNS = { numRuns: 1000 };
const close = (a: number, b: number, scale = 1) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(scale), Math.abs(a), Math.abs(b));

describe('eye ⇄ perspective system (PS-12)', () => {
  it('the eye of a system gives back the same camera', () => {
    fc.assert(
      fc.property(validPerspective, (ps) => {
        const a = deriveCamera(ps);
        const eye = eyeFromPerspective(ps);
        expect(isValidEye(eye)).toBe(true);
        expect(modeOf(eye)).toBe(ps.mode);
        const b = cameraFromEye(eye);
        expect(close(b.f, a.f)).toBe(true);
        for (const k of ['c0', 'c1', 'c2'] as const) expect(dot3(a.M[k], b.M[k])).toBeCloseTo(1, 9);
        for (const k of ['x', 'y', 'z'] as const) expect(close(b.C[k], a.C[k], a.C.z)).toBe(true);
      }),
      RUNS,
    );
  });

  it('round-trips through the VP-handle form', () => {
    fc.assert(
      fc.property(validPerspective, (ps) => {
        const back = perspectiveOf(eyeFromPerspective(ps));
        expect(back).not.toBeNull();
        const scale = Math.max(Math.abs(ps.vpLeftX), Math.abs(ps.vpRightX), Math.abs(ps.horizonY));
        expect(close(back!.horizonY, ps.horizonY, scale)).toBe(true);
        expect(close(back!.vpLeftX, ps.vpLeftX, scale)).toBe(true);
        expect(close(back!.vpRightX, ps.vpRightX, scale)).toBe(true);
        expect(close(back!.eyeHeight, ps.eyeHeight)).toBe(true);
      }),
      RUNS,
    );
  });

  it('rotations are proper (det +1) for any turn and tilt', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 90, noNaN: true }), fc.double({ min: -85, max: 90, noNaN: true }), (t, k) => {
        expect(det(rotationOf(t, k))).toBeCloseTo(1, 12);
      }),
      RUNS,
    );
  });
});

describe('views with VPs at infinity (PS-14)', () => {
  const base = eyeFromPerspective(DEFAULT_PERSPECTIVE);

  it('face-on: the facing family is parallel to the picture', () => {
    const cam = cameraFromEye({ ...base, turn: 0, tilt: 0 });
    expect(vanishingPoint(cam, 'R').w).toBe(0);
    expect(vanishingPoint(cam, 'L').w).not.toBe(0);
    expect(perspectiveOf({ ...base, turn: 0, tilt: 0 })).toBeNull();
  });

  it('top view: the horizon is at infinity and VP-V is the centre of vision', () => {
    const cam = cameraFromEye({ ...base, tilt: 90 });
    expect(horizonOf(cam)).toBeNull();
    const v = vanishingPoint(cam, 'V');
    expect(v.x / v.w).toBeCloseTo(base.cv.x, 9);
    expect(v.y / v.w).toBeCloseTo(base.cv.y, 9);
  });

  it('level is 2-point', () => {
    const eye = eyeFromPerspective(setMode(DEFAULT_PERSPECTIVE, '2pt'));
    expect(eye.tilt).toBe(0);
    expect(perspectiveOf(eye)?.mode).toBe('2pt');
  });
});

describe('orbit (PS-13)', () => {
  const base = eyeFromPerspective(DEFAULT_PERSPECTIVE);
  const pivot = v3(0, 0, 0);

  it('keeps the pivot in place at the same depth', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 90, noNaN: true }), fc.double({ min: 0, max: 90, noNaN: true }), (t, k) => {
        const e = orbit(base, pivot, t, k);
        if (!e) return;
        const a = project(cameraFromEye(base), pivot)!;
        const b = project(cameraFromEye(e), pivot)!;
        expect(b.x).toBeCloseTo(a.x, 6);
        expect(b.y).toBeCloseTo(a.y, 6);
        expect(e.distance).toBe(base.distance);
      }),
      RUNS,
    );
  });

  it('reaches the top view directly above the pivot side', () => {
    const e = orbit(base, pivot, base.turn, 90)!;
    expect(e).not.toBeNull();
    expect(e.tilt).toBe(90);
    expect(e.position.z).toBeGreaterThan(base.position.z);
  });

  it('refuses to take the eye below the floor', () => {
    expect(orbit(base, v3(0, 0, 50), base.turn, -80)).toBeNull();
  });
});
