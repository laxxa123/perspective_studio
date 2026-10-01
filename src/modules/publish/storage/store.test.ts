import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addElement, createTile, imageFor, paintFor, textFor } from '../core/tile';
import { PublishStore, sha256 } from './PublishStore';

let n = 0;
const open = () => new PublishStore(`publish-test-${n++}`).open();
const png = (s: string) => new Blob([s], { type: 'image/png' });

describe('publish store', () => {
  it('hashes content', async () => {
    expect(await sha256(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('saves, lists newest first, reopens, renames and deletes tiles', async () => {
    const s = await open();
    const a = { ...createTile('A', new Date(1000)), updatedAt: new Date(1000).toISOString() };
    const b = { ...addElement(createTile('B'), textFor()), updatedAt: new Date(2000).toISOString() };
    await s.saveTile(a);
    await s.saveTile(b, png('thumb'));
    expect((await s.listTiles()).map((t) => t.name)).toEqual(['B', 'A']);
    expect(await s.getTile(b.id)).toEqual(b);
    expect(await s.thumb(b.id)).not.toBeNull();
    await s.renameTile(a.id, 'A2');
    expect((await s.getTile(a.id))!.name).toBe('A2');
    await s.deleteTile(b.id);
    expect(await s.getTile(b.id)).toBeNull();
    expect(await s.thumb(b.id)).toBeNull();
    expect(await s.getTile('missing')).toBeNull();
  });

  it('keeps one copy of the same picture under a canonical name', async () => {
    const s = await open();
    const first = await s.addMedia(png('pixels'), { fileName: 'Harbour Sunset.png', width: 40, height: 30 }, new Date('2026-10-01T00:00:00Z'));
    expect(first.existed).toBe(false);
    expect(first.media.name).toMatch(/^harbour-sunset-20261001-[0-9a-f]{6}\.png$/);
    const again = await s.addMedia(png('pixels'), { fileName: 'copy.png', width: 40, height: 30 });
    expect(again.existed).toBe(true);
    expect(again.media.id).toBe(first.media.id);
    expect(await s.listMedia()).toHaveLength(1);
    expect(await (await s.blob(first.media.id))!.text()).toBe('pixels');
    const renamed = await s.renameMedia(first.media.id, 'Old port');
    expect(renamed!.name).toMatch(/^old-port-20261001-/);
    expect(await s.renameMedia('missing', 'x')).toBeNull();
    expect(await s.media('missing')).toBeNull();
  });

  it('refuses to delete a picture a tile uses', async () => {
    const s = await open();
    const { media } = await s.addMedia(png('p1'), { fileName: 'p.png', width: 10, height: 10 });
    const t = addElement(createTile('Uses it'), imageFor(media));
    await s.saveTile(t);
    expect(await s.deleteMedia(media.id)).toEqual(['Uses it']);
    await s.deleteTile(t.id);
    expect(await s.deleteMedia(media.id)).toEqual([]);
    expect(await s.media(media.id)).toBeNull();
  });

  it('duplicates a tile with its own copy of the paint layer', async () => {
    const s = await open();
    const asset = await s.putAsset(png('paint'));
    const t = addElement(createTile('P'), paintFor(asset));
    await s.saveTile(t, png('th'));
    const copyId = (await s.duplicateTile(t.id))!;
    const copy = (await s.getTile(copyId))!;
    const p = copy.elements[0];
    expect(p.kind === 'paint' && p.assetId).not.toBe(asset);
    expect(await (await s.blob(p.kind === 'paint' ? p.assetId : ''))!.text()).toBe('paint');
    expect(await s.thumb(copyId)).not.toBeNull();
    await s.deleteTile(t.id);
    expect(await s.blob(asset)).toBeNull();
    await s.deleteAsset(p.kind === 'paint' ? p.assetId : '');
    expect(await s.duplicateTile('missing')).toBeNull();
    s.close();
  });
});
