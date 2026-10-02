import { describe, expect, it } from 'vitest';
import { drop, fromOrder, locate, order, reconcile, remove, rowCounts, type Layout } from './postLayout';
import { crc32, readId, stampId, uidFromHash } from './imageId';
import { buildPostMeta, parsePostMeta, pickFeatured, postContent, refsOf, tilesFromPost, type MediaRef, type Resolved } from './postMeta';
import { htmlImages, htmlParagraphs, legacyTiles } from './legacy';
import { publishName, renameCanonical } from './layout';
import { addElement, createTile, imageFor, paintFor, spiralFor, textFor } from './tile';
import type { TileDocument } from './types';

const mono = (s: string, size: number) => [...s].length * size * 0.5;
const full = (id: string) => ({ kind: 'full' as const, id });
const half = (left: string | null, right: string | null) => ({ kind: 'half' as const, left, right });

describe('post layout', () => {
  const l: Layout = fromOrder(['a', 'b', 'c']);
  it('reads and keeps order in step with the tiles', () => {
    expect(order([full('a'), half('b', null), half(null, 'c')])).toEqual(['a', 'b', 'c']);
    expect(reconcile([full('a'), half('b', 'x'), half('y', null)], ['a', 'b', 'n'])).toEqual([full('a'), half('b', null), full('n')]);
    expect(rowCounts([full('a'), half('b', 'c')])).toEqual([1, 2]);
  });
  it('removes and locates', () => {
    expect(remove([full('a'), half('b', 'c'), half('d', null)], 'b')).toEqual([full('a'), half(null, 'c'), half('d', null)]);
    expect(remove([half('d', null)], 'd')).toEqual([]);
    expect(locate([full('a'), half('b', 'c')], 'c')).toEqual({ row: 1, side: 'right' });
    expect(locate([full('a'), half('b', 'c')], 'b')).toEqual({ row: 1, side: 'left' });
    expect(locate(l, 'a')).toEqual({ row: 0, side: 'full' });
    expect(locate(l, 'z')).toBeNull();
  });
  it('splits a full row when a tile is dropped on a half', () => {
    expect(drop(l, 'c', 0, 'right')).toEqual([half('a', 'c'), full('b')]);
    expect(drop(l, 'c', 0, 'left')).toEqual([half('c', 'a'), full('b')]);
  });
  it('fills an empty half, or pushes the occupant to a new row below', () => {
    expect(drop([half('a', null), full('b')], 'b', 0, 'right')).toEqual([half('a', 'b')]);
    expect(drop([half('a', 'b'), full('c')], 'c', 0, 'left')).toEqual([half('c', 'b'), full('a')]);
  });
  it('a tile dropped in the centre takes the row; the others move above and below', () => {
    expect(drop([half('a', 'b'), full('c')], 'c', 0, 'center')).toEqual([full('a'), full('c'), full('b')]);
    expect(drop(l, 'c', 0, 'center')).toEqual([full('c'), full('a'), full('b')]);
    expect(drop([half('a', 'b')], 'a', 0, 'center')).toEqual([full('a'), full('b')]);
  });
  it('moves a tile on its own row, and between rows', () => {
    expect(drop([half('a', null)], 'a', 0, 'right')).toEqual([half(null, 'a')]);
    expect(drop(l, 'a', 0, 'left')).toEqual([half('a', null), full('b'), full('c')]);
    expect(drop(l, 'c', 0, 'before')).toEqual([full('c'), full('a'), full('b')]);
    expect(drop(l, 'a', 2, 'after')).toEqual([full('b'), full('c'), full('a')]);
    expect(drop(l, 'a', 1, 'before')).toEqual([full('a'), full('b'), full('c')]);
    expect(drop([half('a', 'b')], 'a', 0, 'after')).toEqual([half(null, 'b'), full('a')]);
    expect(drop(l, 'a', 0, 'before')).toEqual(l);
    expect(drop(l, 'a', 0, 'after')).toEqual(l);
  });
  it('drops outside the rows at either end', () => {
    expect(drop(l, 'c', -1, 'before')).toEqual([full('c'), full('a'), full('b')]);
    expect(drop(l, 'a', 9, 'after')).toEqual([full('b'), full('c'), full('a')]);
  });
});

