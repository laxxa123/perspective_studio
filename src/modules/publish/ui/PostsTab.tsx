// POSTS (PUBLISH §11): the latest 25 posts, newest on top (published or
// opened here), then every other post on the site as you scroll; and the
// pictures. Tapping a post brings it back for editing: its tiles into TILES,
// its name, categories and layout into PUBLISH (an old post is converted on
// the way). Search covers every post and picture on WordPress. A dot marks
// an old post: red = ordinary WordPress post, yellow = WP Studio.
import { useEffect, useRef, useState } from 'react';
import { CloudDownload, ExternalLink, Globe, RefreshCw, Search, X } from 'lucide-react';
import type { MediaAsset } from '../core/types';
import { emptyDraft, publishStore, type PostDraft, type PostSummary } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { originOf, pullPost, summaryOf } from '../wp/pipeline';
import { PER_PAGE, type WpMedia, type WpPost } from '../wp/WpClient';
import { MediaThumb } from './MediaSheet';
import { pipelineDeps, wpClient } from './wpSession';

const st = usePublishStore.getState;
const day = (iso: string) => {
  const d = new Date(iso.endsWith('Z') || !iso ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function client() {
  const wp = await wpClient();
  if (!wp) {
    st().showToast('Set up your WordPress site first.');
    st().set({ tab: 'settings' });
  }
  return wp;
}

/** Previews for posts that have a featured picture but no preview yet. */
async function withThumbs(list: WpPost[]): Promise<PostSummary[]> {
  const wp = await wpClient();
  const thumbs = wp ? await wp.thumbs(list.map((p) => p.featuredMedia)).catch(() => new Map<number, string>()) : new Map<number, string>();
  return list.map((p) => summaryOf(p, originOf(p), thumbs.get(p.featuredMedia)));
}

export function PostsTab() {
  const [seg, setSeg] = useState<'posts' | 'media'>('posts');
  return (
    <div className="pb-posts">
      <div className="pb-seg wide" role="tablist">
        <button role="tab" aria-selected={seg === 'posts'} className={seg === 'posts' ? 'on' : ''} onClick={() => setSeg('posts')}>
          Posts
        </button>
        <button role="tab" aria-selected={seg === 'media'} className={seg === 'media' ? 'on' : ''} onClick={() => setSeg('media')}>
          Media
        </button>
      </div>
      {seg === 'posts' ? <PostList /> : <MediaList />}
    </div>
  );
}

/** Pages from WordPress, loaded as the list scrolls to its end. */
function usePages<T>(load: (page: number, query: string) => Promise<T[]>) {
  const [state, setState] = useState<{ query: string; items: T[]; page: number; done: boolean; loading: boolean }>({ query: '', items: [], page: 0, done: false, loading: false });
  const busy = useRef(false);
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  });
  const more = async (query = ref.current.query, fresh = false) => {
    const cur = fresh || query !== ref.current.query ? { query, items: [] as T[], page: 0, done: false, loading: false } : ref.current;
    if (busy.current || cur.done) return;
    busy.current = true;
    setState({ ...cur, loading: true });
    try {
      const next = await load(cur.page + 1, query);
      setState({ query, items: [...cur.items, ...next], page: cur.page + 1, done: next.length < PER_PAGE, loading: false });
    } catch (e) {
      // Past the last page WordPress answers with an error: the list is complete.
      setState({ ...cur, done: true, loading: false });
      if (cur.page === 0) st().showToast(errText(e));
    } finally {
      busy.current = false;
    }
  };
  return { ...state, more };
}

/** Calls `onEnd` when its element is in view (again after each page, `n`). */
function End({ onEnd, active, n }: { onEnd: () => void; active: boolean; n: number }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onEnd);
  useEffect(() => {
    cb.current = onEnd;
  });
  useEffect(() => {
    if (!active || !el.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && cb.current(), { rootMargin: '300px' });
    io.observe(el.current);
    return () => io.disconnect();
  }, [active, n]);
  return <div ref={el} className="pb-end" />;
}

