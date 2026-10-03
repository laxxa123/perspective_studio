import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS, defaultGuides, gridPreset } from './presets';
import { StrokeBuilder, dabAt } from './stroke';
import {
  IDENTITY_SEL,
  actualSizeView,
  applyMatrix,
  fitView,
  guideHandles,
  guideSegments,
  moveGuide,
  pinch,
  pointInPolygon,
  polygonBounds,
  selMatrix,
  tileRect,
  tileXY,
  tilesInRect,
  toDoc,
  toScreen,
  unionRect,
  zoomAt,
  MAX_SCALE,
  clipSegment,
  pageGuideSegments,
} from './geometry';
import { createDocument, insertLayer, moveLayer, newLayer, nextLayerName, parseDocument, patchLayer, removeLayer, activeLayer, touch } from './document';
import type { BrushPreset, InputPoint } from './types';
import { DOC_H, DOC_W, MAX_LAYERS, TILES_X, TILES_Y } from './types';

const preset = (id: string) => DEFAULT_PRESETS.find((p) => p.id === id)!;
const pt = (x: number, y: number, t: number, pressure = 1): InputPoint => ({ x, y, pressure, tilt: 0, azimuth: 0, t });

describe('stroke builder', () => {
  it('a tap leaves one dab', () => {
    const b = new StrokeBuilder(preset('pen'), { sizeScale: 1 });
    const d = b.add([pt(100, 100, 0)]);
    expect(d).toHaveLength(1);
    expect(b.end()).toHaveLength(0);
    expect(b.current).toEqual(d[0]);
  });

  it('places dabs evenly along a straight line', () => {
    const p: BrushPreset = { ...preset('pen'), smoothing: 0, pressureSize: 0, velocity: 0, spacing: 0.1, size: 20 };
    const b = new StrokeBuilder(p, { sizeScale: 1 });
    const dabs = [...b.add(Array.from({ length: 21 }, (_, i) => pt(100 + i * 10, 200, i * 8))), ...b.end()];
    for (let i = 2; i < dabs.length; i++) {
      const gap = Math.hypot(dabs[i].x - dabs[i - 1].x, dabs[i].y - dabs[i - 1].y);
      expect(gap).toBeGreaterThan(1.5);
      expect(gap).toBeLessThan(2.5);
    }
    // The stroke reaches the pen's last point.
    expect(dabs[dabs.length - 1].x).toBeGreaterThan(295);
    expect(b.dabCount).toBe(dabs.length);
    expect(b.bounds.x0).toBeLessThan(100);
    expect(b.bounds.x1).toBeGreaterThan(300);
  });

  it('smoothing lags behind the pen and end() catches up', () => {
    const p = { ...preset('pen'), smoothing: 0.9 };
    const b = new StrokeBuilder(p, { sizeScale: 1 });
    const mid = b.add([pt(0, 0, 0), pt(100, 0, 16), pt(200, 0, 32)]);
    expect(mid[mid.length - 1].x).toBeLessThan(150);
    const tail = b.end();
    expect(tail[tail.length - 1].x).toBeCloseTo(200, 0);
  });

  it('pressure scales size; size scale and opacity dynamics', () => {
    const p = preset('pen');
    const s = { x: 0, y: 0, pressure: 0.2, tilt: 0, azimuth: 0, t: 0, v: 0 };
    const light = dabAt(p, { sizeScale: 1 }, s, 0);
    const hard = dabAt(p, { sizeScale: 1 }, { ...s, pressure: 1 }, 0);
    expect(light.size).toBeLessThan(hard.size);
    expect(dabAt(p, { sizeScale: 2 }, { ...s, pressure: 1 }, 0).size).toBeCloseTo(hard.size * 2);
    const pencil = preset('pencil');
    expect(dabAt(pencil, { sizeScale: 1 }, s, 0).alpha).toBeLessThan(dabAt(pencil, { sizeScale: 1 }, { ...s, pressure: 1 }, 0).alpha);
  });

  it('velocity and tilt dynamics', () => {
    const pen = preset('pen');
    const s = { x: 0, y: 0, pressure: 1, tilt: 0, azimuth: 1, t: 0, v: 0 };
    expect(dabAt(pen, { sizeScale: 1 }, { ...s, v: 3 }, 0).size).toBeLessThan(dabAt(pen, { sizeScale: 1 }, s, 0).size);
    const pencil = preset('pencil');
    const tilted = dabAt(pencil, { sizeScale: 1 }, { ...s, tilt: 0.8 }, 0);
    expect(tilted.size).toBeGreaterThan(dabAt(pencil, { sizeScale: 1 }, s, 0).size);
    expect(tilted.angle).toBe(1);
    expect(tilted.roundness).toBeLessThan(1);
    const follow = dabAt({ ...pen, followStroke: true, rotation: 0 }, { sizeScale: 1 }, s, 0.5);
    expect(follow.angle).toBeCloseTo(0.5);
  });

  it('ignores jitter below a quarter pixel', () => {
    const b = new StrokeBuilder(preset('pen'), { sizeScale: 1 });
    b.add([pt(10, 10, 0)]);
    expect(b.add([pt(10.1, 10, 5)])).toHaveLength(0);
  });
});