// ----- picture ids -----

const seg = (marker: number, body: number[]) => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
const jfif = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const oldExif = seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 42, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const scan = [0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9];
const jpeg = (...parts: number[][]) => new Uint8Array([0xff, 0xd8, ...parts.flat(), ...scan]);

function chunk(type: string, data: number[]): number[] {
  const body = new Uint8Array([...[...type].map((c) => c.charCodeAt(0)), ...data]);
  const len = data.length;
  const crc = crc32(body);
  return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...body, crc >>> 24, (crc >> 16) & 255, (crc >> 8) & 255, crc & 255];
}
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])]);
const UID = 'ab'.repeat(16);

describe('picture ids', () => {
  it('derives the id from the hash', () => expect(uidFromHash('f'.repeat(64))).toBe('f'.repeat(32)));
  it('crc32 matches the standard check value', () => expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926));
  it('writes the id into a JPEG after JFIF, replacing any old EXIF', () => {
    const src = jpeg(jfif, oldExif);
    expect(readId(src)).toBeNull();
    const out = stampId(src, UID);
    expect(readId(out)).toBe(UID);
    expect([...out.subarray(2, 2 + jfif.length)]).toEqual(jfif);
    expect(out[2 + jfif.length + 1]).toBe(0xe1);
    expect(out.length).toBe(src.length - oldExif.length + 87);
    // Re-stamping replaces, never stacks.
    const again = stampId(out, 'cd'.repeat(16));
    expect(readId(again)).toBe('cd'.repeat(16));
    expect(again.length).toBe(out.length);
    expect([...again.subarray(again.length - scan.length)]).toEqual(scan);
  });
  it('writes the id into a JPEG without JFIF right after SOI', () => {
    const out = stampId(jpeg(), UID);
    expect([out[2], out[3]]).toEqual([0xff, 0xe1]);
    expect(readId(out)).toBe(UID);
  });
  it('reads a little-endian EXIF id', () => {
    const t = new Uint8Array(77);
    const v = new DataView(t.buffer);
    t.set([0x49, 0x49]);
    v.setUint16(2, 42, true);
    v.setUint32(4, 8, true);
    v.setUint16(8, 1, true);
    v.setUint16(10, 0x8769, true);
    v.setUint16(12, 4, true);
    v.setUint32(14, 1, true);
    v.setUint32(18, 26, true);
    v.setUint16(26, 1, true);
    v.setUint16(28, 0xa420, true);
    v.setUint16(30, 2, true);
    v.setUint32(32, 33, true);
    v.setUint32(36, 44, true);
    for (let i = 0; i < 32; i++) t[44 + i] = UID.charCodeAt(i);
    expect(readId(jpeg(seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...t])))).toBe(UID);
  });
  it('ignores broken EXIF', () => {
    expect(readId(jpeg(seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 200])))).toBeNull();
  });
  it('writes the id into a PNG after IHDR with a valid CRC, once', () => {
    expect(readId(png)).toBeNull();
    const out = stampId(png, UID);
    expect(readId(out)).toBe(UID);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('tEXt');
    const again = stampId(out, 'cd'.repeat(16));
    expect(readId(again)).toBe('cd'.repeat(16));
    expect(again.length).toBe(out.length);
    const len = new DataView(out.buffer).getUint32(33);
    const crc = new DataView(out.buffer).getUint32(41 + len);
    expect(crc).toBe(crc32(out.subarray(37, 41 + len)));
  });
  it('leaves other formats alone', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38]);
    expect(stampId(gif, UID)).toBe(gif);
    expect(readId(gif)).toBeNull();
    const noIhdr = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IEND', [])]);
    expect(stampId(noIhdr, UID)).toBe(noIhdr);
  });
});