function PostList() {
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [draft, setDraft] = useState<PostDraft>(emptyDraft());
  const [live, setLive] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [ask, setAsk] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const site = usePages<PostSummary>(async (page, q) => {
    const wp = await wpClient();
    return wp ? withThumbs(await wp.listPosts({ page, search: q })) : [];
  });

  const load = async () => {
    const s = await publishStore();
    const [p, d, ws] = await Promise.all([s.posts(), s.draft(), s.syncedWorkspace()]);
    setPosts(p);
    setDraft(d);
    setLive(ws.live.length);
    return p;
  };

  const refresh = async () => {
    const wp = await client();
    if (!wp) return;
    setLoading(true);
    try {
      const latest = await withThumbs(await wp.listPosts());
      const s = await publishStore();
      const fresh = new Map(latest.map((p) => [p.wpId, p]));
      // Known posts get their current title and preview; an empty list starts from the site's newest.
      const mine = await s.posts();
      const next = mine.length ? mine.map((p) => (fresh.has(p.wpId) ? { ...p, ...fresh.get(p.wpId)!, thumb: fresh.get(p.wpId)!.thumb ?? p.thumb } : p)) : latest;
      await s.setPosts(next);
      setPosts(next);
      void site.more('', true);
    } catch (e) {
      st().showToast(errText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void publishStore()
      .then(() => load())
      .then(async (p) => {
        if (p.length || !(await wpClient())) return;
        const s = await publishStore();
        const wp = (await wpClient())!;
        const latest = await withThumbs(await wp.listPosts()).catch(() => []);
        await s.setPosts(latest);
        setPosts(latest);
      });
  }, []);

  const search = () => {
    const q = query.trim();
    setSearching(!!q);
    void site.more(q, true);
  };

  const edit = async (p: PostSummary, moveAside = false) => {
    setAsk(null);
    if (draft.wpId === p.wpId) return st().set({ tab: 'publish' });
    if (live && !moveAside) return setAsk(p.wpId);
    const wp = await client();
    if (!wp) return;
    const s = await publishStore();
    if (moveAside) {
      // The tiles in progress are kept, aside in Drafts.
      const ws = await s.syncedWorkspace();
      await s.setWorkspace({ live: [], drafts: [...ws.live, ...ws.drafts] });
      await s.setDraft(emptyDraft());
    }
    st().set({ busy: 'Opening the post…' });
    try {
      await pullPost(await pipelineDeps(wp), p.wpId);
      st().set({ busy: null, tab: 'publish' });
      st().showToast(p.legacy ? 'Converted into tiles — check them, then publish.' : 'Opened. Edit its tiles in Tiles.');
    } catch (e) {
      st().set({ busy: null });
      st().showToast(errText(e));
      void load();
    }
  };

  const item = (p: PostSummary) => {
    const editing = draft.wpId === p.wpId;
    return (
      <li key={p.wpId} className={`pb-post${editing ? ' editing' : ''}`}>
        <button className="pb-post-main" aria-label={`Edit ${p.title || 'Untitled'}`} onClick={() => void edit(p)}>
          <div className="pb-post-thumb">{p.thumb && <img src={p.thumb} alt="" loading="lazy" />}</div>
          <div className="pb-post-text">
            <span className="pb-post-title">
              {p.legacy && <span className={`pb-dot inline ${p.legacy}`} title={p.legacy === 'wpstudio' ? 'WP Studio post' : 'Ordinary WordPress post'} />}
              {(editing && draft.title.trim()) || p.title || 'Untitled'}
            </span>
            <span className="pb-hint">{editing ? 'Being edited' : day(p.date)}</span>
          </div>
        </button>
        {p.link && (
          <a className="pb-icon sm" href={p.link} target="_blank" rel="noreferrer" aria-label={`Open ${p.title} on the site`}>
            <ExternalLink size={16} />
          </a>
        )}
        {ask === p.wpId && (
          <div className="pb-ask" role="alert">
            <p>
              Your {live} {live === 1 ? 'tile' : 'tiles'} in progress will move to Drafts.
            </p>
            <div className="pb-row">
              <button className="pb-pill ghost sm" onClick={() => setAsk(null)}>
                Cancel
              </button>
              <button className="pb-pill primary sm" onClick={() => void edit(p, true)}>
                Move and edit
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  const known = new Set(posts?.map((p) => p.wpId));
  const rest = searching ? site.items : site.items.filter((p) => !known.has(p.wpId));
  return (
    <>
      <form
        className="pb-search"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Search size={16} />
        <input value={query} placeholder="Search all posts" aria-label="Search posts" enterKeyHint="search" onChange={(e) => setQuery(e.target.value)} />
        {searching ? (
          <button type="button" className="pb-icon sm" aria-label="Clear search" onClick={() => (setSearching(false), setQuery(''), void site.more('', true))}>
            <X size={16} />
          </button>
        ) : (
          <button type="button" className="pb-icon sm" aria-label="Refresh from WordPress" onClick={() => void refresh()}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        )}
      </form>
      {!searching && posts && !posts.length && !site.items.length && (
        <div className="pb-empty">
          <p>No posts yet.</p>
          <p className="pb-hint">Posts you publish appear here, newest first.</p>
        </div>
      )}
      <ul className="pb-post-list">
        {!searching && posts?.map(item)}
        {!searching && rest.length > 0 && <li className="pb-label pad">Older on WordPress</li>}
        {rest.map(item)}
      </ul>
      {searching && site.done && !site.items.length && <p className="pb-hint pad">Nothing found.</p>}
      {site.loading && <p className="pb-hint pad center">Loading…</p>}
      <End active={!site.done && !site.loading && posts !== null} n={site.page} onEnd={() => void site.more()} />
    </>
  );
}

function MediaList() {
  const [mine, setMine] = useState<MediaAsset[] | null>(null);
  const [query, setQuery] = useState('');
  const site = usePages<WpMedia>(async (page, q) => {
    const wp = await wpClient();
    return wp ? wp.listMedia({ page, search: q }) : [];
  });
  const loadMine = () => void publishStore().then((s) => s.listMedia().then(setMine));
  useEffect(loadMine, []);

  const have = new Set(mine?.flatMap((m) => (m.wpMediaId ? [m.wpMediaId] : [])));
  const pull = async (m: WpMedia) => {
    const wp = await client();
    if (!wp) return;
    const s = await publishStore();
    if (have.has(m.id) || (m.uid && (await s.mediaByUid(m.uid)))) return st().showToast('Already on this phone.');
    st().set({ busy: 'Downloading…' });
    try {
      const blob = await wp.download(m.id);
      const name = decodeURIComponent(m.url.split('/').pop() || `picture-${m.id}.jpg`);
      await s.addMedia(blob, { width: m.width, height: m.height, source: 'wordpress', wpMediaId: m.id, wpUrl: m.url, name });
      st().showToast('Added to Media — use it in any tile.');
      loadMine();
    } catch (e) {
      st().showToast(errText(e));
    } finally {
      st().set({ busy: null });
    }
  };

  return (
    <>
      <form
        className="pb-search"
        onSubmit={(e) => {
          e.preventDefault();
          void site.more(query.trim(), true);
        }}
      >
        <Search size={16} />
        <input value={query} placeholder="Search all pictures" aria-label="Search pictures" enterKeyHint="search" onChange={(e) => setQuery(e.target.value)} />
        {site.query ? (
          <button type="button" className="pb-icon sm" aria-label="Clear search" onClick={() => (setQuery(''), void site.more('', true))}>
            <X size={16} />
          </button>
        ) : null}
      </form>
      {!site.query && (
        <>
          <p className="pb-label pad">On this phone · {mine?.length ?? 0}</p>
          <div className="pb-media-grid pad">
            {mine?.map((m) => (
              <div key={m.id} className="pb-media">
                <div className="pb-media-pick">
                  <MediaThumb m={m} />
                  {m.wpMediaId && <Globe size={12} className="pb-badge" aria-label="On WordPress" />}
                </div>
                <span className="pb-media-name">{m.name}</span>
              </div>
            ))}
          </div>
          {mine && !mine.length && <p className="pb-hint pad">Pictures you add to tiles appear here.</p>}
        </>
      )}
      <p className="pb-label pad">{site.query ? `On WordPress: “${site.query}”` : 'On WordPress'}</p>
      <div className="pb-media-grid pad">
        {site.items.map((m) => (
          <div key={m.id} className="pb-media">
            <button className="pb-media-pick" aria-label={`Download ${m.title}`} onClick={() => void pull(m)}>
              <div className="pb-media-thumb">
                <img src={m.thumb} alt="" loading="lazy" />
              </div>
              {!have.has(m.id) && <CloudDownload size={12} className="pb-badge" />}
            </button>
            <span className="pb-media-name">{decodeURIComponent(m.url.split('/').pop() ?? '')}</span>
          </div>
        ))}
      </div>
      {site.done && !site.items.length && <p className="pb-hint pad">{site.query ? 'Nothing found.' : 'No pictures on WordPress yet.'}</p>}
      {site.loading && <p className="pb-hint pad center">Loading…</p>}
      <End active={!site.done && !site.loading} n={site.page} onEnd={() => void site.more()} />
    </>
  );
}
