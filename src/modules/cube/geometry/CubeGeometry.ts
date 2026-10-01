// Cube topology and rotations (CUBE §7, §8, §22). Integer 3D vectors only:
// the unit cube [0,1]³, sides named by their outward normal.

export type V3 = readonly [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const eq = (a: V3, b: V3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** Removes −0 so keys and JSON stay stable. */
export const clean = (a: V3): V3 => [a[0] + 0, a[1] + 0, a[2] + 0];

export type Side = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
export const SIDES: readonly Side[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

export const SIDE_NORMAL: Record<Side, V3> = {
  '+X': [1, 0, 0],
  '-X': [-1, 0, 0],
  '+Y': [0, 1, 0],
  '-Y': [0, -1, 0],
  '+Z': [0, 0, 1],
  '-Z': [0, 0, -1],
};

export function sideOf(n: V3): Side {
  const s = SIDES.find((k) => eq(SIDE_NORMAL[k], n));
  if (!s) throw new Error(`not an axis normal: ${n.join(',')}`);
  return s;
}

export const OPPOSITE_SIDE: Record<Side, Side> = { '+X': '-X', '-X': '+X', '+Y': '-Y', '-Y': '+Y', '+Z': '-Z', '-Z': '+Z' };

/** A rotation as its three columns (images of x̂, ŷ, ẑ). */
export type Rot = readonly [V3, V3, V3];

export const apply = (r: Rot, v: V3): V3 =>
  clean([
    r[0][0] * v[0] + r[1][0] * v[1] + r[2][0] * v[2],
    r[0][1] * v[0] + r[1][1] * v[1] + r[2][1] * v[2],
    r[0][2] * v[0] + r[1][2] * v[1] + r[2][2] * v[2],
  ]);

const AXES: V3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** The 24 proper rotations of the cube; index 0 is the identity. */
export const ROTATIONS: readonly Rot[] = (() => {
  const out: Rot[] = [];
  for (const x of AXES) for (const y of AXES) if (dot(x, y) === 0) out.push([x, y, cross(x, y)]);
  out.sort((a, b) => Number(!(eq(a[0], [1, 0, 0]) && eq(a[1], [0, 1, 0]))) - Number(!(eq(b[0], [1, 0, 0]) && eq(b[1], [0, 1, 0]))));
  return out;
})();

/** Rule 2 / Rule 3: every side has one opposite and four neighbours. */
export const adjacentSides = (s: Side): Side[] => SIDES.filter((t) => t !== s && t !== OPPOSITE_SIDE[s]);

/** The 8 corners, each as its three mutually adjacent sides (Rule 5). */
export const CORNERS: readonly [Side, Side, Side][] = (() => {
  const out: [Side, Side, Side][] = [];
  for (const x of ['+X', '-X'] as Side[]) for (const y of ['+Y', '-Y'] as Side[]) for (const z of ['+Z', '-Z'] as Side[]) out.push([x, y, z]);
  return out;
})();
