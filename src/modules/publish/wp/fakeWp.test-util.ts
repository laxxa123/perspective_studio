// An in-memory WordPress REST API for tests (the routes PUBLISH uses).
type Json = Record<string, unknown>;

interface Media {
  id: number;
  file: string;
  mime: string;
  bytes: Uint8Array;
  description: string;
  title: string;
  caption: string;
  date: string;
}
interface Post {
  id: number;
  title: string;
  content: string;
  status: string;
  categories: number[];
  featured_media: number;
  meta: Record<string, string>;
  modified: number;
  date: string;
}

export class FakeWp {
  media = new Map<number, Media>();
  posts = new Map<number, Post>();
  cats = [{ id: 1, name: 'Uncategorized', count: 0 }];
  next = 100;
  clock = 0;
  /** Off = a site without the studioview theme (no creative routes, meta not kept). */
  theme = true;
  /** Off = the meta key is not registered (an old theme). */
  keepsMeta = true;
  log: string[] = [];
  password = 'pw';

  readonly fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const h = (init.headers ?? {}) as Record<string, string>;
    this.log.push(`${method} ${url.pathname}`);
    if (h.Authorization !== `Basic ${btoa(`ann:${this.password}`)}`) return this.res({ code: 'incorrect_password' }, 401);
    const path = url.pathname.replace(/^\/wp-json/, '');
    const q = url.searchParams;
    const body = async () => JSON.parse(String(init.body)) as Json;
    let m: RegExpMatchArray | null;

    if (path === '/wp/v2/users/me') return this.res({ id: 1, name: 'Ann' });
    if (path.startsWith('/creative/v1/') && !this.theme) return this.res({ code: 'rest_no_route' }, 404);
    if (path === '/creative/v1/info') return this.res({ version: 1 });
    if ((m = path.match(/^\/creative\/v1\/file\/(\d+)$/))) {
      const f = this.media.get(Number(m[1]));
      if (!f) return this.res({ code: 'not_found' }, 404);
      let bin = '';
      for (const b of f.bytes) bin += String.fromCharCode(b);
      return this.res({ mime: f.mime, name: f.file, data: btoa(bin) });
    }
    if (path === '/wp/v2/categories') {
      if (method === 'GET') return this.res(this.cats);
      const name = String((await body()).name);
      const old = this.cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (old) return this.res({ code: 'term_exists', data: { term_id: old.id } }, 400);
      const c = { id: this.next++, name, count: 0 };
      this.cats.push(c);
      return this.res(c, 201);
    }
    if (path === '/wp/v2/media' && method === 'POST') {
      const file = /filename="([^"]+)"/.exec(h['Content-Disposition'])![1];
      const taken = [...this.media.values()].some((x) => x.file === file);
      const id = this.next++;
      const bytes = new Uint8Array(await (init.body as Blob).arrayBuffer());
      const f: Media = { id, file: taken ? file.replace(/(\.\w+)$/, '-1$1') : file, mime: h['Content-Type'], bytes, description: '', title: file, caption: '', date: `d${this.clock++}` };
      this.media.set(id, f);
      return this.res(this.mediaJson(f), 201);
    }
    if (path === '/wp/v2/media') {
      let list = [...this.media.values()].reverse();
      const s = q.get('search');
      if (s) list = list.filter((x) => x.description.includes(s) || x.title.includes(s));
      const inc = q.get('include');
      if (inc) list = list.filter((x) => inc.split(',').includes(String(x.id)));
      return this.res(list.slice(0, Number(q.get('per_page') ?? 10)).map((x) => this.mediaJson(x)));
    }
    if ((m = path.match(/^\/wp\/v2\/media\/(\d+)$/))) {
      const f = this.media.get(Number(m[1]));
      if (!f) return this.res({ code: 'rest_post_invalid_id' }, 404);
      if (method === 'DELETE') {
        this.media.delete(f.id);
        return this.res({ deleted: true });
      }
      if (method === 'POST') {
        const b = await body();
        if (typeof b.description === 'string') f.description = b.description;
        if (typeof b.title === 'string') f.title = b.title;
      }
      return this.res(this.mediaJson(f));
    }
    if (path === '/wp/v2/posts' && method === 'POST') {
      const p: Post = { id: this.next++, title: '', content: '', status: 'publish', categories: [], featured_media: 0, meta: {}, modified: 0, date: `d${this.clock++}` };
      this.posts.set(p.id, p);
      return this.res(this.savePost(p, await body()), 201);
    }
    if (path === '/wp/v2/posts') return this.res([...this.posts.values()].reverse().map((p) => this.postJson(p)));
    if ((m = path.match(/^\/wp\/v2\/posts\/(\d+)$/))) {
      const p = this.posts.get(Number(m[1]));
      if (!p) return this.res({ code: 'rest_post_invalid_id' }, 404);
      if (method === 'POST') return this.res(this.savePost(p, await body()));
      return this.res(this.postJson(p));
    }
    return this.res({ code: 'rest_no_route' }, 404);
  }) as typeof fetch;

  private savePost(p: Post, b: Json) {
    if (typeof b.title === 'string') p.title = b.title;
    if (typeof b.content === 'string') p.content = b.content;
    if (Array.isArray(b.categories)) p.categories = b.categories as number[];
    if (typeof b.featured_media === 'number') p.featured_media = b.featured_media;
    for (const [k, v] of Object.entries((b.meta ?? {}) as Record<string, string | null>)) {
      if (k === '_creative_post' && (!this.theme || !this.keepsMeta)) continue;
      if (v === null) delete p.meta[k];
      else p.meta[k] = v;
    }
    p.modified = ++this.clock;
    return this.postJson(p);
  }

  /** A post written by something else (WP Studio, the block editor). */
  addPost(p: Partial<Post>): number {
    const id = this.next++;
    this.posts.set(id, { id, title: '', content: '', status: 'publish', categories: [], featured_media: 0, meta: {}, modified: ++this.clock, date: 'd', ...p });
    return id;
  }

  addMedia(bytes: Uint8Array, file: string, caption = ''): number {
    const id = this.next++;
    this.media.set(id, { id, file, mime: file.endsWith('.png') ? 'image/png' : 'image/jpeg', bytes, description: '', title: file, caption, date: 'd' });
    return id;
  }

  /** Someone edits the post on the site. */
  touch(id: number) {
    this.posts.get(id)!.modified = ++this.clock;
  }

  private mediaJson(f: Media) {
    return { id: f.id, source_url: `https://site.test/wp-content/uploads/${encodeURIComponent(f.file)}`, mime_type: f.mime, media_details: { width: 10, height: 10 }, description: { raw: f.description }, title: { raw: f.title }, caption: { raw: f.caption ? `<p>${f.caption}</p>` : '' }, date_gmt: f.date };
  }

  private postJson(p: Post) {
    return { id: p.id, title: { raw: p.title }, content: { raw: p.content }, status: p.status, categories: p.categories, featured_media: p.featured_media, meta: { ...p.meta }, link: `https://site.test/?p=${p.id}`, date_gmt: p.date, modified_gmt: `m${p.modified}` };
  }

  private res(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  }
}
