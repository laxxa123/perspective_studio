// The notes button (CREATIVE.md §2.4): one tap opens the app-wide note over
// whatever screen you are on; it stays where it is until closed.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NotebookPen } from 'lucide-react';
import { Notepad } from './Notepad';

export function NoteButton({ className = '', size = 20, onPlace }: { className?: string; size?: number; onPlace?: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`${className}${open ? ' on' : ''}`} aria-label="Notes" aria-pressed={open} title="Notes" onClick={() => setOpen(!open)}>
        <NotebookPen size={size} />
      </button>
      {open && createPortal(<Notepad onClose={() => setOpen(false)} onPlace={onPlace} />, document.body)}
    </>
  );
}