describe('tiles', () => {
  it('covers the canvas', () => {
    expect(TILES_X * 256).toBeGreaterThanOrEqual(DOC_W);
    expect(TILES_Y * 256).toBeGreaterThanOrEqual(DOC_H);
    const last = TILES_X * TILES_Y - 1;
    expect(tileXY(last)).toEqual({ tx: TILES_X - 1, ty: TILES_Y - 1 });
    expect(tileRect(last)).toEqual({ x0: (TILES_X - 1) * 256, y0: (TILES_Y - 1) * 256, x1: DOC_W, y1: DOC_H });
  });
  it('finds the tiles a rectangle touches, clipped', () => {
    expect(tilesInRect({ x0: 10, y0: 10, x1: 20, y1: 20 })).toEqual([0]);
    expect(tilesInRect({ x0: 250, y0: 250, x1: 260, y1: 260 })).toEqual([0, 1, TILES_X, TILES_X + 1]);
    expect(tilesInRect({ x0: -100, y0: -100, x1: 5000, y1: 5000 })).toHaveLength(TILES_X * TILES_Y);
    expect(tilesInRect({ x0: 0, y0: 0, x1: 256, y1: 256 })).toEqual([0]);
  });
  it('unions rectangles', () => {
    expect(unionRect(null, { x0: 1, y0: 2, x1: 3, y1: 4 })).toEqual({ x0: 1, y0: 2, x1: 3, y1: 4 });
    expect(unionRect({ x0: 0, y0: 5, x1: 3, y1: 6 }, { x0: 1, y0: 2, x1: 9, y1: 4 })).toEqual({ x0: 0, y0: 2, x1: 9, y1: 6 });
  });
});

