// PUBLISH (PUBLISH §9): the post being made from the tiles in TILES — its
// name, its categories and its layout — and the Publish button. The layout
// is rows: a tile fills a row, or half of one. Hold a tile and drag it:
// to a row's left or right side it takes that half (the tile there moves
// down to a row of its own); to a row's middle it takes the whole row (the
// tiles there move above and below); between rows it gets a new row. Tap a
// tile to edit it.
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Plus, RotateCcw, Send, X } from 'lucide-react';
import { drop, reconcile, type Layout, type Zone } from '../core/postLayout';
import { emptyDraft, publishStore, type PostDraft, type TileSummary } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { ConflictError, clearPost, publishPost } from '../wp/pipeline';
import type { WpCategory } from '../wp/WpClient';
import { openTile } from './session';
import { Thumb } from './TilesTab';
import { useLongDrag } from './useLongDrag';
import { pipelineDeps, wpClient } from './wpSession';

const st = usePublishStore.getState;
type Target = { at: number; zone: Zone };
const GAP = 6;

function zoneAt(x: number, y: number, r: DOMRect): Zone {
  const rx = (x - r.left) / r.width;
  const ry = (y - r.top) / r.height;
  if (ry < 0.14) return 'before';
  if (ry > 0.86) return 'after';
  return rx < 0.34 ? 'left' : rx > 0.66 ? 'right' : 'center';
}

