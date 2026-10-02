import { describe, expect, it, vi } from 'vitest';
import { isComplete, siteUrl, uidIn, WpClient, WpError, type PostBody } from './WpClient';

type Call = { url: string; init: RequestInit };
function mock(...answers: (Response | Error | ((c: Call) => Response))[]) {
  const calls: Call[] = [];
  const f = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(url), init: init ?? {} };
    calls.push(c);
    const a = answers.shift();
    if (!a) throw new Error('no answer');
    if (a instanceof Error) throw a;
    return typeof a === 'function' ? a(c) : a;
  });
  return { calls, f: f as unknown as typeof fetch };
}
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const settings = { site: 'example.test/', user: 'ann', password: 'abcd efgh ijkl' };
const UID = '0123456789abcdef0123456789abcdef';

describe('wordpress settings', () => {
  it('normalises the site address', () => {
    expect(siteUrl(' example.test/wp-json/ ')).toBe('https://example.test');
    expect(siteUrl('http://local.test')).toBe('http://local.test');
    expect(siteUrl('')).toBe('');
    expect(isComplete(settings)).toBe(true);
    expect(isComplete({ ...settings, password: ' ' })).toBe(false);
    expect(isComplete(null)).toBe(false);
    expect(uidIn(`x creative_uid:${UID} y`)).toBe(UID);
    expect(uidIn('nothing')).toBeNull();
  });
});