// ----- post meta -----

const ref = (n: number): MediaRef => ({ wpMediaId: n, url: `https://example.test/p${n}.jpg`, uid: String(n).padStart(32, '0'), name: `p${n}.jpg`, width: 100, height: 80 });

function postTiles() {
  const t1 = addElement(addElement(createTile('One'), imageFor({ id: 'm1', width: 100, height: 80 })), imageFor({ id: 'm2', width: 100, height: 80 }));
  const t2 = addElement(addElement(addElement(createTile('Two'), textFor('Hello <world>\nbye')), paintFor('a1')), spiralFor('coil'));
  return { t1, t2 };
}
const resolved = (): Resolved => ({
  media: (_t, e) => (e.kind === 'image' ? ref(e.mediaId === 'm1' ? 1 : 2) : e.kind === 'paint' ? ref(3) : e.kind === 'spiral' ? ref(4) : undefined),
  lines: (_t, e) => (e.kind === 'text' ? e.text.split('\n') : undefined),
  font: (e) => (e.kind === 'text' ? 'Roboto' : undefined),
});

describe('post meta', () => {
  it('builds the meta in layout order with permanent picture ids', () => {
    const { t1, t2 } = postTiles();
    const m = buildPostMeta([full(t2.id), half(t1.id, null)], [t1, t2], resolved());
    expect(m.tiles.map((t) => t.name)).toEqual(['Two', 'One']);
    expect(m.layout).toEqual([{ full: t2.id }, { left: t1.id, right: null }]);
    const img = m.tiles[1].elements[0];
    expect(img.kind === 'image' && img.mediaId).toBe(ref(1).uid);
    const paint = m.tiles[0].elements[1];
    expect(paint.kind === 'paint' && paint.assetId).toBe(ref(3).uid);
    expect(m.tiles[0].elements[0]).toMatchObject({ lines: ['Hello <world>', 'bye'], cssFontFamily: 'Roboto' });
    // No chosen picture: the top picture of the first tile with photos.
    expect(m.featured).toEqual({ tileId: t1.id, elementId: t1.elements[1].id, wpMediaId: 2 });
    expect(refsOf(m).map((r) => r.wpMediaId)).toEqual([3, 4, 1, 2]);
  });
  it('uses the chosen featured picture', () => {
    const { t1, t2 } = postTiles();
    const chosen: TileDocument = { ...t2, meta: { featured: t2.elements[2].id } };
    const m = buildPostMeta(fromOrder([t1.id, t2.id]), [t1, chosen], resolved());
    expect(m.featured).toEqual({ tileId: t2.id, elementId: t2.elements[2].id, wpMediaId: 4 });
    expect(pickFeatured([])).toBeNull();
  });
  it('round-trips through JSON back into tiles', () => {
    const { t1, t2 } = postTiles();
    const layout = fromOrder([t1.id, t2.id]);
    const m = parsePostMeta(JSON.stringify(buildPostMeta(layout, [t1, t2], resolved())));
    const back = tilesFromPost(m, (r, kind) => `${kind}-${r.wpMediaId}`, new Date(5));
    expect(back.layout).toEqual(layout);
    const [a, b] = back.tiles;
    expect(a.elements.map((e) => (e.kind === 'image' ? e.mediaId : ''))).toEqual(['image-1', 'image-2']);
    expect(b.elements[1]).toMatchObject({ kind: 'paint', assetId: 'paint-3' });
    expect(b.elements[0]).not.toHaveProperty('lines');
    expect(b.elements[2]).not.toHaveProperty('media');
    expect(a.updatedAt).toBe(new Date(5).toISOString());
  });
  it('rejects anything else', () => {
    const { t1 } = postTiles();
    const good = buildPostMeta(fromOrder([t1.id]), [t1], resolved());
    expect(() => parsePostMeta(null)).toThrow();
    expect(() => parsePostMeta({ schema: 'wpstudio.post' })).toThrow('Not a PUBLISH post');
    expect(() => parsePostMeta({ ...good, version: 2 })).toThrow('Unsupported');
    expect(() => parsePostMeta({ ...good, tiles: null })).toThrow('no tiles');
    const bad = JSON.parse(JSON.stringify(good));
    bad.tiles[0].elements[0].media.wpMediaId = 'x';
    expect(() => parsePostMeta(bad)).toThrow('Bad picture');
  });
  it('writes a plain body for other readers', () => {
    const { t1, t2 } = postTiles();
    const html = postContent(buildPostMeta(fromOrder([t2.id, t1.id]), [t1, t2], resolved()));
    expect(html).toContain('<p>Hello &lt;world&gt;<br>bye</p>');
    expect(html).toContain('class="wp-image-1"');
    expect(html).toContain('alt="coil"');
  });
});