describe('view', () => {
  it('fits the 9:16 canvas', () => {
    const v = fitView(400, 800, 0);
    expect(v.scale).toBeCloseTo(400 / DOC_W);
    expect(toScreen(v, { x: DOC_W / 2, y: DOC_H / 2 })).toEqual({ x: 200, y: 400 });
  });
  it('round-trips screen ↔ document', () => {
    const v = { scale: 0.7, x: 12, y: -40 };
    const d = toDoc(v, { x: 100, y: 200 });
    expect(toScreen(v, d).x).toBeCloseTo(100);
    expect(toScreen(v, d).y).toBeCloseTo(200);
  });
  it('100% maps one document pixel to one device pixel', () => {
    const v = actualSizeView(fitView(400, 800), 400, 800, 2);
    expect(v.scale).toBe(0.5);
  });
  it('pinch keeps the anchor under the fingers and zooms by the distance ratio', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const v = pinch(start, { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 110, y: 120 }, { x: 310, y: 120 });
    expect(v.scale).toBeCloseTo(2);
    const anchor = toDoc(v, { x: 210, y: 120 });
    expect(anchor.x).toBeCloseTo(150);
    expect(anchor.y).toBeCloseTo(100);
    expect(zoomAt(start, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE);
    const z = zoomAt(start, { x: 50, y: 50 }, 2);
    expect(toDoc(z, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });
});

describe('guides', () => {
  it('3×3 has four lines, none has none', () => {
    expect(guideSegments(gridPreset(defaultGuides(), 'thirds'))).toHaveLength(4);
    expect(guideSegments(defaultGuides())).toHaveLength(0);
    expect(guideHandles(defaultGuides())).toHaveLength(0);
  });
  it('perspective grids have a horizon and fans through each VP', () => {
    for (const [type, vps] of [
      ['1pt', 1],
      ['2pt', 2],
      ['3pt', 3],
    ] as const) {
      const g = gridPreset(defaultGuides(), type);
      const segs = guideSegments(g);
      expect(segs[0][1]).toBe(g.horizonY);
      expect(segs.length).toBeGreaterThan(g.density * vps);
      expect(guideHandles(g)).toHaveLength(vps);
      // Every ray starts at a vanishing point.
      const starts = new Set(segs.slice(1).map((s) => `${s[0]},${s[1]}`));
      expect(starts.has(`${g.vp1.x},${g.vp1.y}`)).toBe(true);
    }
  });
  it('dragging a VP on the horizon moves the horizon and the other VP', () => {
    const g = gridPreset(defaultGuides(), '2pt');
    const m = moveGuide(g, 'vp1', { x: 10, y: 500 });
    expect(m.horizonY).toBe(500);
    expect(m.vp2.y).toBe(500);
    expect(m.vp1).toEqual({ x: 10, y: 500 });
    const h = moveGuide(g, 'horizon', { x: 0, y: 900 });
    expect(h.vp1.y).toBe(900);
    const v3 = moveGuide(gridPreset(g, '3pt'), 'vp3', { x: 1, y: 2 });
    expect(v3.vp3).toEqual({ x: 1, y: 2 });
    expect(v3.horizonY).toBe(g.horizonY);
  });
});

describe('guide clipping', () => {
  it('clips segments to the page and drops misses', () => {
    const r = { x0: 0, y0: 0, x1: 100, y1: 100 };
    expect(clipSegment([-50, 50, 150, 50], r)).toEqual([0, 50, 100, 50]);
    expect(clipSegment([10, 10, 20, 20], r)).toEqual([10, 10, 20, 20]);
    expect(clipSegment([-10, -10, -5, 50], r)).toBeNull();
    expect(clipSegment([200, 0, 200, 50], r)).toBeNull();
    expect(clipSegment([50, -50, 50, 150], r)).toEqual([50, 0, 50, 100]);
    const g = gridPreset(defaultGuides(), '2pt');
    for (const s of pageGuideSegments(g)) for (const v of s) expect(v).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe('selection maths', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('bounds and containment', () => {
    expect(polygonBounds(square)).toEqual({ x0: 0, y0: 0, x1: 10, y1: 10 });
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
  it('transform matrix rotates and scales about the centre', () => {
    const c = { x: 5, y: 5 };
    expect(applyMatrix(selMatrix(IDENTITY_SEL, c), { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
    const m = selMatrix({ dx: 1, dy: 2, scale: 2, rotation: Math.PI / 2 }, c);
    const p = applyMatrix(m, { x: 6, y: 5 });
    expect(p.x).toBeCloseTo(6);
    expect(p.y).toBeCloseTo(9);
    expect(applyMatrix(m, c).x).toBeCloseTo(6);
  });
});

describe('document', () => {
  it('creates a valid document that round-trips through JSON', () => {
    const d = createDocument('Test');
    expect(parseDocument(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(activeLayer(d).name).toBe('Layer 1');
  });
  it('rejects malformed documents and repairs the active layer', () => {
    const d = createDocument();
    expect(() => parseDocument({ ...d, layers: [] })).toThrow();
    expect(() => parseDocument({ ...d, schema: 'x' })).toThrow();
    expect(() => parseDocument({ ...d, layers: [d.layers[0], d.layers[0]] })).toThrow();
    expect(parseDocument({ ...d, activeLayer: 'gone' }).activeLayer).toBe(d.layers[0].id);
  });
  it('adds, moves, patches and removes layers', () => {
    let d = createDocument();
    const a = d.layers[0].id;
    d = insertLayer(d, newLayer(nextLayerName(d)));
    expect(d.layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 2']);
    expect(d.activeLayer).toBe(d.layers[1].id);
    const b = d.layers[1].id;
    d = moveLayer(d, b, 0);
    expect(d.layers[0].id).toBe(b);
    expect(moveLayer(d, b, 0)).toBe(d);
    expect(moveLayer(d, 'nope', 0)).toBe(d);
    d = patchLayer(d, a, { opacity: 0.5, blend: 'multiply' });
    expect(d.layers[1].opacity).toBe(0.5);
    expect(patchLayer(d, 'nope', { opacity: 0 })).toBe(d);
    d = removeLayer(d, b);
    expect(d.layers).toHaveLength(1);
    expect(d.activeLayer).toBe(a);
    expect(removeLayer(d, a)).toBe(d);
    expect(removeLayer(d, 'nope')).toBe(d);
  });
  it('caps the number of layers', () => {
    let d = createDocument();
    for (let i = 0; i < MAX_LAYERS + 3; i++) d = insertLayer(d, newLayer(nextLayerName(d)));
    expect(d.layers).toHaveLength(MAX_LAYERS);
    expect(new Set(d.layers.map((l) => l.name)).size).toBe(MAX_LAYERS);
  });
  it('touch updates the edit time', () => {
    const d = createDocument('x', 'white', new Date(0));
    expect(touch(d, new Date(1000)).updatedAt).toBe(new Date(1000).toISOString());
  });
});

describe('cube net grid and soft snap (SKETCH §13)', () => {
  it('draws a 4 × 4 square, six lettered faces and a dot grid on each face', async () => {
    const { cubeDots, cubeLetters, cubeOutline, CUBE_CELL, CUBE_FACES } = await import('./grids');
    const g = { ...gridPreset(defaultGuides(), 'cube'), visible: true };
    expect(guideSegments(g)).toHaveLength(10);
    expect(guideHandles(g)).toEqual([]);
    expect(CUBE_FACES.map((f) => f[2]).join('')).toBe('ABCDEF');
    expect(CUBE_CELL).toBe(250);
    // 6 faces × 4 edges, shared edges once: 24 − 5.
    expect(cubeOutline()).toHaveLength(19);
    expect(cubeLetters().length).toBeGreaterThan(20);
    // The cross: 17 × 5 across, 20 above, 20 below.
    expect(cubeDots()).toHaveLength(125);
    expect(cubeDots()).toContainEqual({ x: 40, y: 710 });
  });

  it('snaps only near a point, and only on a visible grid that has points', async () => {
    const { nearestSnap, snapPoints, thirdsPoints } = await import('./grids');
    const cube = { ...gridPreset(defaultGuides(), 'cube'), visible: true };
    const pts = snapPoints(cube);
    expect(nearestSnap(pts, { x: 45, y: 705 }, 20)).toEqual({ x: 40, y: 710 });
    expect(nearestSnap(pts, { x: 70, y: 740 }, 20)).toBeNull();
    expect(snapPoints({ ...cube, visible: false })).toEqual([]);
    expect(snapPoints({ ...cube, type: '2pt' })).toEqual([]);
    expect(snapPoints({ ...cube, type: 'thirds' })).toBe(thirdsPoints());
    expect(thirdsPoints()).toHaveLength(36);
    expect(thirdsPoints()).toContainEqual({ x: 360, y: 640 });
  });

  it('default colours: black, white, light grey, red and the current colour (or blue)', async () => {
    const { defaultFive } = await import('./presets');
    expect(defaultFive('#7048E8')).toEqual(['#000000', '#ffffff', '#cccccc', '#e03131', '#7048e8']);
    expect(defaultFive('#000000')).toEqual(['#000000', '#ffffff', '#cccccc', '#e03131', '#1c7ed6']);
  });
});