describe('wordpress client', () => {
  it('signs in with the Application Password (spaces removed)', async () => {
    const m = mock(ok({ id: 3, name: 'Ann' }));
    const me = await new WpClient(settings, m.f).me();
    expect(me).toEqual({ id: 3, name: 'Ann' });
    expect(m.calls[0].url).toBe('https://example.test/wp-json/wp/v2/users/me?context=edit&_fields=id,name');
    expect((m.calls[0].init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('ann:abcdefghijkl')}`);
  });

  it('explains failures', async () => {
    const run = (r: Response | Error, s = settings) => new WpClient(s, mock(r).f).me().then(() => new WpError('no error'), (e: WpError) => e);
    expect((await run(ok({ code: 'incorrect_password', message: 'x' }, 401))).message).toContain('refused');
    expect((await run(ok({ code: 'rest_no_route' }, 404))).message).toContain('theme');
    expect((await run(ok({ code: 'x', message: '<b>Nope</b>' }, 500))).message).toBe('Nope');
    expect((await run(new Response('', { status: 502 }))).message).toBe('WordPress answered 502.');
    expect((await run(new Response('<html>', { status: 200 }))).message).toContain('did not answer with WordPress');
    expect((await run(new TypeError('fail'))).message).toContain('Cannot reach https://example.test');
    expect((await run(Object.assign(new Error('a'), { name: 'AbortError' }))).message).toContain('in time');
    expect((await run(ok({}), { ...settings, user: '' })).message).toContain('Settings');
  });

  it('times out', async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch;
    await expect(new WpClient(settings, f, 5).me()).rejects.toThrow('in time');
  });

  it('knows whether the theme is ready', async () => {
    expect(await new WpClient(settings, mock(ok({ version: 1 })).f).themeReady()).toBe(true);
    expect(await new WpClient(settings, mock(ok({ code: 'rest_no_route' }, 404)).f).themeReady()).toBe(false);
    await expect(new WpClient(settings, mock(ok({}, 401)).f).themeReady()).rejects.toThrow('refused');
  });

  it('lists and creates categories, reusing an existing one', async () => {
    const m = mock(ok([{ id: 1, name: 'Travel &amp; food', count: 4 }]), ok({ id: 9, name: 'New' }), ok({ code: 'term_exists' }, 400), ok([{ id: 1, name: 'Old', count: 1 }]), ok({ code: 'term_exists' }, 400), ok([]));
    const wp = new WpClient(settings, m.f);
    expect(await wp.categories()).toEqual([{ id: 1, name: 'Travel & food', count: 4 }]);
    expect(await wp.createCategory(' New ')).toEqual({ id: 9, name: 'New', count: 0 });
    expect(JSON.parse(m.calls[1].init.body as string)).toEqual({ name: 'New' });
    expect(await wp.createCategory('old')).toMatchObject({ id: 1 });
    await expect(wp.createCategory('ghost')).rejects.toThrow();
  });

  const media = (id: number, uid?: string) => ({ id, source_url: `https://example.test/u/${id}.jpg`, mime_type: 'image/jpeg', media_details: { width: 10, height: 20, sizes: { thumbnail: { source_url: `t${id}` } } }, description: { raw: uid ? `creative_uid:${uid}` : '' }, title: { raw: 'T' }, caption: { raw: '<p>Cap</p>' }, date_gmt: 'd' });

  it('finds, uploads, lists and deletes pictures', async () => {
    const m = mock(ok([media(1), media(2, UID)]), ok([media(1)]), ok({ id: 5, source_url: 'u5' }), ok(media(5, UID)), ok([media(7)]), ok(media(7)), ok({ deleted: true }), ok({ id: 0 }));
    const wp = new WpClient(settings, m.f);
    expect(await wp.findMedia(UID)).toMatchObject({ id: 2, uid: UID, width: 10, height: 20, caption: 'Cap', title: 'T' });
    expect(await wp.findMedia(UID)).toBeNull();
    const up = await wp.uploadMedia(new Blob(['x'], { type: 'image/png' }), 'trip 01 (a).png', { uid: UID, title: 'Trip', alt: '' });
    expect(up).toMatchObject({ id: 5, uid: UID });
    expect(m.calls[2].init.headers).toMatchObject({ 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="trip_01__a_.png"' });
    expect(JSON.parse(m.calls[3].init.body as string)).toEqual({ description: `creative_uid:${UID}`, title: 'Trip', alt_text: '' });
    expect(await wp.listMedia({ search: ' sea ', page: 2 })).toHaveLength(1);
    expect(m.calls[4].url).toContain('search=sea');
    expect(m.calls[4].url).toContain('page=2');
    expect((await wp.media(7)).id).toBe(7);
    await wp.deleteMedia(7);
    expect(m.calls[6]).toMatchObject({ url: 'https://example.test/wp-json/wp/v2/media/7?force=true', init: { method: 'DELETE' } });
    await expect(wp.uploadMedia(new Blob(['x']), 'a.jpg', { uid: UID })).rejects.toThrow('no picture id');
  });

  it('downloads a picture through the theme', async () => {
    const m = mock(ok({ mime: 'image/png', data: btoa('\x89PNG') }));
    const b = await new WpClient(settings, m.f).download(4);
    expect(m.calls[0].url).toBe('https://example.test/wp-json/creative/v1/file/4');
    expect(b.type).toBe('image/png');
    expect(new Uint8Array(await b.arrayBuffer())[0]).toBe(0x89);
  });

  it('reads, lists and saves posts', async () => {
    const post = { id: 8, title: { raw: 'Hi' }, link: 'L', date_gmt: 'D', modified_gmt: 'M', status: 'publish', categories: [1], featured_media: 5, content: { raw: '<p>x</p>' }, meta: { _creative_post: '{}' } };
    const m = mock(ok(post), ok([post, { id: 9, title: { rendered: 'R' }, meta: [] }]), ok(post), ok(post), ok({}), ok([media(5), { id: 6, source_url: 's6' }]));
    const wp = new WpClient(settings, m.f);
    expect(await wp.post(8)).toEqual({ id: 8, title: 'Hi', link: 'L', date: 'D', modified: 'M', status: 'publish', categories: [1], featuredMedia: 5, content: '<p>x</p>', meta: { _creative_post: '{}' } });
    const list = await wp.listPosts({ search: 'trip' });
    expect(list[1]).toMatchObject({ id: 9, title: 'R', meta: {}, categories: [] });
    const body: PostBody = { title: 'Hi', content: '', status: 'publish', categories: [], featured_media: 0, meta: { _creative_post: '{}' } };
    await wp.savePost(null, body);
    await wp.savePost(8, body);
    expect(m.calls[2].url).toBe('https://example.test/wp-json/wp/v2/posts?context=edit');
    expect(m.calls[3].url).toBe('https://example.test/wp-json/wp/v2/posts/8?context=edit');
    await wp.clearMeta(8, '_wpstudio_manifest');
    expect(JSON.parse(m.calls[4].init.body as string)).toEqual({ meta: { _wpstudio_manifest: null } });
    const th = await wp.thumbs([5, 6, 5, 0]);
    expect(m.calls[5].url).toContain('include=5,6');
    expect([...th]).toEqual([
      [5, 't5'],
      [6, 's6'],
    ]);
    expect((await wp.thumbs([])).size).toBe(0);
  });
});
