// TILES (PUBLISH §3): the tiles of the next post, in post order, and below
// them the Drafts kept aside (never published). + makes a new 9:16 tile at
// the end of the post. Hold a tile and drag it to reorder it or to move it
// between the post and Drafts; ⋯ does the same plus rename, duplicate and
// delete (a second tap confirms — no dialogs). A red dot marks a tile made
// from an old post.
import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, Archive, Copy, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import { publishStore, type PostDraft, type TileSummary, type Workspace } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { newTile, openTile } from './session';
import { useLongDrag } from './useLongDrag';

const st = usePublishStore.getState;
type Section = 'live' | 'drafts';
type Target = { section: Section; index: number };

export function Thumb({ id, stamp }: { id: string; stamp: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void publishStore()
      .then((s) => s.thumb(id))
      .then((b) => {
        if (!alive || !b) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, stamp]);
  return <div className="pb-thumb">{url && <img src={url} alt="" draggable={false} />}</div>;
}

/** Moves a tile to `to` (an index in the lists as they are, the tile still in place). */
export function moveTile(ws: Workspace, id: string, to: Target): Workspace {
  const from: Section = ws.live.includes(id) ? 'live' : 'drafts';
  const fromIndex = ws[from].indexOf(id);
  const next = { live: ws.live.filter((x) => x !== id), drafts: ws.drafts.filter((x) => x !== id) };
  const at = from === to.section && fromIndex < to.index ? to.index - 1 : to.index;
  next[to.section].splice(Math.max(0, Math.min(at, next[to.section].length)), 0, id);
  return next;
}

export function TilesTab() {
  const [tiles, setTiles] = useState<Map<string, TileSummary> | null>(null);
  const [ws, setWs] = useState<Workspace>({ live: [], drafts: [] });
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const refresh = () =>
    void publishStore().then(async (s) => {
      const [list, w, d] = await Promise.all([s.listTiles(), s.syncedWorkspace(), s.draft()]);
      setTiles(new Map(list.map((t) => [t.id, t])));
      setWs(w);
      setDraft(d);
    });
  useEffect(refresh, []);

  const save = async (next: Workspace) => {
    setWs(next);
    await (await publishStore()).setWorkspace(next);
  };

  const { drag, over, handle } = useLongDrag<Target>({
    scroller: () => root.current?.closest('.pb-main') ?? null,
    target: (x, y) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const card = el?.closest<HTMLElement>('[data-card]');
      if (card) {
        const r = card.getBoundingClientRect();
        return { section: card.dataset.section as Section, index: Number(card.dataset.index) + (x > r.left + r.width / 2 ? 1 : 0) };
      }
      const zone = el?.closest<HTMLElement>('[data-zone]');
      if (zone) {
        const section = zone.dataset.zone as Section;
        return { section, index: ws[section].length };
      }
      return null;
    },
    drop: (id, to) => void save(moveTile(ws, id, to)),
  });

  const act = async (fn: () => Promise<unknown>) => {
    setMenu(null);
    setConfirm(null);
    await fn();
    refresh();
  };
  const rename = async () => {
    if (!renaming) return;
    const t = renaming.text.trim();
    setRenaming(null);
    if (t) await (await publishStore()).renameTile(renaming.id, t.slice(0, 60));
    refresh();
  };
  const duplicate = (id: string, section: Section) =>
    act(async () => {
      const s = await publishStore();
      const copy = await s.duplicateTile(id);
      if (!copy) return;
      const list = [...ws[section]];
      list.splice(list.indexOf(id) + 1, 0, copy);
      await s.setWorkspace({ ...ws, [section]: list });
    });

  const card = (id: string, section: Section, index: number) => {
    const t = tiles?.get(id);
    if (!t) return null;
    const mark = over && over.section === section ? (over.index === index ? ' ins-before' : over.index === index + 1 && index === ws[section].length - 1 ? ' ins-after' : '') : '';
    return (
      <div key={id} className={`pb-card${drag?.id === id ? ' lifted' : ''}${mark}`} data-card data-section={section} data-index={index}>
        <button className="pb-open" onClick={() => void openTile(id)} aria-label={`Open ${t.name}`} {...handle(id)}>
          <Thumb id={id} stamp={t.updatedAt} />
          {t.legacy && <span className="pb-dot" title="From an old post: arrange it, then republish" />}
        </button>
        <div className="pb-card-foot">
          {renaming?.id === id ? (
            <input className="pb-name-input" autoFocus value={renaming.text} aria-label="Tile name" onChange={(e) => setRenaming({ id, text: e.target.value })} onBlur={() => void rename()} onKeyDown={(e) => e.key === 'Enter' && void rename()} />
          ) : (
            <span className="pb-card-name">{t.name}</span>
          )}
          <button className="pb-icon sm" aria-label={`${t.name} actions`} onClick={() => (setMenu(menu === id ? null : id), setConfirm(null))}>
            <Ellipsis size={18} />
          </button>
        </div>
        {menu === id && (
          <div className="pb-menu">
            <button onClick={() => (setMenu(null), setRenaming({ id, text: t.name }))}>
              <Pencil size={16} /> Rename
            </button>
            <button onClick={() => void duplicate(id, section)}>
              <Copy size={16} /> Duplicate
            </button>
            {section === 'live' ? (
              <button onClick={() => void act(() => save(moveTile(ws, id, { section: 'drafts', index: 0 })))}>
                <Archive size={16} /> Move to Drafts
              </button>
            ) : (
              <button onClick={() => void act(() => save(moveTile(ws, id, { section: 'live', index: ws.live.length })))}>
                <ArchiveRestore size={16} /> Move to the post
              </button>
            )}
            <button className="danger" onClick={() => (confirm === id ? void act(async () => (await publishStore()).deleteTile(id)) : setConfirm(id))}>
              <Trash2 size={16} /> {confirm === id ? 'Tap again to delete' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const ghost = drag && tiles?.get(drag.id);
  const editing = draft?.wpId != null;
  return (
    <div className="pb-tiles" ref={root}>
      <div className="pb-section-head">
        <h2>{editing ? 'Editing' : 'Next post'}</h2>
        <span>
          {draft?.title.trim() || 'Untitled'} · {ws.live.length} {ws.live.length === 1 ? 'tile' : 'tiles'}
        </span>
        {draft?.legacy && <span className="pb-dot inline" title="An old post" />}
      </div>
      <div className={`pb-grid${over?.section === 'live' ? ' target' : ''}`} data-zone="live">
        {ws.live.map((id, i) => card(id, 'live', i))}
        {tiles && !ws.live.length && (
          <div className="pb-slot">
            <p>No tiles yet.</p>
            <p className="pb-hint">Tap + to make a 9:16 tile.</p>
          </div>
        )}
      </div>
      <div className="pb-section-head drafts">
        <h2>Drafts</h2>
        <span>Kept aside · not published</span>
      </div>
      <div className={`pb-grid drafts${over?.section === 'drafts' ? ' target' : ''}`} data-zone="drafts">
        {ws.drafts.map((id, i) => card(id, 'drafts', i))}
        {!ws.drafts.length && (
          <div className="pb-slot">
            <p className="pb-hint">Hold a tile and drag it here to keep it for later.</p>
          </div>
        )}
      </div>
      <button className="pb-fab" aria-label="New tile" onClick={() => void newTile().catch((e) => st().showToast(String(e)))}>
        <Plus size={28} />
      </button>
      {drag && ghost && (
        <div className="pb-ghost" style={{ left: drag.x - 45, top: drag.y - 50, width: 90 }}>
          <Thumb id={drag.id} stamp={ghost.updatedAt} />
        </div>
      )}
    </div>
  );
}