export function PublishTab() {
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [tiles, setTiles] = useState<Map<string, TileSummary>>(new Map());
  const [cats, setCats] = useState<WpCategory[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ text: string; conflict?: boolean } | null>(null);
  const [discard, setDiscard] = useState(false);
  const [width, setWidth] = useState(240);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await publishStore();
      const [d, ws, list, cached] = await Promise.all([s.draft(), s.syncedWorkspace(), s.listTiles(), s.setting<WpCategory[]>('categories', [])]);
      if (!alive) return;
      const layout = reconcile(d.layout, ws.live);
      setDraft({ ...d, layout });
      setTiles(new Map(list.map((t) => [t.id, t])));
      setCats(cached);
      const wp = await wpClient();
      if (!wp) return;
      const fresh = await wp.categories().catch(() => null);
      if (fresh && alive) {
        setCats(fresh);
        await s.setSetting('categories', fresh);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loaded = draft !== null;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(el.clientWidth - 32, 240)));
    ro.observe(el);
    return () => ro.disconnect();
    // The page exists once the draft has loaded.
  }, [loaded]);

  const save = (patch: Partial<PostDraft>) => {
    setDraft((d) => {
      const next = { ...(d ?? emptyDraft()), ...patch };
      void publishStore().then((s) => s.setDraft(next));
      return next;
    });
  };

  const layout: Layout = draft?.layout ?? [];
  const { drag, over, handle } = useLongDrag<Target>({
    scroller: () => root.current?.closest('.pb-main') ?? null,
    target: (x, y) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const row = el?.closest<HTMLElement>('[data-row]');
      if (row) return { at: Number(row.dataset.row), zone: zoneAt(x, y, row.getBoundingClientRect()) };
      const rows = root.current?.querySelector('.pb-rows')?.getBoundingClientRect();
      if (!rows || x < rows.left - 40 || x > rows.right + 40) return null;
      if (y < rows.top) return { at: 0, zone: 'before' };
      if (y > rows.bottom) return { at: layout.length - 1, zone: 'after' };
      return null;
    },
    drop: (id, t) => save({ layout: drop(layout, id, t.at, t.zone) }),
  });

  if (!draft) return null;
  const count = layout.reduce((n, r) => n + (r.kind === 'full' ? 1 : (r.left ? 1 : 0) + (r.right ? 1 : 0)), 0);
  const editing = draft.wpId != null;
  const toggle = (id: number) => save({ categories: draft.categories.includes(id) ? draft.categories.filter((c) => c !== id) : [...draft.categories, id] });
  const addCategory = () => {
    const name = adding?.trim();
    setAdding(null);
    if (!name) return;
    const known = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (known) return void (!draft.categories.includes(known.id) && toggle(known.id));
    if (!(draft.newCategories ?? []).some((n) => n.toLowerCase() === name.toLowerCase())) save({ newCategories: [...(draft.newCategories ?? []), name] });
  };

  const publish = async (force = false) => {
    setProblem(null);
    await (await publishStore()).setDraft(draft);
    const wp = await wpClient();
    if (!wp) {
      st().showToast('Set up your WordPress site first.');
      return st().set({ tab: 'settings' });
    }
    st().set({ busy: 'Starting…' });
    try {
      await publishPost(await pipelineDeps(wp), { newCategories: draft.newCategories, force });
      st().set({ busy: null, tab: 'posts' });
      st().showToast(editing ? 'Post updated.' : 'Published.');
    } catch (e) {
      st().set({ busy: null });
      if (e instanceof ConflictError) setProblem({ text: 'Someone changed this post on WordPress after you opened it. Publishing replaces their changes.', conflict: true });
      else setProblem({ text: e instanceof Error ? e.message : String(e) });
    }
  };

  const dropChanges = async () => {
    setDiscard(false);
    await clearPost(await publishStore());
    setDraft(emptyDraft());
    setTiles(new Map());
    st().showToast('Changes dropped. The post on WordPress is unchanged.');
  };

  const cellW = (width - GAP) / 2;
  const cell = (id: string | null, w: number, side: string) => {
    const t = id ? tiles.get(id) : null;
    if (!id || !t)
      return (
        <div key={side} className="pb-cell empty" style={{ width: w }}>
          <span>Empty half</span>
        </div>
      );
    return (
      <button key={side} className={`pb-cell${drag?.id === id ? ' lifted' : ''}`} style={{ width: w }} aria-label={`Edit ${t.name}`} onClick={() => void openTile(id)} {...handle(id)}>
        <Thumb id={id} stamp={t.updatedAt} />
        {t.legacy && <span className="pb-dot" />}
      </button>
    );
  };

  return (
    <div className="pb-compose" ref={root}>
      {editing && (
        <div className="pb-editing">
          <span>Updating a published post{draft.legacy ? ' (old format)' : ''}</span>
          {draft.link && (
            <a href={draft.link} target="_blank" rel="noreferrer" aria-label="Open on the site">
              <ExternalLink size={16} />
            </a>
          )}
          <button className="pb-pill ghost sm" onClick={() => (discard ? void dropChanges() : setDiscard(true))}>
            <RotateCcw size={14} /> {discard ? 'Tap again: drop changes' : 'Drop changes'}
          </button>
        </div>
      )}
      <input className="pb-title" value={draft.title} placeholder="Post name" aria-label="Post name" maxLength={120} onChange={(e) => save({ title: e.target.value })} />
      <div className="pb-chips" aria-label="Categories">
        {cats.map((c) => (
          <button key={c.id} className={`pb-chip${draft.categories.includes(c.id) ? ' on' : ''}`} aria-pressed={draft.categories.includes(c.id)} onClick={() => toggle(c.id)}>
            {c.name}
          </button>
        ))}
        {(draft.newCategories ?? []).map((n) => (
          <button key={n} className="pb-chip on new" aria-label={`Remove new category ${n}`} onClick={() => save({ newCategories: draft.newCategories!.filter((x) => x !== n) })}>
            {n} <X size={12} />
          </button>
        ))}
        {adding === null ? (
          <button className="pb-chip add" onClick={() => setAdding('')}>
            <Plus size={14} /> Category
          </button>
        ) : (
          <input className="pb-chip-input" autoFocus value={adding} placeholder="New category" aria-label="New category" onChange={(e) => setAdding(e.target.value)} onBlur={addCategory} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
        )}
      </div>

      {count ? (
        <>
          <p className="pb-hint center">Hold and drag a tile · sides make half width · middle makes full width</p>
          <div className="pb-rows" style={{ width }}>
            {layout.map((r, i) => (
              <div key={r.kind === 'full' ? r.id : `${r.left}|${r.right}|${i}`} className={`pb-prow${over?.at === i ? ` z-${over.zone}` : ''}`} data-row={i}>
                {r.kind === 'full' ? cell(r.id, width, 'full') : [cell(r.left, cellW, 'left'), cell(r.right, cellW, 'right')]}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="pb-empty">
          <p>No tiles in this post yet.</p>
          <p className="pb-hint">Make tiles in TILES; they appear here in order.</p>
          <button className="pb-pill" onClick={() => st().set({ tab: 'tiles' })}>
            Go to Tiles
          </button>
        </div>
      )}

      <div className="pb-publish-bar">
        {problem && (
          <div className="pb-problem" role="alert">
            <p>{problem.text}</p>
            <div className="pb-row">
              <button className="pb-pill ghost" onClick={() => setProblem(null)}>
                {problem.conflict ? 'Cancel' : 'OK'}
              </button>
              {problem.conflict && (
                <button className="pb-pill danger" onClick={() => void publish(true)}>
                  Publish anyway
                </button>
              )}
            </div>
          </div>
        )}
        <button className="pb-publish" disabled={!count || !draft.title.trim()} onClick={() => void publish()}>
          <Send size={18} /> {editing ? 'Update post' : 'Publish'}
        </button>
        {(!count || !draft.title.trim()) && <p className="pb-hint center">{!count ? 'Add tiles to publish.' : 'Give the post a name.'}</p>}
      </div>
      {drag && tiles.get(drag.id) && (
        <div className="pb-ghost" style={{ left: drag.x - 45, top: drag.y - 50, width: 90 }}>
          <Thumb id={drag.id} stamp={tiles.get(drag.id)!.updatedAt} />
        </div>
      )}
    </div>
  );
}
