import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addElement, createTile, imageFor, paintFor, textFor } from '../core/tile';
import { openDB } from 'idb';
import { crc32, readId, stampId } from '../core/imageId';
import { PublishStore, POSTS_KEPT, sha256 } from './PublishStore';

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
    const first = await s.addMedia(png('pixels'), { width: 40, height: 30 }, new Date('2026-10-01T00:00:00Z'));
    expect(first.existed).toBe(false);
    expect(first.media.name).toMatch(/^photo-20261001-[0-9a-f]{6}\.png$/);
    expect(first.media.uid).toMatch(/^[0-9a-f]{32}$/);
    const again = await s.addMedia(png('pixels'), { width: 40, height: 30 });
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
    const { media } = await s.addMedia(png('p1'), { width: 10, height: 10 });
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

  it('stamps a permanent id into the stored picture and finds it again by that id', async () => {
    const s = await open();
    const chunk = (type: string, data: number[]) => {
      const body = new Uint8Array([...[...type].map((c) => c.charCodeAt(0)), ...data]);
      const c = crc32(body);
      return [0, 0, 0, data.length, ...body, c >>> 24, (c >> 16) & 255, (c >> 8) & 255, c & 255];
    };
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), ...chunk('IEND', [])]);
    const { media } = await s.addMedia(new Blob([bytes], { type: 'image/png' }), { width: 1, height: 1 });
    const stored = new Uint8Array(await (await s.blob(media.id))!.arrayBuffer());
    expect(readId(stored)).toBe(media.uid);
    expect(await s.mediaByUid(media.uid)).toMatchObject({ id: media.id });
    expect(await s.mediaByUid('nope')).toBeNull();
    // The stamped file (as pulled back from WordPress) is the same picture; its WordPress id is learnt.
    const pulled = await s.addMedia(new Blob([stored], { type: 'image/png' }), { width: 1, height: 1, source: 'wordpress', wpMediaId: 7, wpUrl: 'u' });
    expect(pulled).toMatchObject({ existed: true, media: { id: media.id, wpMediaId: 7 } });
    expect((await s.media(media.id))!.wpMediaId).toBe(7);
    // A picture that already carries an id keeps it and its given name.
    const other = stampId(bytes, 'e'.repeat(32));
    const named = await s.addMedia(new Blob([other as BlobPart], { type: 'image/png' }), { width: 1, height: 1, name: 'trip-01-eeeeee.png' });
    expect(named.media).toMatchObject({ uid: 'e'.repeat(32), name: 'trip-01-eeeeee.png', named: true });
    await s.putMedia({ ...named.media, wpUrl: 'x' });
    expect((await s.media(named.media.id))!.wpUrl).toBe('x');
  });

  it('keeps the workspace, the post draft and the newest posts', async () => {
    const s = await open();
    expect(await s.workspace()).toEqual({ live: [], drafts: [] });
    await s.setWorkspace({ live: ['a'], drafts: ['b'] });
    expect(await s.workspace()).toEqual({ live: ['a'], drafts: ['b'] });
    expect((await s.draft()).wpId).toBeNull();
    await s.setDraft({ wpId: 3, title: 'T', categories: [1], layout: [], modified: 'm' });
    expect((await s.draft()).title).toBe('T');
    const post = (wpId: number) => ({ wpId, title: `P${wpId}`, link: '', date: '', modified: '' });
    for (let i = 0; i < POSTS_KEPT + 3; i++) await s.rememberPost(post(i));
    let list = await s.rememberPost({ ...post(5), title: 'again' });
    expect(list).toHaveLength(POSTS_KEPT);
    expect(list[0].title).toBe('again');
    expect(list.filter((p) => p.wpId === 5)).toHaveLength(1);
    await s.setPosts(Array.from({ length: 40 }, (_, i) => post(i)));
    list = await s.posts();
    expect(list).toHaveLength(POSTS_KEPT);
    expect((await s.listTiles())).toEqual([]);
  });

  it('upgrades a 0.16 library: pictures get their id from their hash', async () => {
    const name = `publish-test-${n++}`;
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('tiles', { keyPath: 'id' });
        db.createObjectStore('thumbs');
        db.createObjectStore('media', { keyPath: 'id' }).createIndex('byHash', 'hash', { unique: true });
        db.createObjectStore('blobs');
      },
    });
    await old.put('media', { id: 'm1', name: 'x.jpg', hash: 'ab'.repeat(32), mime: 'image/jpeg', width: 1, height: 1, bytes: 1, createdAt: '', source: 'device' });
    old.close();
    const s = await new PublishStore(name).open();
    expect((await s.media('m1'))!.uid).toBe('ab'.repeat(16));
    expect(await s.mediaByUid('ab'.repeat(16))).not.toBeNull();
    expect(await s.workspace()).toEqual({ live: [], drafts: [] });
  });
});

describe('undo', () => {
  it('brings deleted tiles back with their thumbnails and drawings', async () => {
    const s = await new PublishStore(`undo-${Date.now()}`).open();
    const asset = await s.putAsset(new Blob(['paint'], { type: 'image/png' }));
    const t = addElement(createTile('P'), paintFor(asset));
    await s.saveTile(t, new Blob(['th']));
    const snap = await s.snapshot([t.id, 'missing']);
    await s.deleteTile(t.id);
    expect(await s.getTile(t.id)).toBeNull();
    await s.restore(snap);
    expect(await s.getTile(t.id)).toEqual(t);
    expect(await (await s.blob(asset))!.text()).toBe('paint');
    expect(await s.thumb(t.id)).not.toBeNull();
  });
});
