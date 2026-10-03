// Isometric line drawings of block objects (OBJECTS §A.6): the question
// figure style — the same angle and scale for every figure, black outlines,
// white faces, no shading. Pure: returns SVG text; the preview, exports and
// thumbnails all come from here.
import { axisOf, bounds, has, key, type Blocks, type Cell, type Hole } from './blocks';

type V = [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Viewed from the front-right-top corner (OBJECTS §A.6 default). */
const BACK = norm([1, 1, 1]);
const RIGHT = norm([1, 0, -1]);
const UP: V = norm([-1, 2, -1]);

/** The three faces seen from that corner: +X (right side), +Y (top), +Z (front). */
const FACES: { n: Cell; corners: V[] }[] = [
  { n: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
];

/**
 * Which blocks can be seen from the drawing's corner, exactly. Seen along
 * (1, 1, 1), every face covers two triangles of a fixed triangular lattice
 * (point p projects to (x − y, z − y)); each triangle shows the nearest face
 * over it (largest x + y + z).
 */
export function visibleBlocks(b: Blocks): Set<string> {
  return new Set([...visibleFaces(b)].map((f) => f.slice(0, f.lastIndexOf(':'))));
}

/** The faces that show in the drawing, as `x,y,z:axis` (axis of the face normal: x right side, y top, z front). */
export function visibleFaces(b: Blocks): Set<string> {
  const owner = new Map<string, { depth: number; face: string }>();
  const put = (t: string, depth: number, face: string) => {
    const o = owner.get(t);
    if (!o || depth > o.depth) owner.set(t, { depth, face });
  };
  for (const c of b) {
    const [x, y, z] = c;
    const d = x + y + z;
    const k = key(c);
    // Top (+Y): the square at (x − y − 1, z − y − 1).
    const u = x - y - 1;
    const w = z - y - 1;
    put(`L${u},${w}`, d, `${k}:y`);
    put(`U${u},${w}`, d, `${k}:y`);
    // Right side (+X).
    put(`U${x - y},${z - y - 1}`, d, `${k}:x`);
    put(`L${x - y},${z - y}`, d, `${k}:x`);
    // Front (+Z).
    put(`L${x - y - 1},${z - y}`, d, `${k}:z`);
    put(`U${x - y},${z - y}`, d, `${k}:z`);
  }
  return new Set([...owner.values()].map((o) => o.face));
}

/** Whether every drilled line shows its hole on at least one visible face. */
export function holesShown(b: Blocks, holes: readonly Hole[]): boolean {
  if (!holes.length) return true;
  const faces = visibleFaces(b);
  const lines = new Map<string, boolean>();
  for (const h of holes) {
    const i = h.axis === 'x' ? 0 : h.axis === 'y' ? 1 : 2;
    const line = `${h.axis}:${h.c.filter((_, k) => k !== i).join(',')}`;
    lines.set(line, (lines.get(line) ?? false) || faces.has(`${key(h.c)}:${h.axis}`));
  }
  return [...lines.values()].every(Boolean);
}

/** Blocks the drawing cannot show. */
export const hiddenCount = (b: Blocks) => b.length - visibleBlocks(b).size;

/** A key for "draws the same": the faces' outlines, independent of position and size. */
export function drawingKey(b: Blocks, holes: readonly Hole[] = []): string {
  const box = bounds(b);
  if (!box) return '';
  const back = (c: Cell): Cell => [c[0] - box.min[0], c[1] - box.min[1], c[2] - box.min[2]];
  return isoFaces(b.map(back), holes.map((h) => ({ c: back(h.c), axis: h.axis })))
    .map((f) => f.pts.map(([x, y]) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`).join(' ') + (f.hole ? 'o' : ''))
    .sort()
    .join('|');
}

export interface IsoOptions {
  /** Width and height of the square drawing, px. */
  size?: number;
  /** Outline width, px (constant whatever the object's size). */
  stroke?: number;
  /** Space around the object, as a fraction of the size. */
  margin?: number;
  /** Blocks filled with a tint (marked block, cut layer): key → colour. */
  fills?: ReadonlyMap<string, string>;
  /** Holes through blocks (OBJECTS §A.14): drawn on the faces they open onto. */
  holes?: readonly Hole[];
}

export interface IsoFace {
  /** Screen points (unit = one block edge). */
  pts: [number, number][];
  depth: number;
  block: string;
  /** The face opens onto a hole: its outline (projected circle), screen points. */
  hole?: [number, number][];
}

/** The visible faces, far to near (painter's order: nearer faces cover farther ones). */
/** Hole radius as a fraction of a block edge. */
const HOLE_R = 0.27;

export function isoFaces(b: Blocks, holes: readonly Hole[] = []): IsoFace[] {
  const out: IsoFace[] = [];
  const holed = new Set(holes.map((h) => `${key(h.c)}:${h.axis}`));
  for (const c of b)
    for (const f of FACES) {
      if (has(b, [c[0] + f.n[0], c[1] + f.n[1], c[2] + f.n[2]])) continue;
      const pts = f.corners.map((k): [number, number] => {
        const p: V = [c[0] + k[0], c[1] + k[1], c[2] + k[2]];
        return [dot(p, RIGHT), -dot(p, UP)];
      });
      // Depth of the face centre along the view direction.
      const m: V = [c[0] + 0.5 + f.n[0] * 0.5, c[1] + 0.5 + f.n[1] * 0.5, c[2] + 0.5 + f.n[2] * 0.5];
      const face: IsoFace = { pts, depth: dot(m, BACK), block: key(c) };
      if (holed.has(`${key(c)}:${axisOf(f.n)}`)) {
        // The two directions across the face, and a circle in them.
        const across = ([0, 1, 2] as const).filter((i) => !f.n[i]);
        face.hole = Array.from({ length: 28 }, (_, t): [number, number] => {
          const a = (t / 28) * Math.PI * 2;
          const p: V = [m[0], m[1], m[2]];
          p[across[0]] += HOLE_R * Math.cos(a);
          p[across[1]] += HOLE_R * Math.sin(a);
          return [dot(p, RIGHT), -dot(p, UP)];
        });
      }
      out.push(face);
    }
  return out.sort((a, b) => a.depth - b.depth);
}

const r = (v: number) => Math.round(v * 100) / 100;

/** The SVG drawing of a block object. Empty objects draw an empty frame. */
export function isoSvg(b: Blocks, o: IsoOptions = {}): string {
  const size = o.size ?? 240;
  const stroke = o.stroke ?? 1.5;
  const margin = o.margin ?? 0.08;
  const faces = isoFaces(b, o.holes ?? []);
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  if (!faces.length || !bounds(b)) return `${head}<rect width="${size}" height="${size}" fill="#fff"/></svg>`;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const f of faces)
    for (const [x, y] of f.pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  const inner = size * (1 - 2 * margin);
  const k = inner / Math.max(x1 - x0, y1 - y0);
  const ox = (size - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (size - (y1 - y0) * k) / 2 - y0 * k;
  const body = faces
    .map((f) => {
      const d = `M${f.pts.map(([x, y]) => `${r(x * k + ox)} ${r(y * k + oy)}`).join('L')}Z`;
      const fill = o.fills?.get(f.block);
      const face = fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`;
      const hole = f.hole ? `<path d="M${f.hole.map(([x, y]) => `${r(x * k + ox)} ${r(y * k + oy)}`).join('L')}Z" fill="#495057" stroke-width="${r(stroke * 0.8)}"/>` : '';
      return face + hole;
    })
    .join('');
  return `${head}<rect width="${size}" height="${size}" fill="#fff"/><g fill="#fff" stroke="#111" stroke-width="${stroke}" stroke-linejoin="round">${body}</g></svg>`;
}
