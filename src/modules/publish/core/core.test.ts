import { describe, expect, it } from 'vitest';
import { addElement, assetsOf, createTile, duplicateElement, duplicateTile, imageFor, mediaOf, paintFor, parseTile, removeElement, restack, spiralFor, textFor, updateElement, fontStack } from './tile';
import { bounds, boxForCrop, canonicalName, clampCrop, cropToAspect, layoutSpiral, pxBox, renameCanonical, slug, snapEdges, snapMove, snapTargets, textHeight, wrapText } from './layout';
import { MARGIN, TILE_H, TILE_W, type TextElement } from './types';

const mono = (s: string, size: number) => [...s].length * size * 0.5;

describe('tiles', () => {
  it('creates a valid 9:16 tile that round-trips through JSON', () => {
    let t = createTile('One');
    t = addElement(t, textFor());
    t = addElement(t, imageFor({ id: 'm1', width: 4000, height: 3000 }));
    t = addElement(t, spiralFor());
    t = addElement(t, paintFor('a1'));
    expect(t.canvas).toMatchObject({ width: 1080, height: 1920 });
    expect(parseTile(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(mediaOf(t)).toEqual(['m1']);
    expect(assetsOf(t)).toEqual(['a1']);
    expect(fontStack('Ms Madi')).toContain('Ms Madi');
  });
  it('rejects malformed tiles', () => {
    const t = addElement(createTile(), textFor());
    expect(() => parseTile({ ...t, schema: 'x' })).toThrow();
    expect(() => parseTile({ ...t, elements: [t.elements[0], t.elements[0]] })).toThrow();
    expect(() => parseTile({ ...t, canvas: { ...t.canvas, width: 500 } })).toThrow();
  });
  it('fits new pictures inside the tile, keeping their aspect', () => {
    const wide = imageFor({ id: 'a', width: 3000, height: 1000 });
    expect(wide.w).toBeCloseTo(0.8);
    expect((wide.w * TILE_W) / (wide.h * TILE_H)).toBeCloseTo(3);
    const tall = imageFor({ id: 'b', width: 1000, height: 4000 });
    expect(tall.h).toBeCloseTo(0.7);
    expect((tall.w * TILE_W) / (tall.h * TILE_H)).toBeCloseTo(0.25);
  });
  it('edits, restacks, duplicates and removes', () => {
    let t = createTile();
    const a = textFor('a');
    const b = textFor('b');
    t = addElement(addElement(t, a), b);
    t = updateElement<TextElement>(t, a.id, { text: 'A' });
    expect((t.elements[0] as TextElement).text).toBe('A');
    t = restack(t, a.id, 'top');
    expect(t.elements[1].id).toBe(a.id);
    expect(restack(t, a.id, 1)).toBe(t);
    expect(restack(t, 'nope', 1)).toBe(t);
    t = restack(t, a.id, 'bottom');
    expect(t.elements[0].id).toBe(a.id);
    t = restack(t, a.id, 1);
    expect(t.elements[1].id).toBe(a.id);
    const d = duplicateElement(t, b.id);
    expect(d.tile.elements).toHaveLength(3);
    expect(d.tile.elements[1].id).toBe(d.id);
    expect(duplicateElement(t, 'nope').id).toBeNull();
    t = removeElement(d.tile, b.id);
    expect(t.elements.map((e) => e.id)).not.toContain(b.id);
    const copy = duplicateTile(t, new Date(5));
    expect(copy.id).not.toBe(t.id);
    expect(copy.name).toMatch(/copy$/);
    expect(copy.elements).toEqual(t.elements);
  });
});

describe('snapping', () => {
  it('snaps a moving box to the centre line and margins', () => {
    const t = snapTargets([]);
    const s = snapMove({ x0: 100, y0: 300, x1: 300, y1: 400 }, t, 10);
    expect(s.dx).toBe(0);
    expect(s.gx).toBeNull();
    const c = snapMove({ x0: 437, y0: 57, x1: 637, y1: 157 }, t, 10);
    expect(c.dx).toBe(3); // centre 537 → 540
    expect(c.gx).toBe(540);
    expect(c.dy).toBe(-3); // top 57 → margin 54
    expect(c.gy).toBe(MARGIN);
  });
  it('snaps to other elements and only the dragged edges when resizing', () => {
    const other = { ...textFor(), x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 0 };
    const t = snapTargets([other]);
    expect(t.xs).toContain(540 + 216);
    const r = snapEdges({ x0: 100, y0: 100, x1: 752, y1: 300 }, t, 8, { right: true });
    expect(r.x1).toBe(756);
    expect(r.x0).toBe(100);
    expect(r.gx).toBe(756);
    const r2 = snapEdges({ x0: 52, y0: 958, x1: 300, y1: 1918 }, t, 8, { left: true, top: true, bottom: true });
    expect([r2.x0, r2.y0, r2.y1]).toEqual([MARGIN, 960, 1920]);
  });
  it('measures rotated bounds', () => {
    const e = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 * (TILE_W / TILE_H), rotation: 90 };
    const b = bounds(e);
    const p = pxBox(e);
    expect(b.x1 - b.x0).toBeCloseTo(p.y1 - p.y0);
    expect(bounds({ ...e, rotation: 0 })).toEqual(p);
  });
});

describe('text', () => {
  it('wraps words to the width and keeps line breaks', () => {
    expect(wrapText('aaaa bbbb cccc', 100, 20, 0, mono)).toEqual(['aaaa bbbb', 'cccc']);
    expect(wrapText('one\n\ntwo', 1000, 20, 0, mono)).toEqual(['one', '', 'two']);
    expect(wrapText('superlongword x', 50, 20, 0, mono)).toEqual(['superlongword', 'x']);
    expect(textHeight(3, 40, 1.5)).toBe(180);
    expect(textHeight(0, 40, 1)).toBe(40);
  });
});

describe('spiral', () => {
  const p = { text: 'Words turning inward one after another', size: 20, letterSpacing: 0, turns: 3, innerScale: 1, rotationOffset: 0 };
  it('starts at the top edge, coils inward and is deterministic', () => {
    const g = layoutSpiral(p, 400, 400, mono);
    expect(g.length).toBeGreaterThan(20);
    expect(g[0].y).toBeLessThan(40);
    expect(Math.abs(g[0].x - 200)).toBeLessThan(30);
    const r = (q: { x: number; y: number }) => Math.hypot(q.x - 200, q.y - 200);
    expect(r(g[g.length - 1])).toBeLessThan(r(g[0]));
    expect(layoutSpiral(p, 400, 400, mono)).toEqual(g);
    // The first glyph runs clockwise (to the right at the top).
    expect(Math.cos(g[0].angle)).toBeGreaterThan(0.9);
  });
  it('scales inner glyphs down and drops text that does not fit', () => {
    const g = layoutSpiral({ ...p, innerScale: 0.4 }, 400, 400, mono);
    expect(g[g.length - 1].size).toBeLessThan(g[0].size);
    expect(g[0].size).toBeCloseTo(20, 0);
    const long = layoutSpiral({ ...p, text: 'x'.repeat(5000) }, 200, 200, mono);
    expect(long.length).toBeLessThan(5000);
    const turned = layoutSpiral({ ...p, rotationOffset: 90 }, 400, 400, mono);
    expect(turned[0].x).toBeGreaterThan(350);
  });
});

describe('trims and names', () => {
  it('crops to an aspect around the current centre, inside the picture', () => {
    const c = cropToAspect({ x: 0, y: 0, w: 1, h: 1 }, 1, { width: 4000, height: 2000 });
    expect(c).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(cropToAspect(c, null, { width: 1, height: 1 })).toBe(c);
    const edge = cropToAspect({ x: 0.9, y: 0, w: 0.1, h: 1 }, 1, { width: 4000, height: 2000 });
    expect(edge.x + edge.w).toBeCloseTo(1);
    expect(clampCrop({ x: -1, y: 0.99, w: 2, h: 0.001 })).toEqual({ x: 0, y: 0.96, w: 1, h: 0.04 });
  });
  it('keeps width and centre after a trim, height follows the crop', () => {
    const e = imageFor({ id: 'm', width: 2000, height: 2000 });
    const t = boxForCrop(e, { x: 0, y: 0, w: 1, h: 0.5 }, { width: 2000, height: 2000 });
    expect(t.w).toBe(e.w);
    expect((t.w * TILE_W) / (t.h * TILE_H)).toBeCloseTo(2);
    expect(t.y + t.h / 2).toBeCloseTo(e.y + e.h / 2);
  });
  it('gives stable canonical names', () => {
    const d = new Date('2026-10-01T10:00:00Z');
    expect(canonicalName('IMG_2041 Harbour Sunset.JPG', 'abcdef123456', 'image/jpeg', d)).toBe('img-2041-harbour-sunset-20261001-abcdef.jpg');
    expect(canonicalName('???.png', 'a1b2c3d4', 'image/png', d)).toBe('image-20261001-a1b2c3.png');
    expect(renameCanonical('img-2041-20261001-abcdef.jpg', 'Café terrace')).toBe('cafe-terrace-20261001-abcdef.jpg');
    expect(renameCanonical('odd.jpg', 'x')).toBe('odd.jpg');
    expect(slug('  Hello,   World!  ')).toBe('hello-world');
  });
});

describe('drawing tiles', () => {
  it('splits straight-alpha pixels into premultiplied engine tiles, skipping empty ones', async () => {
    const { toEngineTiles, hasInk } = await import('./paintTiles');
    const w = 1080;
    const h = 1920;
    const px = new Uint8ClampedArray(w * h * 4);
    expect(hasInk(px)).toBe(false);
    expect(toEngineTiles(px, w, h)).toHaveLength(0);
    // A half-transparent red pixel at (300, 10) → tile 1, premultiplied.
    const i = (10 * w + 300) * 4;
    px.set([255, 0, 0, 128], i);
    // And one in the clipped last column of tiles (x 1079).
    px.set([0, 0, 255, 255], (1900 * w + 1079) * 4);
    expect(hasInk(px)).toBe(true);
    const tiles = toEngineTiles(px, w, h);
    expect(tiles.map((t) => t.index)).toEqual([1, 7 * 5 + 4]);
    const o = (10 * 256 + (300 - 256)) * 4;
    expect([...tiles[0].data.slice(o, o + 4)]).toEqual([128, 0, 0, 128]);
  });
});
