// The note panel (CREATIVE.md §2.4): copy (selection or all), optionally
// place on the page (PUBLISH), clear (with Undo), save, the three saved
// notes ① ② ③ (tap to open; hold to remove), close.
import { useEffect, useRef, useState } from 'react';
import { Copy, Eraser, Save, Type, X } from 'lucide-react';
import { loadNotes, MAX_SAVED, openSaved, removeSaved, saveCurrent, storeNotes, type Notes } from './notes';
import './notes.css';

const NUM = ['①', '②', '③'];

export function Notepad({ onClose, onPlace }: { onClose: () => void; onPlace?: (text: string) => void }) {
  const [n, setN] = useState<Notes>(loadNotes);
  const [undo, setUndo] = useState<{ label: string; notes: Notes } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  const put = (next: Notes, now = false) => {
    setN(next);
    clearTimeout(timer.current);
    if (now) storeNotes(next);
    else timer.current = setTimeout(() => storeNotes(next), 300);
  };
  const withUndo = (label: string, next: Notes) => {
    setUndo({ label, notes: n });
    put(next, true);
  };
  const selection = () => {
    const a = area.current;
    if (!a) return n.text;
    return a.selectionStart !== a.selectionEnd ? n.text.slice(a.selectionStart, a.selectionEnd) : n.text;
  };
  const copy = async () => {
    const v = selection();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      area.current?.select();
      document.execCommand('copy');
    }
    setFlash(v === n.text ? 'Copied' : 'Selection copied');
  };
  const save = () => {
    const next = saveCurrent(n);
    if (next === n) return setFlash(n.text.trim() ? 'Already saved' : 'Nothing to save');
    put(next, true);
    setFlash(n.saved.length >= MAX_SAVED ? 'Saved · oldest dropped' : 'Saved');
  };
  const pressSaved = (i: number) => {
    held.current = false;
    hold.current = setTimeout(() => {
      held.current = true;
      withUndo('Note removed', removeSaved(n, i));
    }, 550);
  };
  const tapSaved = (i: number) => {
    clearTimeout(hold.current);
    if (held.current) return;
    if (n.text === n.saved[i].text) return;
    // Opening a saved note replaces the pad; Undo brings the text back.
    if (n.text.trim() && !n.saved.some((s) => s.text === n.text)) withUndo('Note replaced', openSaved(n, i));
    else put(openSaved(n, i), true);
  };

  return (
    <div className="cr-notepad" role="dialog" aria-label="Notes">
      <textarea ref={area} value={n.text} placeholder="Notes — saved as you type" aria-label="Notes" onChange={(e) => (setUndo(null), put({ ...n, text: e.target.value }))} onBlur={() => storeNotes(n)} />
      {(undo || flash) && (
        <div className="cr-notepad-msg" role="status">
          {undo ? undo.label : flash}
          {undo && (
            <button onClick={() => (put(undo.notes, true), setUndo(null))} className="undo">
              Undo
            </button>
          )}
        </div>
      )}
      <div className="cr-notepad-bar">
        <button aria-label="Copy" title="Copy (selection or all)" onClick={() => void copy()} disabled={!n.text}>
          <Copy size={15} />
        </button>
        {onPlace && (
          <button aria-label="Place as text" title="Place as text" onClick={() => selection().trim() && onPlace(selection().trim())} disabled={!n.text.trim()}>
            <Type size={15} />
          </button>
        )}
        <button aria-label="Clear" title="Clear" disabled={!n.text} onClick={() => withUndo('Cleared', { ...n, text: '' })}>
          <Eraser size={15} />
        </button>
        <button aria-label="Save note" title="Save note (up to 3)" disabled={!n.text.trim()} onClick={save}>
          <Save size={15} />
        </button>
        <span className="cr-spacer" />
        {Array.from({ length: MAX_SAVED }, (_, i) => {
          const s = n.saved[i];
          return (
            <button
              key={i}
              className={`cr-saved${s && s.text === n.text ? ' on' : ''}`}
              disabled={!s}
              aria-label={s ? `Saved note ${i + 1}: ${s.text.slice(0, 40)}` : `No saved note ${i + 1}`}
              title={s ? `${s.text.slice(0, 80)}\n(hold to remove)` : 'Empty'}
              onPointerDown={() => s && pressSaved(i)}
              onPointerLeave={() => clearTimeout(hold.current)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => s && tapSaved(i)}
            >
              {NUM[i]}
            </button>
          );
        })}
        <button aria-label="Close notes" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
