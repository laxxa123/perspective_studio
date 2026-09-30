// Document + camera → RenderModel (§8.3). M2: paper, perspective guides and
// the read-only test box that proves live re-projection.
import { deriveCamera, projectSegment } from '../perspective/camera';
import type { Camera, Family, PerspectiveSystem } from '../perspective/types';
import type { Vec3 } from '../math/vec';
import { boundsOf, type Rect } from '../viewport/viewport';
import type { RenderItem, RenderModel } from './renderModel';

export interface Paper {
  width: number;
  height: number;
}

/** Horizon half-length beyond the paper, pp (the canvas is unbounded). */
const HORIZON_REACH = 1e5;

export function deriveGuides(ps: PerspectiveSystem, paper: Paper): RenderItem[] {
  const items: RenderItem[] = [
    { key: 'paper', role: 'paper', points: [0, 0, paper.width, 0, paper.width, paper.height, 0, paper.height], closed: true },
    { key: 'horizon', role: 'horizon', points: [-HORIZON_REACH, ps.horizonY, paper.width + HORIZON_REACH, ps.horizonY] },
    { key: 'vp:L', role: 'vp', family: 'L', points: [ps.vpLeftX, ps.horizonY] },
    { key: 'vp:R', role: 'vp', family: 'R', points: [ps.vpRightX, ps.horizonY] },
  ];
  if (ps.mode === '3pt' && ps.vpVerticalY !== null) {
    items.push({ key: 'vp:V', role: 'vp', family: 'V', points: [ps.verticalX, ps.vpVerticalY] });
  }
  items.push({ key: 'anchor', role: 'anchor', points: [ps.anchor.x, ps.anchor.y] });
  return items;
}

/** The 12 edges of an axis-aligned box, with their families (§3). */
function boxEdges(position: Vec3, size: Vec3): [Vec3, Vec3, Family][] {
  const c = (i: number): Vec3 => ({
    x: position.x + (i & 1 ? size.x : 0),
    y: position.y + (i & 2 ? size.y : 0),
    z: position.z + (i & 4 ? size.z : 0),
  });
  const pairs: [number, number, Family][] = [
    [0, 1, 'R'], [2, 3, 'R'], [4, 5, 'R'], [6, 7, 'R'],
    [0, 2, 'L'], [1, 3, 'L'], [4, 6, 'L'], [5, 7, 'L'],
    [0, 4, 'V'], [1, 5, 'V'], [2, 6, 'V'], [3, 7, 'V'],
  ];
  return pairs.map(([i, j, f]) => [c(i), c(j), f]);
}

/** M2 test box: read-only, not part of any document (removed in M3). */
export const TEST_BOX = { position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } };

export function deriveTestBox(cam: Camera): RenderItem[] {
  const out: RenderItem[] = [];
  boxEdges(TEST_BOX.position, TEST_BOX.size).forEach(([a, b, family], i) => {
    const seg = projectSegment(cam, a, b);
    if (seg) out.push({ key: `test-box:e${i}`, entityId: 'test-box', role: 'edge', family, points: [seg[0].x, seg[0].y, seg[1].x, seg[1].y] });
  });
  return out;
}

export function deriveScene(ps: PerspectiveSystem, paper: Paper): RenderModel {
  const cam = deriveCamera(ps);
  const items = [...deriveGuides(ps, paper), ...deriveTestBox(cam)];
  return { items, bounds: paperBounds(paper) };
}

export const paperBounds = (paper: Paper): Rect => ({ x: 0, y: 0, width: paper.width, height: paper.height });

/** Paper plus every VP (fit to all, CV-01 / PS-05). */
export function allBounds(ps: PerspectiveSystem, paper: Paper): Rect {
  const pts = [
    { x: 0, y: 0 },
    { x: paper.width, y: paper.height },
    { x: ps.vpLeftX, y: ps.horizonY },
    { x: ps.vpRightX, y: ps.horizonY },
    ps.anchor,
  ];
  if (ps.mode === '3pt' && ps.vpVerticalY !== null) pts.push({ x: ps.verticalX, y: ps.vpVerticalY });
  return boundsOf(pts);
}
