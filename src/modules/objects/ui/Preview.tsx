// The question sheet (OBJECTS §57, §58) from the same asset that is committed:
// the student's view, or the author's with the answer, rules and explanation.
// Export as JSON, SVG or PNG.
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useModalBack } from './useModalBack';
import type { Question } from '../core/questions';
import { questionSheet } from '../core/sheet';
import { exportQuestion, svgUrl } from '../services/service';
import { useObjects } from '../state/store';

export function Preview({ q, onClose }: { q: Question; onClose: () => void }) {
  useModalBack(onClose);
  const [author, setAuthor] = useState(true);
  const sheet = useMemo(() => questionSheet(q, { author }), [q, author]);
  const run = (as: 'json' | 'svg' | 'png') => exportQuestion(q, as, author).catch((e) => useObjects.getState().showToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`));
  return (
    <div className="ob-modal" role="dialog" aria-label="Preview" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ob-card wide">
        <header>
          <div className="ob-seg" role="radiogroup" aria-label="Show">
            <button role="radio" aria-checked={!author} className={!author ? 'on' : ''} onClick={() => setAuthor(false)}>
              Student
            </button>
            <button role="radio" aria-checked={author} className={author ? 'on' : ''} onClick={() => setAuthor(true)}>
              Author
            </button>
          </div>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <img className="ob-sheet" src={svgUrl(sheet)} alt="Question sheet" />
        <div className="ob-actions">
          <button onClick={() => void run('png')}>PNG</button>
          <button onClick={() => void run('svg')}>SVG</button>
          <button onClick={() => void run('json')}>JSON</button>
        </div>
      </div>
    </div>
  );
}
