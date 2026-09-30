import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  centreOn,
  edgeIndicator,
  fitRect,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  stageTransform,
  toPicture,
  toScreen,
  zoomAt,
} from './viewport';

const v = { offsetX: 100, offsetY: -50, zoom: 2 };

describe('viewport (§5, CV-01)', () => {
  it('converts both ways', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: -1e4, max: 1e4, noNaN: true }), (x, y) => {
        const back = toPicture(v, toScreen(v, { x, y }));
        expect(back.x).toBeCloseTo(x, 6);
        expect(back.y).toBeCloseTo(y, 6);
      }),
    );
  });

  it('zooms about a fixed screen point, within 0.05×–20×', () => {
    const at = { x: 200, y: 300 };
    const before = toPicture(v, at);
    const z = zoomAt(v, at, 1.5);
    const after = toPicture(z, at);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(zoomAt(v, at, 1e9).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(v, at, 1e-9).zoom).toBe(MIN_ZOOM);
  });

  it('pans with the finger', () => {
    const p = { x: 10, y: 10 };
    const moved = panBy(v, 30, -20);
    const s0 = toScreen(v, p);
    const s1 = toScreen(moved, p);
    expect(s1.x - s0.x).toBeCloseTo(30);
    expect(s1.y - s0.y).toBeCloseTo(-20);
  });

  it('fits a rectangle inside the free part of the screen', () => {
    const f = fitRect({ x: 0, y: 0, width: 1200, height: 800 }, 400, 900, { top: 50, right: 20, bottom: 50, left: 20 });
    expect(f.zoom).toBeCloseTo(360 / 1200);
    const tl = toScreen(f, { x: 0, y: 0 });
    const br = toScreen(f, { x: 1200, y: 800 });
    expect(tl.x).toBeCloseTo(20);
    expect(br.x).toBeCloseTo(380);
    expect((tl.y + br.y) / 2).toBeCloseTo(450);
  });

  it('centres a point and exposes the stage transform', () => {
    const c = centreOn(v, { x: 500, y: 500 }, 400, 800);
    expect(toScreen(c, { x: 500, y: 500 })).toEqual({ x: 200, y: 400 });
    expect(stageTransform(v)).toEqual({ x: -200, y: 100, scale: 2 });
  });

  it('bounds points', () => {
    expect(boundsOf([{ x: 1, y: 5 }, { x: -3, y: 2 }])).toEqual({ x: -3, y: 2, width: 4, height: 3 });
  });
});

describe('edgeIndicator (PS-05)', () => {
  it('is null for on-screen points', () => expect(edgeIndicator({ x: 50, y: 50 }, 100, 100, 10)).toBeNull());
  it('sits on the inset edge toward the point', () => {
    const right = edgeIndicator({ x: 500, y: 50 }, 100, 100, 10)!;
    expect(right.x).toBeCloseTo(90);
    expect(right.y).toBeCloseTo(50);
    expect(right.angle).toBeCloseTo(0);
    const below = edgeIndicator({ x: 50, y: 900 }, 100, 100, 10)!;
    expect(below.y).toBeCloseTo(90);
    expect(below.angle).toBeCloseTo(Math.PI / 2);
    const corner = edgeIndicator({ x: -500, y: -500 }, 100, 100, 10)!;
    expect(corner.x).toBeCloseTo(10);
    expect(corner.y).toBeCloseTo(10);
  });
});
