import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { crc32, readId } from '../core/imageId';
import { parsePostMeta } from '../core/postMeta';
import { drop, fromOrder } from '../core/postLayout';
import { addElement, createTile, imageFor, paintFor, spiralFor, textFor } from '../core/tile';
import type { TileDocument } from '../core/types';
import { emptyDraft, PublishStore } from '../storage/PublishStore';
import { FakeWp } from './fakeWp.test-util';
import { ConflictError, clearPost, isOwnPost, publishPost, pullPost, summaryOf, type Deps } from './pipeline';
import { WpClient } from './WpClient';

function chunk(type: string, data: number[]): number[] {
  const body = new Uint8Array([...[...type].map((c) => c.charCodeAt(0)), ...data]);
  const c = crc32(body);
  return [0, 0, 0, data.length, ...body, c >>> 24, (c >> 16) & 255, (c >> 8) & 255, c & 255];
}
const pngBytes = (seed: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), ...chunk('IDAT', [seed, seed + 1]), ...chunk('IEND', [])]);
const png = (seed: number) => new Blob([pngBytes(seed) as BlobPart], { type: 'image/png' });

let n = 0;
async function setup() {
  const store = await new PublishStore(`pipeline-${n++}`).open();
  const fake = new FakeWp();
  const wp = new WpClient({ site: 'site.test', user: 'ann', password: 'pw' }, fake.fetch);
  const steps: string[] = [];
  const deps: Deps = {
    store,
    wp,
    spiralPng: async (e) => png(e.text.length),
    lines: (e) => e.text.split('\n'),
    thumbnail: async () => png(250),
    measure: (s, size) => s.length * size * 0.5,
    progress: (t) => steps.push(t),
  };
  return { store, fake, wp, deps, steps };
}

/** Two tiles in the post: a photo used twice + text, and a drawing + spiral; one draft tile aside. */
async function compose(store: PublishStore, title = 'Harbour Walk') {
  const { media } = await store.addMedia(png(1), { width: 40, height: 30 });
  const asset = await store.putAsset(png(2));
  const t1: TileDocument = addElement(addElement(addElement(createTile('One'), imageFor(media)), textFor('Hello\nthere')), imageFor(media));
  const t2: TileDocument = addElement(addElement(createTile('Two'), paintFor(asset)), spiralFor('coil'));
  const aside = createTile('Aside');
  for (const t of [t1, t2, aside]) await store.saveTile(t);
  await store.setWorkspace({ live: [t1.id, t2.id], drafts: [aside.id] });
  await store.setDraft({ ...emptyDraft(), title, categories: [1], layout: drop(fromOrder([t1.id, t2.id]), t2.id, 0, 'right') });
  return { media, asset, t1, t2, aside };
}

