// Sketch gallery (SKETCH §21): newest first; open, rename, duplicate,
// share PNG, delete (a second tap confirms — no dialog).
import { NoteButton } from '../../../shared/NoteButton';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Ellipsis, Plus, Settings, Share2, Trash2 } from 'lucide-react';
import { projectStore, type ProjectSummary } from '../storage/ProjectStore';
import { useSketchStore } from '../state/useSketchStore';
import { newProject, shareProject } from './session';

const st = useSketchStore.getState;

function Thumb({ id, stamp }: { id: string; stamp: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void projectStore()
      .then((s) => s.thumbnail(id))
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
  return <div className="sk-thumb">{url && <img src={url} alt="" />}</div>;
}

export function Gallery({ onExit }: { onExit: () => void }) {
  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const toast = useSketchStore((s) => s.toast);
  const saving = useSketchStore((s) => s.saving);

  const refresh = () => void projectStore().then((s) => s.list().then(setItems));
  // Also after the sketch just closed has finished saving (fresh thumbnail).
  useEffect(refresh, [saving]);

  const open = (id: string) => st().set({ page: 'editor', projectId: id });
  const act = async (fn: () => Promise<unknown>) => {
    setMenu(null);
    setConfirm(null);
    try {
      await fn();
    } catch (e) {
      if (!/cancel/i.test(String(e))) st().showToast(e instanceof Error ? e.message : String(e));
    }
    refresh();
  };
  const commitRename = async () => {
    if (!renaming) return;
    const t = renaming.text.trim();
    setRenaming(null);
    if (t) await (await projectStore()).rename(renaming.id, t.slice(0, 60));
    refresh();
  };

  return (
    <div className="sk-gallery">
      <header className="sk-gal-head">
        <button className="sk-icon" onClick={onExit} aria-label="CREATIVE home">
          <ArrowLeft size={22} />
        </button>
        <h1>Sketch</h1>
        <NoteButton className="sk-icon" size={22} />
        <button className="sk-icon" onClick={() => st().set({ page: 'settings', back: 'gallery' })} aria-label="Settings">
          <Settings size={22} />
        </button>
      </header>
      <div className="sk-grid">
        <button className="sk-card sk-new" onClick={() => void newProject().then(open)}>
          <Plus size={32} />
          <span>New</span>
        </button>
        {items?.map((p) => (
          <div key={p.id} className="sk-card">
            <button className="sk-open" onClick={() => open(p.id)} aria-label={`Open ${p.name}`}>
              <Thumb id={p.id} stamp={p.updatedAt} />
            </button>
            <div className="sk-card-foot">
              {renaming?.id === p.id ? (
                <input className="sk-input" autoFocus value={renaming.text} aria-label="Sketch name" onChange={(e) => setRenaming({ id: p.id, text: e.target.value })} onBlur={() => void commitRename()} onKeyDown={(e) => e.key === 'Enter' && void commitRename()} />
              ) : (
                <button className="sk-name" onClick={() => setRenaming({ id: p.id, text: p.name })}>
                  {p.name}
                </button>
              )}
              <button className="sk-icon" onClick={() => (setMenu(menu === p.id ? null : p.id), setConfirm(null))} aria-label={`${p.name} actions`}>
                <Ellipsis size={18} />
              </button>
            </div>
            {menu === p.id && (
              <div className="sk-card-menu">
                <button onClick={() => void act(() => shareProject(p.id))}>
                  <Share2 size={16} /> Share PNG
                </button>
                <button onClick={() => void act(async () => (await projectStore()).duplicate(p.id))}>
                  <Copy size={16} /> Duplicate
                </button>
                <button className="danger" onClick={() => (confirm === p.id ? void act(async () => (await projectStore()).remove(p.id)) : setConfirm(p.id))}>
                  <Trash2 size={16} /> {confirm === p.id ? 'Tap again to delete' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {items && !items.length && <p className="sk-hint center">Tap New to start drawing.</p>}
      {toast && <div className="sk-toast">{toast}</div>}
    </div>
  );
}
