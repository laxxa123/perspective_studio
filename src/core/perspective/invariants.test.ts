// Mandatory invariants PS-T1…PS-T6 (§6.6), ≥ 1,000 random cases each (NFR-A-01).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { atInfinity, finite, incidence, lineThrough, type HPoint } from '../math/homogeneous';
import { det } from '../math/mat3';
import {
  scaled,
  TOL_ORTHONORMAL,
  TOL_ROUND_TRIP,
  TOL_VP_INCIDENCE,
} from '../math/tolerance';
import { dist2, dot3, v3 } from '../math/vec';
import { BOX_EDGES, box, boxCorners, validPerspective } from './arbitraries.test-util';
import {
  deriveCamera,
  perspectiveFromCamera,
  project,
  projectSegment,
  unproject,
} from './camera';
import type { Family, PerspectiveSystem } from './types';

/** The VPs as stored in the perspective system (not derived from the camera). */
const storedVp = (ps: PerspectiveSystem, fam: Family): HPoint =>
  fam === 'L'
    ? finite({ x: ps.vpLeftX, y: ps.horizonY })
    : fam === 'R'
      ? finite({ x: ps.vpRightX, y: ps.horizonY })
      : ps.vpVerticalY === null
        ? atInfinity(0, 1)
        : finite({ x: ps.verticalX, y: ps.vpVerticalY });

const RUNS = { numRuns: 1000 };