describe('publishing', () => {
  it('publishes the post, names and tags pictures once, then clears the workbench', async () => {
    const { store, fake, deps, steps } = await setup();
    const { media, t1, t2, aside } = await compose(store);
    const saved = await publishPost(deps, { newCategories: ['Walks', ' '] });

    const post = fake.posts.get(saved.id)!;
    expect(post.title).toBe('Harbour Walk');
    expect(post.categories).toEqual([1, fake.cats.find((c) => c.name === 'Walks')!.id]);
    const meta = parsePostMeta(post.meta._creative_post);
    expect(meta.layout).toEqual([{ left: t1.id, right: t2.id }]);
    expect(meta.tiles.map((t) => t.name)).toEqual(['One', 'Two']);

    // One upload per picture: the photo used twice, the drawing, the spiral.
    const files = [...fake.media.values()].map((m) => m.file).sort();
    expect(files).toHaveLength(3);
    expect(files).toEqual([`harbour-walk-01-${media.uid.slice(0, 6)}.png`, expect.stringMatching(/^harbour-walk-02-drawing-[0-9a-f]{6}\.png$/), expect.stringMatching(/^harbour-walk-02-spiral-[0-9a-f]{6}\.png$/)]);
    for (const m of fake.media.values()) {
      expect(m.description).toMatch(/^creative_uid:[0-9a-f]{32}$/);
      expect(readId(m.bytes)).toBe(m.description.slice('creative_uid:'.length));
    }
    // The photo's name is now fixed on the phone too, and it knows its WordPress copy.
    const local = (await store.media(media.id))!;
    expect(local).toMatchObject({ name: `harbour-walk-01-${media.uid.slice(0, 6)}.png`, named: true, wpMediaId: meta.featured!.wpMediaId });
    // Featured: the top picture of the first tile.
    expect(meta.featured).toMatchObject({ tileId: t1.id, elementId: t1.elements[2].id });
    expect(post.featured_media).toBe(local.wpMediaId);
    expect(meta.tiles[0].elements[1]).toMatchObject({ lines: ['Hello', 'there'], cssFontFamily: expect.stringContaining('Roboto') });
    expect(post.content).toContain('<p>Hello<br>there</p>');

    // Cleared: the post's tiles, the draft; the aside tile and the photo stay.
    expect(await store.getTile(t1.id)).toBeNull();
    expect(await store.getTile(aside.id)).not.toBeNull();
    expect(await store.workspace()).toEqual({ live: [], drafts: [aside.id] });
    expect(await store.draft()).toEqual(emptyDraft());
    expect(await store.media(media.id)).not.toBeNull();
    const posts = await store.posts();
    expect(posts[0]).toMatchObject({ wpId: saved.id, title: 'Harbour Walk', thumb: expect.stringContaining('harbour-walk-01') });
    expect(steps).toContain('Pictures 4 of 4…');
  });

  it('reuses a picture already on WordPress and keeps a hand-picked name', async () => {
    const { store, fake, deps } = await setup();
    const { media } = await compose(store, 'First');
    await store.renameMedia(media.id, 'Old port');
    await publishPost(deps);
    const uploads = fake.media.size;
    // Same photo, new post: no new upload, same name.
    const t = addElement(createTile('Again'), imageFor(media));
    await store.saveTile(t);
    await store.setWorkspace({ live: [t.id], drafts: [] });
    await store.setDraft({ ...emptyDraft(), title: 'Second' });
    const saved = await publishPost(deps);
    expect(fake.media.size).toBe(uploads);
    const meta = parsePostMeta(fake.posts.get(saved.id)!.meta._creative_post);
    expect(meta.tiles[0].elements[0].media!.name).toMatch(/^old-port-\d{8}-[0-9a-f]{6}\.png$/);
  });

  it('refuses without a name, tiles, login or theme — and changes nothing', async () => {
    const { store, fake, deps } = await setup();
    await expect(publishPost(deps)).rejects.toThrow('name');
    await store.setDraft({ ...emptyDraft(), title: 'x' });
    await expect(publishPost(deps)).rejects.toThrow('no tiles');
    const { t1 } = await compose(store);
    fake.password = 'other';
    await expect(publishPost(deps)).rejects.toThrow('refused');
    fake.password = 'pw';
    fake.theme = false;
    await expect(publishPost(deps)).rejects.toThrow('studioview');
    expect(fake.media.size).toBe(0);
    expect(await store.getTile(t1.id)).not.toBeNull();
  });

  it('stops when the site does not keep the post meta (old theme)', async () => {
    const { store, fake, deps } = await setup();
    const { t1 } = await compose(store);
    // The theme route answers, but the meta key is not registered.
    fake.keepsMeta = false;
    await expect(publishPost(deps)).rejects.toThrow('update the studioview theme');
    expect(await store.getTile(t1.id)).not.toBeNull();
  });
});

