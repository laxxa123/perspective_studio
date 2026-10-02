// WordPress REST client (PUBLISH §10.1). Plain fetch with an Application
// Password (Basic auth); WordPress core sends the CORS headers the app needs.
// Pictures are tagged in their description with `creative_uid:<id>` so the
// same picture is found again instead of uploaded twice. Pulling a file back
// goes through the studioview theme (`creative/v1/file/<id>`), because
// uploaded files themselves carry no CORS headers.

export interface WpSettings {
  site: string;
  user: string;
  password: string;
}

export interface WpMedia {
  id: number;
  url: string;
  /** A smaller size for lists (the full picture when WordPress made none). */
  thumb: string;
  width: number;
  height: number;
  mime: string;
  /** Picture id from the description tag, when the picture came from CREATIVE. */
  uid: string | null;
  title: string;
  caption: string;
  date: string;
}

export interface WpCategory {
  id: number;
  name: string;
  count: number;
}

export interface WpPost {
  id: number;
  title: string;
  link: string;
  date: string;
  /** `modified_gmt`: the republish conflict check. */
  modified: string;
  status: string;
  categories: number[];
  featuredMedia: number;
  content: string;
  meta: Record<string, unknown>;
}

export interface PostBody {
  title: string;
  content: string;
  status: 'publish';
  categories: number[];
  featured_media: number;
  meta: Record<string, string>;
}

export const UID_TAG = 'creative_uid:';
export const PER_PAGE = 25;

export class WpError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly code = '',
  ) {
    super(message);
    this.name = 'WpError';
  }
}

/** `example.com/` → `https://example.com` (no trailing slash; http only when typed). */
export function siteUrl(site: string): string {
  const s = site.trim().replace(/\/+$/, '').replace(/\/wp-json$/, '');
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export const isComplete = (s: WpSettings | null | undefined): s is WpSettings => !!s && !!siteUrl(s.site) && !!s.user.trim() && !!s.password.trim();

const text = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as { raw?: unknown; rendered?: unknown };
    if (typeof o.raw === 'string') return o.raw;
    if (typeof o.rendered === 'string') return o.rendered;
  }
  return '';
};
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

/** The picture id in a media description (`creative_uid:<32 hex>`). */
export const uidIn = (description: string): string | null => description.match(/creative_uid:([0-9a-f]{32})/)?.[1] ?? null;

type Json = Record<string, unknown>;

function toMedia(j: Json): WpMedia {
  const d = (j.media_details ?? {}) as Json;
  const sizes = (d.sizes ?? {}) as Record<string, Json>;
  return {
    id: num(j.id),
    url: text(j.source_url),
    thumb: text(sizes.medium?.source_url) || text(sizes.thumbnail?.source_url) || text(j.source_url),
    width: num(d.width),
    height: num(d.height),
    mime: text(j.mime_type),
    uid: uidIn(text(j.description)),
    title: text(j.title),
    caption: text(j.caption).replace(/<[^>]+>/g, '').trim(),
    date: text(j.date_gmt) || text(j.date),
  };
}

function toPost(j: Json): WpPost {
  return {
    id: num(j.id),
    title: text(j.title),
    link: text(j.link),
    date: text(j.date_gmt) || text(j.date),
    modified: text(j.modified_gmt) || text(j.modified),
    status: text(j.status),
    categories: Array.isArray(j.categories) ? j.categories.map(num) : [],
    featuredMedia: num(j.featured_media),
    content: text(j.content),
    meta: (j.meta && typeof j.meta === 'object' && !Array.isArray(j.meta) ? j.meta : {}) as Record<string, unknown>,
  };
}

function b64(s: string): string {
  let bin = '';
  for (const x of new TextEncoder().encode(s)) bin += String.fromCharCode(x);
  return btoa(bin);
}

export class WpClient {
  constructor(
    private readonly s: WpSettings,
    private readonly f: typeof fetch = (...a) => fetch(...a),
    private readonly timeoutMs = 90_000,
  ) {}

  get base() {
    return siteUrl(this.s.site);
  }

  private url(route: string, ns = 'wp/v2') {
    return `${this.base}/wp-json/${ns}${route}`;
  }

