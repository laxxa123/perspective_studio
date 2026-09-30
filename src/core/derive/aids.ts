// Viewing aids in the picture (UI-05, UI-06, UI-07, PL-01): derived from the
// camera like any geometry, so they are exact.
import { projectSegment, project, vanishingPoint } from '../perspective/camera';
import type { Camera, Family } from '../perspective/types';
import { v3, type Vec3 } from '../math/vec';
import type { RenderItem } from './renderModel';

/** Floor-grid half extent and spacing, u (UI-06). */
export const GRID_HALF = 10;
export const GRID_STEP = 1;

/** UI-05: three 1 u family-coloured axes from the origin; optionally extended to their VPs. */
export function originMarker(cam: Camera, extendToVps: boolean): RenderItem[] {
  const o = v3(0, 0, 0);
  const axes: [Family, Vec3][] = [
    ['R', v3(1, 0, 0)],
    ['L', v3(0, 1, 0)],
    ['V', v3(0, 0, 1)],
  ];
  const out: RenderItem[] = [];
  const at = project(cam, o);
  for (const [family, end] of axes) {
    const seg = projectSegment(cam, o, end);
    if (!seg) continue;
    out.push({ key: `origin:${family}`, role: 'anchor', family, points: [seg[0].x, seg[0].y, seg[1].x, seg[1].y], data: { arrow: 1 } });
    if (extendToVps && at) {
      const vp = vanishingPoint(cam, family);
      if (vp.w !== 0) out.push({ key: `origin:${family}:ext`, role: 'ray', family, points: [at.x, at.y, vp.x / vp.w, vp.y / vp.w], data: { dashed: 1 } });
    }
  }
  return out;
}

/** A square grid on the horizontal plane z (floor grid, working plane). */
export function planeGrid(cam: Camera, z: number, keyPrefix: string, half = GRID_HALF, step = GRID_STEP): RenderItem[] {
  const out: RenderItem[] = [];
  for (let k = -half; k <= half; k += step) {
    const a = projectSegment(cam, v3(k, -half, z), v3(k, half, z));
    if (a) out.push({ key: `${keyPrefix}:x${k}`, role: 'grid', family: 'L', points: [a[0].x, a[0].y, a[1].x, a[1].y], data: { major: k === 0 ? 1 : 0 } });
    const b = projectSegment(cam, v3(-half, k, z), v3(half, k, z));
    if (b) out.push({ key: `${keyPrefix}:y${k}`, role: 'grid', family: 'R', points: [b[0].x, b[0].y, b[1].x, b[1].y], data: { major: k === 0 ? 1 : 0 } });
  }
  return out;
}

/** UI-07: the 60° cone of vision — a circle of radius f·tan 30° around the centre of vision. */
export function coneOfVision(cam: Camera, segments = 72): RenderItem {
  const r = cam.f * Math.tan(Math.PI / 6);
  const points: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(cam.p.x + r * Math.cos(a), cam.p.y + r * Math.sin(a));
  }
  return { key: 'cone', role: 'cone', points, closed: true, data: { cx: cam.p.x, cy: cam.p.y } };
}