describe('editing a published post', () => {
  it('pulls the post back as tiles, republishes it and removes replaced drawings', async () => {
    const { store, fake, deps } = await setup();
    const { media, t1, t2 } = await compose(store);
    const first = await publishPost(deps);
    const before = parsePostMeta(fake.posts.get(first.id)!.meta._creative_post);
    const oldDrawing = before.tiles[1].elements[0].media!.wpMediaId;

    const draft = await pullPost(deps, first.id);
    expect(draft).toMatchObject({ wpId: first.id, title: 'Harbour Walk', categories: [1], layout: [{ kind: 'half', left: t1.id, right: t2.id }] });
    expect(draft.pulledMedia).toHaveLength(2);
    const ws = await store.workspace();
    expect(ws.live).toEqual([t1.id, t2.id]);
    const back1 = (await store.getTile(t1.id))!;
    // The photo is the same library entry (found by its permanent id), not a copy.
    expect(back1.elements[0]).toMatchObject({ kind: 'image', mediaId: media.id });
    expect(await store.listMedia()).toHaveLength(1);
    const back2 = (await store.getTile(t2.id))!;
    const paint = back2.elements[0];
    expect(paint.kind).toBe('paint');
    expect(await store.blob(paint.kind === 'paint' ? paint.assetId : '')).not.toBeNull();
    expect(back2.elements[1]).toMatchObject({ kind: 'spiral', text: 'coil' });

    // A new drawing replaces the old one; the title changes; republish.
    const asset = await store.putAsset(png(9));
    await store.saveTile({ ...back2, elements: [{ ...paint, assetId: asset } as typeof paint, back2.elements[1]] });
    await store.setDraft({ ...draft, title: 'Harbour Walk, again' });
    const again = await publishPost(deps);
    expect(again.id).toBe(first.id);
    expect(fake.posts.get(first.id)!.title).toBe('Harbour Walk, again');
    expect(fake.media.has(oldDrawing)).toBe(false);
    expect(await store.posts()).toHaveLength(1);
  });

  it('notices a change made on the site meanwhile, and can overwrite it', async () => {
    const { store, fake, deps } = await setup();
    await compose(store);
    const first = await publishPost(deps);
    await pullPost(deps, first.id);
    fake.touch(first.id);
    const err = await publishPost(deps).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((await store.workspace()).live).toHaveLength(2);
    await publishPost(deps, { force: true });
    expect((await store.workspace()).live).toHaveLength(0);
  });

  it('will not pull over live tiles; clearing moves on', async () => {
    const { store, deps } = await setup();
    const { aside } = await compose(store);
    await expect(pullPost(deps, 1)).rejects.toThrow('Publish or clear');
    await clearPost(store);
    expect(await store.workspace()).toEqual({ live: [], drafts: [aside.id] });
    expect((await store.draft()).title).toBe('');
  });

  it('brings an old WP Studio post in as marked tiles; republishing makes it a PUBLISH post', async () => {
    const { store, fake, deps } = await setup();
    const a = fake.addMedia(pngBytes(20), 'old-a.png', 'The harbour');
    const b = fake.addMedia(pngBytes(21), 'old-b.png');
    const manifest = { schema: 'wpstudio.post', version: 3, tiles: [{ images: [{ mediaId: a }], textOverlays: [{ text: 'Caption one' }] }, { photo: { mediaId: b }, textOverlays: [{ content: 'Old text' }] }] };
    const id = fake.addPost({ title: 'Old trip', content: '<p>Body para.</p><p>Caption one</p>', meta: { _wpstudio_manifest: JSON.stringify(manifest) } });

    const draft = await pullPost(deps, id);
    expect(draft.legacy).toBe(true);
    const tiles = await Promise.all((await store.workspace()).live.map((x) => store.getTile(x)));
    expect(tiles.map((t) => t!.name)).toEqual(['Old trip · pictures', 'Old trip · text 1']);
    expect(tiles.every((t) => t!.meta.legacy)).toBe(true);
    const texts = tiles[1]!.elements.map((e) => (e.kind === 'text' ? e.text : ''));
    expect(texts).toEqual(['Old trip', 'Caption one', 'Old text', 'Body para.']);
    expect(tiles[0]!.elements.find((e) => e.kind === 'text')).toMatchObject({ text: 'The harbour' });
    expect((await store.listTiles()).every((t) => t.legacy)).toBe(true);
    expect((await store.posts())[0]).toMatchObject({ wpId: id, legacy: true });
    // The old pictures keep their WordPress names and are not uploaded again.
    expect((await store.listMedia()).map((m) => m.name).sort()).toEqual(['old-a.png', 'old-b.png']);

    await publishPost(deps);
    const p = fake.posts.get(id)!;
    expect(p.meta._wpstudio_manifest).toBeUndefined();
    const meta = parsePostMeta(p.meta._creative_post);
    expect(meta.tiles.every((t) => !t.meta.legacy)).toBe(true);
    expect(fake.media.size).toBe(2);
    expect(isOwnPost(await deps.wp.post(id))).toBe(true);
  });

  it('brings a plain post in from its HTML', async () => {
    const { store, fake, deps } = await setup();
    const a = fake.addMedia(pngBytes(30), 'plain.png');
    const id = fake.addPost({ title: 'Plain', content: `<p>Hi</p><img class="wp-image-${a}" src="x"><img src="y"><img class="wp-image-9999" src="z">` });
    await pullPost(deps, id);
    const tiles = await Promise.all((await store.workspace()).live.map((x) => store.getTile(x)));
    expect(tiles[0]!.elements.filter((e) => e.kind === 'image')).toHaveLength(1);
    // Only the featured picture, when the body has none.
    const { deps: d2, fake: f2, store: s2 } = await setup();
    const fm = f2.addMedia(pngBytes(31), 'f.png');
    await pullPost(d2, f2.addPost({ title: 'F', content: '<p>x</p>', featured_media: fm }));
    expect(await s2.listMedia()).toHaveLength(1);
    expect(summaryOf(await d2.wp.post(fm + 1), false, 't')).toMatchObject({ thumb: 't' });
    expect(isOwnPost(await d2.wp.post(fm + 1))).toBe(false);
  });
});

describe('workspace', () => {
  it('drops gone tiles and puts unplaced ones into the post', async () => {
    const store = await new PublishStore(`ws-${n++}`).open();
    const a = { ...createTile('A'), createdAt: '2026-01-02' };
    const b = { ...createTile('B'), createdAt: '2026-01-01' };
    await store.saveTile(a);
    await store.saveTile(b);
    await store.setWorkspace({ live: ['gone'], drafts: [a.id] });
    expect(await store.syncedWorkspace()).toEqual({ live: [b.id], drafts: [a.id] });
    expect(await store.workspace()).toEqual({ live: [b.id], drafts: [a.id] });
    expect(await store.syncedWorkspace()).toEqual({ live: [b.id], drafts: [a.id] });
  });

  it('keeps the newest WordPress pictures on the phone, and any a tile uses', async () => {
    const store = await new PublishStore(`prune-${n++}`).open();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { media } = await store.addMedia(png(40 + i), { width: 1, height: 1, wpMediaId: i + 1, wpUrl: 'u' }, new Date(2026, 0, i + 1));
      ids.push(media.id);
    }
    const local = await store.addMedia(png(50), { width: 1, height: 1 }, new Date(2020, 0, 1));
    await store.saveTile(addElement(createTile(), imageFor({ id: ids[0], width: 1, height: 1 })));
    expect(await store.pruneMedia(2)).toBe(1);
    expect(await store.media(ids[1])).toBeNull();
    expect(await store.media(ids[0])).not.toBeNull();
    expect(await store.media(local.media.id)).not.toBeNull();
  });
});