// ----- old posts -----

describe('old posts into tiles', () => {
  it('puts pictures in grid tiles with captions, then the text', () => {
    const images = Array.from({ length: 14 }, (_, i) => ({ mediaId: `m${i}`, width: i % 2 ? 400 : 100, height: 300, caption: i === 0 ? 'First picture' : undefined }));
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} `.repeat(20));
    const tiles = legacyTiles({ title: 'Old trip', images, paragraphs: ['', ...paragraphs] }, mono);
    const pics = tiles.filter((t) => t.name.includes('pictures'));
    expect(pics.map((t) => t.name)).toEqual(['Old trip · pictures 1', 'Old trip · pictures 2']);
    expect(pics[0].elements.filter((e) => e.kind === 'image')).toHaveLength(12);
    expect(pics[0].elements.find((e) => e.kind === 'text')).toMatchObject({ text: 'First picture', align: 'center' });
    const texts = tiles.filter((t) => t.name.includes('text'));
    expect(texts.length).toBeGreaterThan(2);
    expect(texts[0].elements[0]).toMatchObject({ kind: 'text', text: 'Old trip', weight: 700 });
    for (const t of tiles) {
      expect(t.meta.legacy).toBe(true);
      for (const e of t.elements) expect(e.y + e.h).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('handles one picture and an empty title', () => {
    const tiles = legacyTiles({ title: ' ', images: [{ mediaId: 'm', width: 300, height: 100 }], paragraphs: [] }, mono);
    expect(tiles).toHaveLength(1);
    expect(tiles[0].name).toBe('Imported · pictures');
    expect(tiles[0].elements[0].w).toBeCloseTo((1080 - 108) / 1080);
  });
  it('reads paragraphs and pictures from post HTML', () => {
    const html = '<p>One&nbsp;&amp; <b>two</b></p><figure><img src="x.jpg"></figure><h2>Head&#8217;s</h2><p>a<br/>b</p><script>bad()</script>';
    expect(htmlParagraphs(html)).toEqual(['One & two', 'Head’s', 'a\nb']);
    expect(htmlImages('<img class="wp-image-12" src="a.jpg"><img alt="no src"><img src=\'b.png\'>')).toEqual([
      { id: 12, src: 'a.jpg' },
      { id: null, src: 'b.png' },
    ]);
  });
});

describe('publish names', () => {
  it('names pictures after the post and tile', () => {
    expect(publishName('Harbour Walk!', 3, '3fa2c1aa', 'image/jpeg')).toBe('harbour-walk-03-3fa2c1.jpg');
    expect(publishName('', 12, 'abcdef00', 'image/png', 'drawing')).toBe('post-12-drawing-abcdef.png');
    expect(renameCanonical('harbour-walk-03-spiral-3fa2c1.png', 'Coil')).toBe('coil-03-spiral-3fa2c1.png');
  });
});
