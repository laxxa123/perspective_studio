import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validPerspective } from './arbitraries.test-util';
import { DEFAULT_PERSPECTIVE as ps } from './defaults';
import { dragHandle, forbiddenBand, pointHandles, type PerspectiveHandleId } from './handles';
import { setMode } from './edit';
import { isValid } from './validity';

describe('perspective handles (PS-03)', () => {
  it('lists VP-L, VP-R, VP-V (3pt) or the centre of vision (2pt), and the anchor', () => {
    expect(pointHandles(ps).map((h) => h.id)).toEqual(['vpL', 'vpR', 'vpV', 'anchor']);
    expect(pointHandles(setMode(ps, '2pt')).map((h) => h.id)).toEqual(['vpL', 'vpR', 'cv', 'anchor']);
  });

  it('moves a handle freely inside the valid region', () => {
    const r = dragHandle(ps, 'vpL', { x: -900, y: 999 });
    expect(r.clamped).toBe(false);
    expect(r.ps.vpLeftX).toBe(-900);
    expect(r.ps.horizonY).toBe(ps.horizonY); // VP-L stays on the horizon
  });

  it('stops VP-V at the edge of the PV-2 band', () => {
    const r = dragHandle(ps, 'vpV', { x: 600, y: 300 });
    expect(r.clamped).toBe(true);
    const band = forbiddenBand(r.ps)!;
    expect(r.ps.vpVerticalY!).toBeGreaterThanOrEqual(band.bottom);
    expect(r.ps.vpVerticalY! - band.bottom).toBeLessThan(1);
  });

  it('lets VP-V jump across the band to a valid spot above the horizon', () => {
    const r = dragHandle(ps, 'vpV', { x: 600, y: -3000 });
    expect(r.clamped).toBe(false);
    expect(r.ps.vpVerticalY).toBe(-3000);
  });

  it('carries VP-V with the horizon (PS-08, ADR-0005)', () => {
    const far = dragHandle({ ...ps, anchor: { x: 600, y: 3500 } }, 'horizon', { x: 0, y: 3000 });
    expect(isValid(far.ps)).toBe(true);
    expect(far.ps.horizonY).toBe(3000);
    expect(far.ps.vpVerticalY! - far.ps.horizonY).toBeCloseTo(ps.vpVerticalY! - ps.horizonY, 9);
  });

  it('stops the anchor just below the horizon (PV-4)', () => {
    const r = dragHandle(ps, 'anchor', { x: 600, y: 0 });
    expect(r.clamped).toBe(true);
    expect(r.ps.anchor.y).toBeGreaterThan(ps.horizonY);
    expect(r.ps.anchor.y - ps.horizonY).toBeLessThan(5);
  });

  it('never produces an invalid system', () => {
    const ids: PerspectiveHandleId[] = ['vpL', 'vpR', 'vpV', 'cv', 'anchor', 'horizon'];
    fc.assert(
      fc.property(
        validPerspective,
        fc.constantFrom(...ids),
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        (p, id, x, y) => {
          expect(isValid(dragHandle(p, id, { x, y }).ps)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('refuses to start from an invalid system', () => {
    expect(() => dragHandle({ ...ps, eyeHeight: -1 }, 'vpL', { x: 0, y: 0 })).toThrow();
  });

  it('has no band in 2pt', () => expect(forbiddenBand(setMode(ps, '2pt'))).toBeNull());
});
