// TILES (PUBLISH §3): every tile, newest first, as 9:16 thumbnails; + makes a
// new 9:16 tile and opens it. ⋯ renames, duplicates or deletes (a second tap
// confirms — no dialogs).
import { useEffect, useState } from 'react';
import { Copy, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import { publishStore, type TileSummary } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { newTile, openTile } from './session';

const st = usePublishStore.getState;

function Thumb({ id, stamp }: { id: string; stamp: string }) {
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
  return <div className="pb-thumb">{url && <img src={url} alt="" />}</div>;
}

export function TilesTab() {
  const [items, setItems] = useState<TileSummary[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const refresh = () => void publishStore().then((s) => s.listTiles().then(setItems));
  useEffect(refresh, []);

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

  return (
    <div className="pb-tiles">
      {items && !items.length && (
        <div className="pb-empty">
          <p>No tiles yet.</p>
          <p className="pb-hint">Tap + to make a 9:16 tile.</p>
        </div>
      )}
      <div className="pb-grid">
        {items?.map((t) => (
          <div key={t.id} className="pb-card">
            <button className="pb-open" onClick={() => void openTile(t.id)} aria-label={`Open ${t.name}`}>
              <Thumb id={t.id} stamp={t.updatedAt} />
            </button>
            <div className="pb-card-foot">
              {renaming?.id === t.id ? (
                <input className="pb-name-input" autoFocus value={renaming.text} aria-label="Tile name" onChange={(e) => setRenaming({ id: t.id, text: e.target.value })} onBlur={() => void rename()} onKeyDown={(e) => e.key === 'Enter' && void rename()} />
              ) : (
                <span className="pb-card-name">{t.name}</span>
              )}
              <button className="pb-icon sm" aria-label={`${t.name} actions`} onClick={() => (setMenu(menu === t.id ? null : t.id), setConfirm(null))}>
                <Ellipsis size={18} />
              </button>
            </div>
            {menu === t.id && (
              <div className="pb-menu">
                <button onClick={() => (setMenu(null), setRenaming({ id: t.id, text: t.name }))}>
                  <Pencil size={16} /> Rename
                </button>
                <button onClick={() => void act(async () => (await publishStore()).duplicateTile(t.id))}>
                  <Copy size={16} /> Duplicate
                </button>
                <button className="danger" onClick={() => (confirm === t.id ? void act(async () => (await publishStore()).deleteTile(t.id)) : setConfirm(t.id))}>
                  <Trash2 size={16} /> {confirm === t.id ? 'Tap again to delete' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="pb-fab" aria-label="New tile" onClick={() => void newTile().catch((e) => st().showToast(String(e)))}>
        <Plus size={28} />
      </button>
    </div>
  );
}
