// A tiny notepad over the editor (PUBLISH §6.7): one shared note for quick
// copy / paste while working. It saves as you type; Place puts the selected
// text (or all of it) on the tile as text.
import { useEffect, useRef, useState } from 'react';
import { Copy, Eraser, Type, X } from 'lucide-react';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';

const st = usePublishStore.getState;

export function Notepad({ onClose, onPlace }: { onClose: () => void; onPlace: (text: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void publishStore()
      .then((s) => s.setting('notepad', ''))
      .then(setText);
  }, []);

  const save = (v: string, now = false) => {
    clearTimeout(timer.current);
    const write = () => void publishStore().then((s) => s.setSetting('notepad', v));
    if (now) write();
    else timer.current = setTimeout(write, 400);
  };
  const change = (v: string) => {
    setText(v);
    setCleared(null);
    save(v);
  };
  const selection = () => {
    const a = area.current;
    if (!a || text === null) return '';
    return a.selectionStart !== a.selectionEnd ? text.slice(a.selectionStart, a.selectionEnd) : text;
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
    st().showToast(v === text ? 'Note copied' : 'Selection copied');
  };

  return (
    <div className="pb-notepad" role="dialog" aria-label="Notepad">
      <textarea ref={area} value={text ?? ''} placeholder="Quick notes — saved as you type" aria-label="Notes" onChange={(e) => change(e.target.value)} onBlur={() => text !== null && save(text, true)} />
      <div className="pb-notepad-bar">
        <button aria-label="Copy" title="Copy (selection or all)" onClick={() => void copy()}>
          <Copy size={14} />
        </button>
        <button aria-label="Place on tile as text" title="Place on the tile as text" onClick={() => selection().trim() && onPlace(selection().trim())}>
          <Type size={14} />
        </button>
        {cleared !== null ? (
          <button className="undo" onClick={() => (setText(cleared), save(cleared, true), setCleared(null))}>
            Undo
          </button>
        ) : (
          <button aria-label="Clear" title="Clear" disabled={!text} onClick={() => (setCleared(text ?? ''), setText(''), save('', true))}>
            <Eraser size={14} />
          </button>
        )}
        <span className="pb-spacer" />
        <button aria-label="Close notepad" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
