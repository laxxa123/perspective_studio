// Face-local ⇄ net coordinates and 2D affine maps (CUBE §15, §17). A face is
// the unit square; on the net it sits in its cell turned clockwise by `turns`
// (and flipped left–right first when mirrored). Affine = SVG matrix(a b c d e f).
import type { NetCell, Transform2, Turns } from '../model/CubeModel';

export type Affine = [number, number, number, number, number, number];

export const IDENTITY_AFFINE: Affine = [1, 0, 0, 1, 0, 0];

/** m ∘ n (apply n first). */
export const compose = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export const applyAffine = (m: Affine, p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

export function invert(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

/** Unit square turned clockwise by quarter turns about its centre (face → cell-local). */
const TURN: Record<Turns, Affine> = {
  0: [1, 0, 0, 1, 0, 0],
  1: [0, 1, -1, 0, 1, 0],
  2: [-1, 0, 0, -1, 1, 1],
  3: [0, -1, 1, 0, 0, 1],
};
const MIRROR: Affine = [-1, 0, 0, 1, 1, 0];

/** Face-local → cell-local (unit square), for turns and mirroring. */
export const faceToCell = (turns: Turns, mirrored = false): Affine => (mirrored ? compose(TURN[turns], MIRROR) : TURN[turns]);

/** Face-local → net coordinates for a placed cell. */
export const faceToNet = (c: NetCell): Affine => compose([1, 0, 0, 1, c.col, c.row], faceToCell(c.turns, c.mirrored));

/** An element transform as an affine map (translate · rotate · scale). */
export function transformAffine(t: Transform2): Affine {
  const r = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos * t.scaleX, sin * t.scaleX, -sin * t.scaleY, cos * t.scaleY, t.x, t.y];
}

/**
 * Re-expresses a transform under a quarter-turn rigid map `m` (e.g. one face's
 * frame into another's via the net). Mirror maps are not allowed here.
 */
export function mapTransform(t: Transform2, m: Affine): Transform2 {
  const p = applyAffine(m, t);
  const rot = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  return { x: p.x, y: p.y, rotation: normaliseDeg(t.rotation + rot), scaleX: t.scaleX, scaleY: t.scaleY };
}

export const normaliseDeg = (d: number) => {
  const r = ((d % 360) + 360) % 360;
  return Math.abs(r - 360) < 1e-9 ? 0 : Math.round(r * 1e6) / 1e6;
};

/** The four corners of an element's box under a transform (in the transform's frame). */
export function boxCorners(t: Transform2, w: number, h: number) {
  const m = transformAffine(t);
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ].map((p) => applyAffine(m, p));
}