describe('perspective invariants (§6.6)', () => {
  it('PS-T1: every projected family edge passes through its VP (2pt: family V is vertical)', () => {
    fc.assert(
      fc.property(validPerspective, box, (ps, b) => {
        const cam = deriveCamera(ps);
        const corners = boxCorners(b);
        for (const [i, j, fam] of BOX_EDGES) {
          const seg = projectSegment(cam, corners[i], corners[j]);
          if (!seg) continue;
          const [e0, e1] = seg;
          const length = dist2(e0, e1);
          const vp = storedVp(ps, fam);
          const line = lineThrough(finite(e0), finite(e1));
          if (vp.w === 0) {
            // At infinity: the edge is parallel to the VP direction (vertical in 2pt).
            if (length < 1e-6) continue;
            expect(incidence(line, vp)).toBeLessThanOrEqual(TOL_VP_INCIDENCE);
            if (ps.mode === '2pt' && fam === 'V') {
              expect(Math.abs(e1.x - e0.x)).toBeLessThanOrEqual(scaled(TOL_VP_INCIDENCE, e0.x, e1.x));
            }
            continue;
          }
          // Measuring from a very short segment to a far VP amplifies rounding:
          // scale the tolerance by the lever arm (distance to VP / segment length).
          if (length < 1e-6 * Math.max(1, Math.abs(e0.x), Math.abs(e0.y))) continue;
          const vpPt = { x: vp.x / vp.w, y: vp.y / vp.w };
          const lever = Math.max(1, dist2(vpPt, e0) / length);
          const tol = scaled(TOL_VP_INCIDENCE, e0.x, e0.y, e1.x, e1.y, vpPt.x, vpPt.y) * lever;
          expect(incidence(line, vp)).toBeLessThanOrEqual(tol);
        }
      }),
      RUNS,
    );
  });

  it('PS-T2: M is orthonormal and right-handed', () => {
    fc.assert(
      fc.property(validPerspective, (ps) => {
        const { M } = deriveCamera(ps);
        const cols = [M.c0, M.c1, M.c2];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            expect(Math.abs(dot3(cols[i], cols[j]) - (i === j ? 1 : 0))).toBeLessThanOrEqual(TOL_ORTHONORMAL);
          }
        }
        expect(Math.abs(det(M) - 1)).toBeLessThanOrEqual(TOL_ORTHONORMAL);
        // World up points up in the picture (camera y is down).
        expect(M.c2.y).toBeLessThan(0);
      }),
      RUNS,
    );
  });

  it('PS-T3: the world origin projects to the anchor and C.z = eyeHeight', () => {
    fc.assert(
      fc.property(validPerspective, (ps) => {
        const cam = deriveCamera(ps);
        const o = project(cam, v3(0, 0, 0));
        expect(o).not.toBeNull();
        const tol = scaled(TOL_ROUND_TRIP, ps.anchor.x, ps.anchor.y, ps.vpLeftX, ps.vpRightX);
        expect(Math.abs(o!.x - ps.anchor.x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(o!.y - ps.anchor.y)).toBeLessThanOrEqual(tol);
        expect(Math.abs(cam.C.z - ps.eyeHeight)).toBeLessThanOrEqual(scaled(TOL_ROUND_TRIP, ps.eyeHeight));
      }),
      RUNS,
    );
  });

  it('PS-T4: project(unproject(q, z0)) = q for q below the horizon', () => {
    fc.assert(
      fc.property(
        validPerspective,
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.double({ min: 1, max: 3000, noNaN: true }),
        fc.double({ min: -5, max: 0.99, noNaN: true }),
        (ps, fx, drop, zFraction) => {
          const cam = deriveCamera(ps);
          const q = { x: ps.vpLeftX + (ps.vpRightX - ps.vpLeftX) * fx, y: ps.horizonY + drop };
          // A plane below the eye, so rays below the horizon reach it.
          const z0 = ps.eyeHeight * zFraction;
          const P = unproject(cam, q, z0);
          expect(P).not.toBeNull();
          expect(Math.abs(P!.z - z0)).toBeLessThanOrEqual(scaled(TOL_ROUND_TRIP, z0, P!.x, P!.y));
          const back = project(cam, P!);
          expect(back).not.toBeNull();
          const tol = scaled(TOL_ROUND_TRIP, q.x, q.y, ps.vpLeftX, ps.vpRightX);
          expect(dist2(back!, q)).toBeLessThanOrEqual(tol);
        },
      ),
      RUNS,
    );
  });

  it('PS-T5: re-deriving the VPs from the camera returns the stored system', () => {
    fc.assert(
      fc.property(validPerspective, (ps) => {
        const back = perspectiveFromCamera(deriveCamera(ps), ps.mode);
        const scale = [ps.vpLeftX, ps.vpRightX, ps.horizonY, ps.anchor.x, ps.anchor.y, ps.vpVerticalY ?? 0];
        const tol = scaled(TOL_ROUND_TRIP, ...scale);
        expect(Math.abs(back.horizonY - ps.horizonY)).toBeLessThanOrEqual(tol);
        expect(Math.abs(back.vpLeftX - ps.vpLeftX)).toBeLessThanOrEqual(tol);
        expect(Math.abs(back.vpRightX - ps.vpRightX)).toBeLessThanOrEqual(tol);
        expect(Math.abs(back.verticalX - ps.verticalX)).toBeLessThanOrEqual(tol);
        if (ps.mode === '3pt') {
          expect(Math.abs(back.vpVerticalY! - ps.vpVerticalY!)).toBeLessThanOrEqual(tol);
        } else {
          expect(back.vpVerticalY).toBeNull();
        }
        expect(Math.abs(back.anchor.x - ps.anchor.x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(back.anchor.y - ps.anchor.y)).toBeLessThanOrEqual(tol);
        expect(Math.abs(back.eyeHeight - ps.eyeHeight)).toBeLessThanOrEqual(scaled(TOL_ROUND_TRIP, ps.eyeHeight));
      }),
      RUNS,
    );
  });

  it('PS-T6: serialize → load → project is bit-identical', () => {
    fc.assert(
      fc.property(validPerspective, box, (ps, b) => {
        const loaded = JSON.parse(JSON.stringify({ ps, b })) as { ps: typeof ps; b: typeof b };
        const before = deriveCamera(ps);
        const after = deriveCamera(loaded.ps);
        const pa = boxCorners(b).map((P) => project(before, P));
        const pb = boxCorners(loaded.b).map((P) => project(after, P));
        expect(pb).toEqual(pa);
      }),
      RUNS,
    );
  });
});