  private async call<T = Json>(method: string, url: string, body?: BodyInit, headers: Record<string, string> = {}): Promise<T> {
    if (!isComplete(this.s)) throw new WpError('Set up WordPress first (Settings).');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.f(url, {
        method,
        body,
        signal: ctl.signal,
        headers: { Authorization: `Basic ${b64(`${this.s.user.trim()}:${this.s.password.replace(/\s+/g, '')}`)}`, Accept: 'application/json', ...headers },
      });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw new WpError('The site did not answer in time. Try again.');
      throw new WpError(`Cannot reach ${this.base}. Check the address and the connection.`);
    } finally {
      clearTimeout(timer);
    }
    const raw = await res.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const j = (data ?? {}) as { code?: string; message?: string };
      const code = j.code ?? '';
      const msg =
        res.status === 401 || code === 'invalid_username' || code === 'incorrect_password'
          ? 'WordPress refused the user name or Application Password.'
          : code === 'rest_no_route'
            ? 'The site is missing a PUBLISH feature: update the studioview theme.'
            : j.message
              ? j.message.replace(/<[^>]+>/g, '')
              : `WordPress answered ${res.status}.`;
      throw new WpError(msg, res.status, code);
    }
    if (data === null) throw new WpError('The site did not answer with WordPress data. Check the address.', res.status, 'not_json');
    return data as T;
  }

  private json<T = Json>(method: string, url: string, body: unknown) {
    return this.call<T>(method, url, JSON.stringify(body), { 'Content-Type': 'application/json; charset=utf-8' });
  }

  /** Checks the login; the user's display name. */
  async me(): Promise<{ id: number; name: string }> {
    const j = await this.call('GET', this.url('/users/me?context=edit&_fields=id,name'));
    return { id: num(j.id), name: text(j.name) };
  }

  /** Whether the site's theme can show PUBLISH posts (and send files back). */
  async themeReady(): Promise<boolean> {
    try {
      const j = await this.call('GET', this.url('/info', 'creative/v1'));
      return num(j.version) >= 1;
    } catch (e) {
      if (e instanceof WpError && (e.status === 404 || e.code === 'not_json')) return false;
      throw e;
    }
  }

  async categories(): Promise<WpCategory[]> {
    const list = await this.call<Json[]>('GET', this.url('/categories?per_page=100&orderby=count&order=desc&_fields=id,name,count'));
    return list.map((c) => ({ id: num(c.id), name: text(c.name).replace(/&amp;/g, '&'), count: num(c.count) }));
  }

  /** Creates a category; an existing one of that name is returned instead. */
  async createCategory(name: string): Promise<WpCategory> {
    try {
      const c = await this.json('POST', this.url('/categories'), { name: name.trim() });
      return { id: num(c.id), name: text(c.name), count: 0 };
    } catch (e) {
      if (e instanceof WpError && e.code === 'term_exists') {
        const found = (await this.categories()).find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
        if (found) return found;
      }
      throw e;
    }
  }

  /** A picture uploaded earlier, found by its permanent id; null when there is none. */
  async findMedia(uid: string): Promise<WpMedia | null> {
    const list = await this.call<Json[]>('GET', this.url(`/media?search=${encodeURIComponent(uid)}&context=edit&per_page=10`));
    return list.map(toMedia).find((m) => m.uid === uid) ?? null;
  }

  async media(id: number): Promise<WpMedia> {
    return toMedia(await this.call('GET', this.url(`/media/${id}?context=edit`)));
  }

  /** The newest pictures (or a search). */
  async listMedia(opts: { search?: string; page?: number } = {}): Promise<WpMedia[]> {
    const q = new URLSearchParams({ media_type: 'image', per_page: String(PER_PAGE), page: String(opts.page ?? 1), context: 'edit', orderby: 'date', order: 'desc' });
    if (opts.search?.trim()) q.set('search', opts.search.trim());
    return (await this.call<Json[]>('GET', this.url(`/media?${q}`))).map(toMedia);
  }

  /** Uploads a picture under its file name, tagged with its permanent id. */
  async uploadMedia(blob: Blob, name: string, opts: { uid: string; title?: string; alt?: string }): Promise<WpMedia> {
    const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
    const up = await this.call('POST', this.url('/media'), blob, { 'Content-Type': blob.type || 'image/jpeg', 'Content-Disposition': `attachment; filename="${safe}"` });
    const id = num(up.id);
    if (!id) throw new WpError('Upload finished but WordPress returned no picture id.');
    const tagged = await this.json('POST', this.url(`/media/${id}?context=edit`), {
      description: `${UID_TAG}${opts.uid}`,
      ...(opts.title ? { title: opts.title } : {}),
      ...(opts.alt !== undefined ? { alt_text: opts.alt } : {}),
    });
    return toMedia({ ...up, ...tagged });
  }

  async deleteMedia(id: number): Promise<void> {
    await this.call('DELETE', this.url(`/media/${id}?force=true`));
  }

  /** The bytes of an uploaded picture (through the theme: uploads have no CORS). */
  async download(id: number): Promise<Blob> {
    const j = await this.call('GET', this.url(`/file/${id}`, 'creative/v1'));
    const bin = atob(text(j.data));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: text(j.mime) || 'application/octet-stream' });
  }

  async post(id: number): Promise<WpPost> {
    return toPost(await this.call('GET', this.url(`/posts/${id}?context=edit`)));
  }

  /** The newest posts (or a search), any author. */
  async listPosts(opts: { search?: string; page?: number } = {}): Promise<WpPost[]> {
    const q = new URLSearchParams({ per_page: String(PER_PAGE), page: String(opts.page ?? 1), context: 'edit', status: 'publish', _fields: 'id,title,link,date_gmt,modified_gmt,status,categories,featured_media,meta' });
    if (opts.search?.trim()) q.set('search', opts.search.trim());
    return (await this.call<Json[]>('GET', this.url(`/posts?${q}`))).map(toPost);
  }

  /** Creates (id null) or updates a post. */
  async savePost(id: number | null, body: PostBody): Promise<WpPost> {
    return toPost(await this.json('POST', this.url(id ? `/posts/${id}?context=edit` : '/posts?context=edit'), body));
  }

  /** Removes one meta key from a post (an old WP Studio manifest once republished). */
  async clearMeta(id: number, key: string): Promise<void> {
    await this.json('POST', this.url(`/posts/${id}`), { meta: { [key]: null } });
  }

  /** Small preview URLs for pictures (the POSTS list), by WordPress id. */
  async thumbs(ids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    const want = [...new Set(ids.filter((x) => x > 0))];
    if (!want.length) return out;
    const list = await this.call<Json[]>('GET', this.url(`/media?include=${want.join(',')}&per_page=100&_fields=id,source_url,media_details`));
    for (const j of list) {
      const sizes = ((j.media_details ?? {}) as Json).sizes as Record<string, Json> | undefined;
      out.set(num(j.id), text(sizes?.medium?.source_url) || text(sizes?.thumbnail?.source_url) || text(j.source_url));
    }
    return out;
  }
}
