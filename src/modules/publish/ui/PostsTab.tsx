// POSTS (PUBLISH §11): the latest 25 posts, newest on top (published or
// opened here), and the pictures. Edit brings a post back: its tiles into
// TILES, its name, categories and layout into PUBLISH. Search finds any post
// or picture on WordPress. Old posts (not made by PUBLISH) carry a red dot.
import { useEffect, useState } from 'react';
import { CloudDownload, ExternalLink, Globe, Pencil, RefreshCw, Search, X } from 'lucide-react';
import type { MediaAsset } from '../core/types';
import { emptyDraft, publishStore, type PostDraft, type PostSummary } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { isOwnPost, pullPost, summaryOf } from '../wp/pipeline';
import type { WpMedia, WpPost } from '../wp/WpClient';
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
  return list.map((p) => summaryOf(p, !isOwnPost(p), thumbs.get(p.featuredMedia)));
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

function PostList() {
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [draft, setDraft] = useState<PostDraft>(emptyDraft());
  const [live, setLive] = useState(0);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PostSummary[] | null>(null);
  const [ask, setAsk] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const s = await publishStore();
    const [p, d, ws] = await Promise.all([s.posts(), s.draft(), s.syncedWorkspace()]);
    setPosts(p);
    setDraft(d);
    setLive(ws.live.length);
    return p;
  };

  const refresh = async (quiet = false) => {
    const wp = quiet ? await wpClient() : await client();
    if (!wp) return;
    setLoading(true);
    try {
      const latest = await withThumbs(await wp.listPosts());
      const s = await publishStore();
      const mine = await s.posts();
      const fresh = new Map(latest.map((p) => [p.wpId, p]));
      // Known posts get their current title and preview; an empty list starts from the site's newest.
      const next = mine.length ? mine.map((p) => (fresh.has(p.wpId) ? { ...p, ...fresh.get(p.wpId)!, thumb: fresh.get(p.wpId)!.thumb ?? p.thumb } : p)) : latest;
      await s.setPosts(next);
      setPosts(next);
    } catch (e) {
      if (!quiet) st().showToast(errText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void publishStore()
      .then(() => load())
      .then((p) => {
        if (!p.length) void refresh(true);
      });
  }, []);

  const search = async () => {
    const q = query.trim();
    if (!q) return setFound(null);
    const wp = await client();
    if (!wp) return;
    setLoading(true);
    try {
      setFound(await withThumbs(await wp.listPosts({ search: q })));
    } catch (e) {
      st().showToast(errText(e));
    } finally {
      setLoading(false);
    }
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
      st().showToast(p.legacy ? 'Old post opened as tiles — arrange them, then publish.' : 'Opened. Edit its tiles in Tiles.');
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
        <div className="pb-post-thumb">{p.thumb && <img src={p.thumb} alt="" loading="lazy" />}</div>
        <div className="pb-post-text">
          <span className="pb-post-title">
            {p.legacy && <span className="pb-dot inline" title="Old format" />}
            {(editing && draft.title.trim()) || p.title || 'Untitled'}
          </span>
          <span className="pb-hint">{editing ? 'Being edited' : day(p.date)}</span>
          {ask === p.wpId && (
            <div className="pb-ask" role="alert">
              <p>
                Your {live} {live === 1 ? 'tile' : 'tiles'} in progress will move to Drafts.
              </p>
              <div className="pb-row">
                <button className="pb-pill ghost" onClick={() => setAsk(null)}>
                  Cancel
                </button>
                <button className="pb-pill primary" onClick={() => void edit(p, true)}>
                  Move and edit
                </button>
              </div>
            </div>
          )}
        </div>
        {p.link && (
          <a className="pb-icon sm" href={p.link} target="_blank" rel="noreferrer" aria-label={`Open ${p.title} on the site`}>
            <ExternalLink size={18} />
          </a>
        )}
        <button className="pb-icon sm" aria-label={`Edit ${p.title}`} onClick={() => void edit(p)}>
          <Pencil size={18} />
        </button>
      </li>
    );
  };

  return (
    <>
      <form
        className="pb-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Search size={18} />
        <input value={query} placeholder="Search posts on WordPress" aria-label="Search posts" enterKeyHint="search" onChange={(e) => setQuery(e.target.value)} />
        {found ? (
          <button type="button" className="pb-icon sm" aria-label="Clear search" onClick={() => (setFound(null), setQuery(''))}>
            <X size={18} />
          </button>
        ) : (
          <button type="button" className="pb-icon sm" aria-label="Refresh from WordPress" onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        )}
      </form>
      {found ? (
        <>
          <p className="pb-label pad">On WordPress · {found.length}</p>
          <ul className="pb-post-list">{found.map(item)}</ul>
        </>
      ) : (
        <>
          {posts && !posts.length && (
            <div className="pb-empty">
              <p>No posts yet.</p>
              <p className="pb-hint">Posts you publish appear here, newest first.</p>
            </div>
          )}
          <ul className="pb-post-list">{posts?.map(item)}</ul>
        </>
      )}
    </>
  );
}

function MediaList() {
  const [mine, setMine] = useState<MediaAsset[] | null>(null);
  const [wpList, setWpList] = useState<WpMedia[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const loadMine = () => void publishStore().then((s) => s.listMedia().then(setMine));

  const loadWp = async (search?: string) => {
    const wp = await wpClient();
    if (!wp) return setWpList([]);
    setLoading(true);
    try {
      setWpList(await wp.listMedia({ search }));
    } catch (e) {
      st().showToast(errText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadMine();
    void publishStore().then(() => loadWp());
  }, []);

  const have = new Set(mine?.flatMap((m) => (m.wpMediaId ? [m.wpMediaId] : [])));
  const pull = async (m: WpMedia) => {
    const wp = await client();
    if (!wp) return;
    const s = await publishStore();
    if (m.uid && (await s.mediaByUid(m.uid))) return st().showToast('Already on this phone.');
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
      <p className="pb-label pad">On this phone · {mine?.length ?? 0}</p>
      <div className="pb-media-grid pad">
        {mine?.map((m) => (
          <div key={m.id} className="pb-media">
            <div className="pb-media-pick">
              <MediaThumb m={m} />
              {m.wpMediaId && <Globe size={14} className="pb-badge" aria-label="On WordPress" />}
            </div>
            <span className="pb-media-name">{m.name}</span>
          </div>
        ))}
      </div>
      {mine && !mine.length && <p className="pb-hint pad">Pictures you add to tiles appear here.</p>}
      <form
        className="pb-search"
        onSubmit={(e) => {
          e.preventDefault();
          void loadWp(query);
        }}
      >
        <Search size={18} />
        <input value={query} placeholder="Search pictures on WordPress" aria-label="Search pictures" enterKeyHint="search" onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="pb-icon sm" aria-label="Refresh" onClick={() => void loadWp(query)}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </form>
      <p className="pb-label pad">On WordPress{wpList ? ` · ${wpList.length}` : ''}</p>
      <div className="pb-media-grid pad">
        {wpList?.map((m) => (
          <div key={m.id} className="pb-media">
            <button className="pb-media-pick" aria-label={`Download ${m.title}`} onClick={() => void pull(m)}>
              <div className="pb-media-thumb">
                <img src={m.thumb} alt="" loading="lazy" />
              </div>
              {!have.has(m.id) && <CloudDownload size={14} className="pb-badge" />}
            </button>
            <span className="pb-media-name">{decodeURIComponent(m.url.split('/').pop() ?? '')}</span>
          </div>
        ))}
      </div>
    </>
  );
}
