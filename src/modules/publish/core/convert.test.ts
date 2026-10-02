import { describe, expect, it } from 'vitest';
import { baseName, htmlBlocks, plain, storyTiles } from './legacy';
import { objectPosition, overlayBox, placePicture, readStudio, splitRows, studioMedia, studioTiles } from './wpStudio';
import { parseTile } from './tile';
import { hexToHsv, hsvToHex, normHex, pushRecent, withAlpha } from './colour';
import { chooseBrush, chooseColour, defaultPrefs, erasing, readPrefs, toggleEraser } from './drawPrefs';
import type { ImageElement, PaintElement, TextElement } from './types';

const mono = (s: string, size: number) => [...s].length * size * 0.5;

describe('WP Studio posts', () => {
  const v3 = {
    schema: 'wpstudio.post',
    version: 3,
    layout: { rows: [{ count: 1 }, { count: 3 }] },
    tiles: [
      {
        tileId: 'tile_001',
        width: 1080,
        height: 1350,
        backgroundColor: '#F7F4EC',
        overlay: { mediaId: 50 },
        images: [{ id: 'img_hero', mediaId: 10, x: 0, y: 0, width: 1, height: 0.5, fit: 'cover', objectPosition: '50% 0%', scale: 1, rotation: 0 }],
        textOverlays: [{ id: 'cap', text: 'Secretary Bird', x: 0.1, y: 0.8, width: 0.8, height: 0.1, fontFamily: 'Roboto Condensed', fontSize: 40, fontWeight: 650, lineHeight: 1.1, letterSpacing: 2, alignment: 'center', color: '#222222', rotation: 3 }, { text: ' ' }],
      },
      { tileId: 'tile_002', width: 1080, height: 1920, images: [{ mediaId: 11, x: 0.1, y: 0.1, width: 0.5, height: 0.5, fit: 'contain' }, { mediaId: 99 }], textOverlays: [{ content: 'Ms', fontFamily: 'Ms Madi', fontWeight: 700 }] },
      { tileId: 'tile_003', width: 1080, height: 3000 },
      { tileId: 'tile_004', width: 1080, height: 1080, backgroundColor: 'bad;' },
    ],
  };
  const photos: Record<number, { id: string; width: number; height: number }> = { 10: { id: 'm10', width: 2000, height: 1000 }, 11: { id: 'm11', width: 1000, height: 2000 } };
  const resolve = { photo: (id: number) => photos[id] ?? null };

  it('reads only WP Studio manifests', () => {
    expect(readStudio(JSON.stringify(v3))?.version).toBe(3);
    expect(readStudio('{')).toBeNull();
    expect(readStudio({ schema: 'other' })).toBeNull();
    expect(readStudio({ schema: 'wpstudio.post', version: 9 })).toBeNull();
    const single = readStudio({ schema: 'wpstudio.post', version: 2, photo: { mediaId: 5 }, overlay: { mediaId: 6 } })!;
    expect(single.tiles).toHaveLength(1);
    expect(single.rows).toEqual([1]);
    expect(studioMedia(single)).toEqual({ photos: [5], overlays: [6] });
    expect(studioMedia(readStudio(v3)!)).toEqual({ photos: [10, 11, 99], overlays: [50] });
    expect(studioMedia(readStudio({ schema: 'wpstudio.post', version: 1, background: { mediaId: 7 } })!)).toEqual({ photos: [], overlays: [7] });
  });

  it('keeps rows of one or two; longer rows split into pairs, a tile left over gets a full row', () => {
    expect(splitRows([1, 3], 4)).toEqual([[0], [1, 2], [3]]);
    expect(splitRows([2, 2], 3)).toEqual([[0, 1], [2]]);
    expect(splitRows([1], 3)).toEqual([[0], [1], [2]]);
    expect(splitRows([4], 4)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('reads focal points', () => {
    expect(objectPosition('50% 30%')).toEqual([0.5, 0.3]);
    expect(objectPosition('left bottom')).toEqual([0, 1]);
    expect(objectPosition('top')).toEqual([0.5, 0]);
    expect(objectPosition('top right')).toEqual([1, 0]);
    expect(objectPosition(undefined)).toEqual([0.5, 0.5]);
    expect(objectPosition('bogus')).toEqual([0.5, 0.5]);
  });

  it('turns cover, contain, fill and zoom into a box and a trim', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    // A 2:1 picture covering a square at its left edge.
    expect(placePicture(box, { width: 200, height: 100 }, 'cover', [0, 0.5], 1).crop).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
    // Tall picture, focal point at the bottom.
    expect(placePicture(box, { width: 100, height: 400 }, 'cover', [0.5, 1], 1).crop).toEqual({ x: 0, y: 0.75, w: 1, h: 0.25 });
    // Zoomed 2× about the middle of what shows.
    expect(placePicture(box, { width: 100, height: 100 }, 'cover', [0.5, 0.5], 2).crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    // Smaller than its box: the box shrinks about its centre.
    expect(placePicture(box, { width: 100, height: 100 }, 'cover', [0.5, 0.5], 0.5).box).toEqual({ x: 25, y: 25, w: 50, h: 50 });
    // Contain: the box becomes the picture, placed by the focal point.
    expect(placePicture(box, { width: 200, height: 100 }, 'contain', [0.5, 1], 1)).toEqual({ box: { x: 0, y: 50, w: 100, h: 50 }, crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(placePicture(box, { width: 100, height: 200 }, 'contain', [0, 0], 1).box).toEqual({ x: 0, y: 0, w: 50, h: 100 });
    // Fill (stretch) shows as a centred cover.
    expect(placePicture(box, { width: 200, height: 100 }, 'fill', [0, 0], 1).crop).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
  });

  it('fits every tile into 9:16 with its background, keeping boxes, text and layer order', () => {
    const { tiles, layout } = studioTiles(readStudio(v3)!, resolve, { postId: 7, title: 'Birds', now: new Date(0) });
    expect(tiles.map((t) => t.id)).toEqual(['wps-7-tile_001', 'wps-7-tile_002', 'wps-7-tile_003', 'wps-7-tile_004']);
    expect(layout).toEqual([
      { kind: 'full', id: 'wps-7-tile_001' },
      { kind: 'half', left: 'wps-7-tile_002', right: 'wps-7-tile_003' },
      { kind: 'full', id: 'wps-7-tile_004' },
    ]);
    for (const t of tiles) parseTile(t);
    const [a, b, c, d] = tiles;
    expect(a.meta.legacy).toBe('wpstudio');
    expect(a.name).toBe('Birds · 1');
    expect(a.canvas.background).toBe('#F7F4EC');
    expect(d.canvas.background).toBe('#f7f4ec');
    expect(a.elements.map((e) => e.kind)).toEqual(['paint', 'image', 'text']);
    // 1080 × 1350 fits by width, centred: 285 px above and below.
    const paint = a.elements[0] as PaintElement;
    expect(paint.assetId).toBe('wp:50');
    expect(overlayBox(paint)).toEqual({ x: 0, y: 285, w: 1080, h: 1350 });
    const img = a.elements[1] as ImageElement;
    expect(img.mediaId).toBe('m10');
    expect(img.y * 1920).toBeCloseTo(285);
    expect(img.h * 1920).toBeCloseTo(675);
    expect(img.crop.w).toBeCloseTo(0.8);
    const txt = a.elements[2] as TextElement;
    expect(txt).toMatchObject({ font: 'Roboto', weight: 700, size: 40, letterSpacing: 2, align: 'center', color: '#222222', rotation: 3, lineHeight: 1.1 });
    expect(txt.y * 1920).toBeCloseTo(285 + 0.8 * 1350);
    // Missing pictures are left out; Ms Madi has one weight.
    expect(b.elements.map((e) => e.kind)).toEqual(['image', 'text']);
    expect(b.elements[1]).toMatchObject({ font: 'Ms Madi', weight: 400, text: 'Ms' });
    // Taller than 9:16: fitted by height, scaled.
    expect(c.elements).toEqual([]);
    expect(d.elements).toEqual([]);
  });

  it('converts v1 and v2 tiles', () => {
    const v2 = readStudio({ schema: 'wpstudio.post', version: 2, width: 1080, height: 1920, photo: { mediaId: 10, fit: 'cover', objectPosition: 'center', scale: 1, rotation: 90 }, overlay: { mediaId: 6 }, textOverlays: [{ text: 'Hi', fontSize: 30 }] })!;
    const t = studioTiles(v2, resolve, { postId: 1, title: '' }).tiles[0];
    expect(t.name).toBe('Imported · 1');
    expect(t.elements.map((e) => e.kind)).toEqual(['image', 'paint', 'text']);
    expect(t.elements[0]).toMatchObject({ x: 0, y: 0, w: 1, h: 1, rotation: 90 });
    const v1 = readStudio({ schema: 'wpstudio.post', version: 1, tiles: [{ tileId: 'a', width: 540, height: 960, background: { mediaId: 7 }, textOverlays: [{ text: 'x', fontSize: 20, letterSpacing: 1 }] }, { tileId: 'a' }] })!;
    const [one] = studioTiles(v1, resolve, { postId: 1, title: 'T' }).tiles;
    expect(one.elements.map((e) => e.kind)).toEqual(['paint', 'text']);
    // A half-size tile scales its type 2×.
    expect(one.elements[1]).toMatchObject({ size: 40, letterSpacing: 2 });
  });
});

describe('ordinary posts', () => {
  it('reads the body as blocks in order', () => {
    const html = [
      '<h2>Head&#8217;s</h2>',
      '<p>One&nbsp;&amp; <b>two</b></p>',
      '<figure class="wp-block-image"><img class="wp-image-12" src="a.jpg"><figcaption>Cap <i>a</i></figcaption></figure>',
      '<figure class="wp-block-gallery"><figure><img class="wp-image-13" src="b.jpg"></figure><figure><img src="c-300x200.jpg"><figcaption>C</figcaption></figure></figure>',
      '<ul><li>first</li><li>second</li></ul>',
      '<blockquote><p>Quoted</p><p>twice</p></blockquote>',
      '<p><img class="wp-image-14" src="d.jpg">After</p>',
      '<figure><span>no picture</span></figure>',
      '<script>bad()</script>',
      '\n\nLoose text\n\nMore loose',
      '<img alt="no src">',
      '<p> </p>',
    ].join('');
    expect(htmlBlocks(html)).toEqual([
      { kind: 'heading', text: 'Head’s' },
      { kind: 'para', text: 'One & two' },
      { kind: 'image', id: 12, src: 'a.jpg', caption: 'Cap a' },
      { kind: 'image', id: 13, src: 'b.jpg', caption: '' },
      { kind: 'image', id: null, src: 'c-300x200.jpg', caption: 'C' },
      { kind: 'item', text: 'first' },
      { kind: 'item', text: 'second' },
      { kind: 'quote', text: 'Quoted\ntwice' },
      { kind: 'image', id: 14, src: 'd.jpg', caption: '' },
      { kind: 'para', text: 'After' },
      { kind: 'para', text: 'no picture' },
      { kind: 'para', text: 'Loose text' },
      { kind: 'para', text: 'More loose' },
    ]);
    expect(htmlBlocks('Classic text\n\nSecond <a href="x">link</a>')).toEqual([
      { kind: 'para', text: 'Classic text' },
      { kind: 'para', text: 'Second link' },
    ]);
    expect(plain('a<br>b &hellip; &ldquo;q&rdquo; &lsquo;s&rsquo; &ndash; &mdash; &lt;&gt;&quot;&#039;')).toBe('a\nb … “q” ‘s’ – — <>"’');
    expect(baseName('https://x.test/up/My%20pic-300x200.jpg?v=1')).toBe('My pic');
    expect(baseName('big-scaled.jpg')).toBe('big');
  });

  it('makes a cover, a tile per picture with its caption, and reading tiles', () => {
    const tiles = storyTiles(
      {
        title: 'Old trip',
        featured: { mediaId: 'f', width: 400, height: 300 },
        blocks: [
          { kind: 'heading', text: 'Day one' },
          { kind: 'para', text: 'Words '.repeat(400) },
          { kind: 'image', mediaId: 'p', width: 300, height: 600, caption: 'The harbour' },
          { kind: 'item', text: 'a list item' },
          { kind: 'quote', text: 'quoted' },
          { kind: 'para', text: ' ' },
          { kind: 'image', mediaId: 'q', width: 300, height: 300 },
        ],
      },
      mono,
    );
    const names = tiles.map((t) => t.name);
    expect(names[0]).toBe('Old trip · cover');
    expect(names).toContain('Old trip · picture 1');
    expect(names.filter((n) => n.includes('text')).length).toBeGreaterThan(1);
    expect(tiles[0].elements.map((e) => e.kind)).toEqual(['image', 'text']);
    expect(tiles[0].elements[1]).toMatchObject({ text: 'Old trip', weight: 700 });
    const pic = tiles.find((t) => t.name.endsWith('picture 1'))!;
    expect(pic.elements[1]).toMatchObject({ text: 'The harbour', align: 'center' });
    const after = tiles[tiles.indexOf(pic) + 1];
    expect((after.elements[0] as TextElement).text).toBe('• a list item');
    expect((after.elements[1] as TextElement).text).toBe('“quoted”');
    expect(tiles[tiles.length - 1].elements).toHaveLength(1);
    for (const t of tiles) {
      expect(t.meta.legacy).toBe('wp');
      parseTile(t);
      for (const e of t.elements) expect(e.y + e.h).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(storyTiles({ title: '', blocks: [] }, mono)).toEqual([]);
    expect(storyTiles({ title: 'Only', blocks: [] }, mono)[0].elements).toHaveLength(1);
  });

  it('reads old tiles marked by 0.17', () => {
    const t = storyTiles({ title: 'x', blocks: [] }, mono)[0];
    expect(parseTile({ ...t, meta: { legacy: true } }).meta.legacy).toBe('wp');
    expect(parseTile({ ...t, meta: { legacy: false } }).meta.legacy).toBeUndefined();
  });
});

describe('colours', () => {
  it('converts between hex and HSV both ways', () => {
    expect(normHex('#ABC')).toBe('#aabbcc');
    expect(normHex('12aB34')).toBe('#12ab34');
    expect(normHex('red')).toBeNull();
    for (const c of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#f7f4ec', '#1f2a36', '#d6336c', '#ff00ff']) expect(hsvToHex(hexToHsv(c))).toBe(c);
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('nope')).toEqual({ h: 0, s: 0, v: 0 });
    expect(pushRecent(['#a', '#b', '#c'], '#b', 2)).toEqual(['#b', '#a']);
  });
});

describe('drawing settings', () => {
  const ids = ['pen', 'pencil', 'marker', 'eraser'];
  it('reads saved settings defensively', () => {
    expect(readPrefs(null, ids)).toEqual(defaultPrefs());
    const p = readPrefs({ preset: 'pencil', size: 4, opacity: 9, color: '#ABC', recent: ['#ff0000', 'bad', 3], lastBrush: 'eraser', showTile: false, grid: true }, ids);
    expect(p).toMatchObject({ preset: 'pencil', size: 4, opacity: 4, color: '#aabbcc', lastBrush: 'pen', showTile: false, grid: true });
    expect(p.recent).toHaveLength(5);
    expect(p.recent[0]).toBe('#ff0000');
    expect(readPrefs({ preset: 'nope', color: 'red' }, ids)).toMatchObject({ preset: 'pen', color: '#111111' });
  });
  it('switches to the eraser and back, each with its own size', () => {
    const p = { ...defaultPrefs(), preset: 'marker', size: 1, eraserSize: 4 };
    const e = toggleEraser(p);
    expect(e).toMatchObject({ preset: 'eraser', size: 4, lastBrush: 'marker', brushSize: 1 });
    expect(erasing(e)).toBe(true);
    const back = toggleEraser({ ...e, size: 3 });
    expect(back).toMatchObject({ preset: 'marker', size: 1, eraserSize: 3 });
    expect(chooseBrush(e, 'pencil')).toMatchObject({ preset: 'pencil', size: 1, lastBrush: 'pencil' });
    expect(chooseBrush(p, 'pen')).toMatchObject({ preset: 'pen', size: 1 });
  });
  it('keeps the five most recent colours and leaves the eraser on a colour', () => {
    const p = chooseColour(toggleEraser(defaultPrefs()), '#1C7ED6');
    expect(p.color).toBe('#1c7ed6');
    expect(p.preset).toBe('pen');
    expect(p.recent).toEqual(['#1c7ed6', '#111111', '#c92a2a', '#2b8a3e', '#5f3dc4']);
    expect(chooseColour(p, 'nope').color).toBe('#1c7ed6');
    expect(withAlpha('#ff0000', 0.4)).toBe('rgba(255, 0, 0, 0.4)');
  });
});
