// Surface patterns (CUBE §16, §17): which faces a pattern covers, its
// face-local fragments, and whether a cube keeps it continuous across folds.
import type { ArtworkElement, CubeModel, FaceId, NetLayout, SurfacePattern, Transform2 } from '../model/CubeModel';
import { apply, eq, ROTATIONS } from './CubeGeometry';
import type { CubeState } from './FoldingEngine';
import { applyAffine, boxCorners, compose, faceToNet, invert, mapTransform } from './Orientation';

/** Minimum overlap with a face, in face units, for it to count as covered. */
const COVER_EPS = 0.02;

/** The faces an element (placed on face `anchor` with transform `t`) overlaps on the net. */
export function coveredFaces(el: Pick<ArtworkElement, 'w' | 'h'>, t: Transform2, anchor: FaceId, net: NetLayout): FaceId[] {
  const a = net.cells.find((c) => c.face === anchor);
  if (!a) return [anchor];
  const m = faceToNet(a);
  const pts = boxCorners(t, el.w, el.h).map((p) => applyAffine(m, p));
  const x0 = Math.min(...pts.map((p) => p.x));
  const x1 = Math.max(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y));
  const y1 = Math.max(...pts.map((p) => p.y));
  const out = net.cells
    .filter((c) => Math.min(x1, c.col + 1) - Math.max(x0, c.col) > COVER_EPS && Math.min(y1, c.row + 1) - Math.max(y0, c.row) > COVER_EPS)
    .map((c) => c.face);
  return out.length ? out : [anchor];
}

/** The fragment transforms of an element anchored on `anchor`, for each face it covers on the current net. */
export function fragmentsFor(el: ArtworkElement, anchor: FaceId, net: NetLayout): SurfacePattern['fragments'] {
  const a = net.cells.find((c) => c.face === anchor);
  if (!a) return [{ face: anchor, transform: el.transform }];
  const toNet = faceToNet(a);
  return coveredFaces(el, el.transform, anchor, net).map((f) => {
    const c = net.cells.find((x) => x.face === f)!;
    return { face: f, transform: mapTransform(el.transform, compose(invert(faceToNet(c)), toNet)) };
  });
}

/** Faces a pattern ties together (pairs whose relative position on the cube must be kept). */
export const patternPairs = (p: SurfacePattern): [FaceId, FaceId][] => {
  const fs = p.fragments.map((f) => f.face);
  const out: [FaceId, FaceId][] = [];
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) out.push([fs[i], fs[j]]);
  return out;
};

/**
 * Whether cube `b` keeps every pattern of the model continuous as on cube `a`
 * (the authored cube): each pair of faces a pattern spans must sit in the same
 * relative position and orientation, up to turning the whole cube.
 */
export function continuityKept(m: CubeModel, a: CubeState, b: CubeState): boolean {
  for (const p of m.patterns) {
    const faces = p.fragments.map((f) => f.face);
    if (faces.length < 2) continue;
    const ok = ROTATIONS.some((r) => faces.every((f) => eq(apply(r, a[f].n), b[f].n) && eq(apply(r, a[f].x), b[f].x) && a[f].mirrored === b[f].mirrored));
    if (!ok) return false;
  }
  return true;
}

/** Faces carrying a fragment of a multi-face pattern. */
export const patternFaces = (m: CubeModel): Set<FaceId> =>
  new Set(m.patterns.filter((p) => p.fragments.length > 1).flatMap((p) => p.fragments.map((f) => f.face)));
