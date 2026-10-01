import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DISPLAY_PRESETS } from '../derive/display';
import type { BoxEntity, RectEntity, StrokeEntity } from '../document/types';
import { finite, incidence, lineThrough } from '../math/homogeneous';
import { scaled, TOL_VP_INCIDENCE } from '../math/tolerance';
import { deriveCamera, project, vanishingPoint } from '../perspective/camera';
import { DEFAULT_PERSPECTIVE as ps } from '../perspective/defaults';
import { validPerspective } from '../perspective/arbitraries.test-util';
import { eyeFromPerspective } from '../perspective/view';
import { boxCorners, boxKind, visibleFaces } from './box/box';
import { rectKind } from './rect/rect';
import { strokeKind, strokeOutline } from './stroke/stroke';
import { kindOf, registeredKinds } from './registry';
import { MOVE_HANDLE, type DeriveCtx } from './types';

const cam = deriveCamera(ps);
const eye = eyeFromPerspective(ps);
const ctx = (selected = false, display = DISPLAY_PRESETS.construction): DeriveCtx => ({ cam, eye, display, selected });
const box: BoxEntity = { id: 'b', kind: 'box', layerId: 'l', visible: true, locked: false, position: { x: -0.5, y: -0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, uniform: false };

describe('registry (§8.4)', () => {
  it('registers box, rect, stroke', () => {
    expect(registeredKinds().sort()).toEqual(['box', 'rect', 'stroke']);
    expect(kindOf('nope')).toBeUndefined();
  });
});

describe('box (BX-01, BX-05)', () => {
  it('edges pass through their VPs for random systems (PS-T1 on the entity)', () => {
    fc.assert(
      fc.property(validPerspective, (p) => {
        const c = deriveCamera(p);
        for (const it of boxKind.derive(box, { cam: c, eye, display: DISPLAY_PRESETS.construction, selected: false })) {
          if ((it.role !== 'edge' && it.role !== 'hiddenEdge') || !it.family) continue;
          const [x0, y0, x1, y1] = it.points;
          const len = Math.hypot(x1 - x0, y1 - y0);
          if (len < 1e-3) continue;
          const vp = vanishingPoint(c, it.family);
          const lever = vp.w ? Math.max(1, Math.hypot(vp.x / vp.w - x0, vp.y / vp.w - y0) / len) : 1;
          const tol = scaled(TOL_VP_INCIDENCE, x0, y0, x1, y1, vp.w ? vp.x / vp.w : 0, vp.w ? vp.y / vp.w : 0) * lever;
          expect(incidence(lineThrough(finite({ x: x0, y: y0 }), finite({ x: x1, y: y1 })), vp)).toBeLessThanOrEqual(tol);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('shows at most three faces, never both of an opposite pair', () => {
    const vis = visibleFaces(box, cam.C);
    expect(vis.filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(vis.filter(Boolean).length).toBeLessThanOrEqual(3);
    for (let a = 0; a < 3; a++) expect(vis[2 * a] && vis[2 * a + 1]).toBe(false);
  });

  it('hides hidden edges and rays unless asked (display)', () => {
    const clean = boxKind.derive(box, ctx(false, DISPLAY_PRESETS.clean));
    expect(clean.some((i) => i.role === 'hiddenEdge' || i.role === 'ray')).toBe(false);
    const constr = boxKind.derive(box, ctx(true));
    expect(constr.some((i) => i.role === 'hiddenEdge')).toBe(true);
    expect(constr.some((i) => i.role === 'ray')).toBe(true);
    expect(boxKind.derive(box, ctx(false)).some((i) => i.role === 'ray')).toBe(false);
  });

  it('offers three resize handles and a lift handle', () => {
    const h = boxKind.handles(box, ctx());
    expect(h.filter((x) => x.kind === 'resize').map((x) => x.family).sort()).toEqual(['L', 'R', 'V']);
    expect(h.some((x) => x.id === 'lift')).toBe(true);
  });

  const drag = (id: string, from: { x: number; y: number }, to: { x: number; y: number }, start = box) =>
    boxKind.applyHandle(start, id, { start, startPp: from, pp: to, snapStep: null, others: [] }, ctx());

  it('resizes along the family direction only (BX-03)', () => {
    const h = boxKind.handles(box, ctx()).find((x) => x.family === 'V')!;
    const p = drag(h.id, h.point, { x: h.point.x, y: h.point.y - 60 });
    expect(p.size!.z).toBeGreaterThan(1);
    expect(p.size!.x).toBe(1);
  });

  it('scales all dimensions with cube lock', () => {
    const cube = { ...box, uniform: true };
    const h = boxKind.handles(cube, ctx()).find((x) => x.family === 'V')!;
    const p = drag(h.id, h.point, { x: h.point.x, y: h.point.y - 60 }, cube);
    expect(p.size!.x).toBeCloseTo(p.size!.z);
    expect(p.size!.y).toBeCloseTo(p.size!.z);
  });

  it('moves on its base plane and lifts along V', () => {
    const a = project(cam, { x: 0, y: 0, z: 0 })!;
    const moved = drag(MOVE_HANDLE, a, project(cam, { x: 2, y: 0, z: 0 })!);
    expect(moved.position!.x).toBeCloseTo(1.5, 6);
    expect(moved.position!.z).toBe(0);
    const lift = boxKind.handles(box, ctx()).find((x) => x.id === 'lift')!;
    const lifted = drag('lift', lift.point, { x: lift.point.x, y: lift.point.y - 80 });
    expect(lifted.position!.z).toBeGreaterThan(0);
  });

  it('snaps to the grid', () => {
    const a = project(cam, { x: 0, y: 0, z: 0 })!;
    const p = boxKind.applyHandle(box, MOVE_HANDLE, { start: box, startPp: a, pp: project(cam, { x: 0.33, y: 0, z: 0 })!, snapStep: 0.1, others: [] }, ctx());
    expect(p.position!.x).toBeCloseTo(-0.2, 9);
  });

  it('has corners, bounds and depth', () => {
    expect(boxCorners(box)[7]).toEqual({ x: 0.5, y: 0.5, z: 1 });
    expect(boxKind.bounds(box, ctx())!.width).toBeGreaterThan(0);
    expect(boxKind.depth(box, ctx())).toBeGreaterThan(0);
  });
});

describe('rect (RC-01)', () => {
  const rect: RectEntity = { id: 'r', kind: 'rect', layerId: 'l', visible: true, locked: false, plane: 'wallL', position: { x: 1, y: 0, z: 0 }, size: { x: 1, y: 1 } };
  it('draws a face and 4 edges and resizes', () => {
    const items = rectKind.derive(rect, ctx());
    expect(items.filter((i) => i.role === 'edge')).toHaveLength(4);
    const h = rectKind.handles(rect, ctx())[0];
    const p = rectKind.applyHandle(rect, h.id, { start: rect, startPp: h.point, pp: { x: h.point.x - 50, y: h.point.y }, snapStep: null, others: [] }, ctx());
    expect(p.size!.x).not.toBe(1);
  });
  it('moves on its base plane', () => {
    const a = project(cam, { x: 1, y: 0, z: 0 })!;
    const b = project(cam, { x: 1, y: 2, z: 0 })!;
    const p = rectKind.applyHandle(rect, MOVE_HANDLE, { start: rect, startPp: a, pp: b, snapStep: null, others: [] }, ctx());
    expect(p.position!.y).toBeCloseTo(2, 6);
  });
});

describe('stroke (SK-01)', () => {
  const stroke: StrokeEntity = { id: 's', kind: 'stroke', layerId: 'l', visible: true, locked: false, space: 'picture', tool: 'pen', color: '#000', width: 4, opacity: 1, points: [0, 0, 0.5, 50, 0, 0.5, 100, 10, 0.5] };
  it('renders an outline polygon', () => {
    expect(strokeOutline(stroke).length).toBeGreaterThan(8);
    expect(strokeKind.derive(stroke, ctx())[0].data?.color).toBe('#000');
  });
  it('moves in the picture plane', () => {
    const p = strokeKind.applyHandle(stroke, MOVE_HANDLE, { start: stroke, startPp: { x: 0, y: 0 }, pp: { x: 10, y: 5 }, snapStep: null, others: [] }, ctx());
    expect(p.points!.slice(0, 3)).toEqual([10, 5, 0.5]);
  });
});
