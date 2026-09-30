import { describe, expect, it } from 'vitest';
import { newDocument } from '../document/factory';
import type { BoxEntity } from '../document/types';
import { finite, incidence, lineThrough } from '../math/homogeneous';
import { deriveCamera, vanishingPoint } from '../perspective/camera';
import { DEFAULT_PERSPECTIVE as ps } from '../perspective/defaults';
import { coneOfVision, originMarker, planeGrid } from './aids';
import { derivePlan, hitPlan, planFrame } from './plan';

const cam = deriveCamera(ps);

describe('origin marker (UI-05)', () => {
  it('draws three axes, each on the line to its VP', () => {
    const items = originMarker(cam, false).filter((i) => i.role === 'anchor');
    expect(items.map((i) => i.family).sort()).toEqual(['L', 'R', 'V']);
    for (const it of items) {
      const [x0, y0, x1, y1] = it.points;
      const vp = vanishingPoint(cam, it.family!);
      const d = incidence(lineThrough(finite({ x: x0, y: y0 }), finite({ x: x1, y: y1 })), vp);
      expect(d).toBeLessThan(1e-6 * Math.max(1, Math.abs(vp.x / vp.w), Math.abs(vp.y / vp.w)) * 100);
    }
    expect(originMarker(cam, true).some((i) => i.role === 'ray')).toBe(true);
  });
});

describe('grids and cone (UI-06, UI-07, PL-01)', () => {
  it('draws a floor grid and a working-plane grid', () => {
    expect(planeGrid(cam, 0, 'g').length).toBeGreaterThan(30);
    expect(planeGrid(cam, 2.4, 'w', 3).every((i) => i.role === 'grid')).toBe(true);
  });
  it('centres the cone of vision on the principal point', () => {
    const c = coneOfVision(cam);
    expect(c.data).toMatchObject({ cx: cam.p.x, cy: cam.p.y });
  });
});

describe('plan view (CV-05)', () => {
  const doc = newDocument({ name: 'P' });
  const plan = derivePlan(doc, cam);

  it('puts the eye at the origin of the plan, looking up', () => {
    const f = planFrame(cam);
    const eye = f.toPlan({ x: cam.C.x, y: cam.C.y });
    expect(eye.x).toBeCloseTo(0, 12);
    expect(eye.y).toBeCloseTo(0, 12);
    const ahead = f.toPlan({ x: cam.C.x + f.fwd.x, y: cam.C.y + f.fwd.y });
    expect(ahead.y).toBeCloseTo(-1);
    expect(plan.items.find((i) => i.role === 'eye')).toBeTruthy();
  });

  it('shows footprints that select on tap', () => {
    const cube = Object.values(doc.entities)[0] as BoxEntity;
    const fp = plan.items.find((i) => i.entityId === cube.id)!;
    expect(fp.role).toBe('footprint');
    const cx = (fp.points[0] + fp.points[4]) / 2;
    const cy = (fp.points[1] + fp.points[5]) / 2;
    expect(hitPlan(plan, { x: cx, y: cy }, 0.1)).toBe(cube.id);
    expect(hitPlan(plan, { x: 1000, y: 1000 }, 0.1)).toBeNull();
  });

  it('puts the origin in front of the eye (up the screen)', () => {
    const o = planFrame(cam).toPlan({ x: 0, y: 0 });
    expect(o.y).toBeLessThan(0);
  });
});
