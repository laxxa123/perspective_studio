// The OBJECTS module (OBJECTS §14, §15, §71, §72): Studio (1 · Build an
// object or a 2D figure, 2 · Question) · Question Bank · Test · Analysis.
// The Studio draft is saved as you work and comes back when you return.
import { useEffect, useRef } from 'react';
import { ArrowLeft, Check, FilePlus2, Loader2, Redo2, Undo2 } from 'lucide-react';
import { onPause } from '../../platform/lifecycle';
import { readBlocks } from './core/blocks';
import { objectsBack, objectsModal } from './index';
import { storage } from './services/service';
import { draftOf, readDraft, useObjects, type Page } from './state/store';
import { Bank } from './ui/Bank';
import { BuildBlocks } from './ui/BuildBlocks';
import { BuildFigure } from './ui/BuildFigure';
import { QuestionStep } from './ui/QuestionStep';
import './objects.css';

const st = useObjects.getState;
const PAGES: [Page, string][] = [
  ['studio', 'Studio'],
  ['bank', 'Question Bank'],
  ['test', 'Test'],
  ['analysis', 'Analysis'],
];
const M0_KEY = 'creative.objects.draft.v0';

async function saveDraft() {
  const s = st();
  s.set({ saveStatus: 'saving' });
  try {
    await (await storage()).drafts.save(JSON.stringify(draftOf(st())));
    st().set({ saveStatus: 'saved' });
  } catch {
    st().set({ saveStatus: 'idle' });
  }
}

export default function ObjectsModule({ onExit }: { onExit: () => void }) {
  const page = useObjects((s) => s.page);
  const step = useObjects((s) => s.step);
  const kind = useObjects((s) => s.kind);
  const status = useObjects((s) => s.saveStatus);
  const toast = useObjects((s) => s.toast);
  const canUndo = useObjects((s) => s.past.length > 0);
  const canRedo = useObjects((s) => s.future.length > 0);
  const editing = useObjects((s) => s.editing);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Open: the saved draft (or the M0 object kept on the device).
  useEffect(() => {
    void storage()
      .then((s) => s.drafts.load())
      .then((raw) => {
        if (raw) return st().load(readDraft(JSON.parse(raw)));
        try {
          const b = readBlocks(JSON.parse(localStorage.getItem(M0_KEY) ?? 'null'));
          if (b) st().load({ blocks: b });
        } catch {
          // Nothing kept.
        }
      })
      .catch((e) => st().showToast(`Storage: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  // Autosave 0.5 s after a change, and when the app goes to the background.
  useEffect(() => {
    const unsub = useObjects.subscribe((s, p) => {
      if (s.blocks === p.blocks && s.marked === p.marked && s.figure === p.figure && s.fold === p.fold && s.question === p.question && s.family === p.family && s.params === p.params && s.kind === p.kind && s.step === p.step && s.editing === p.editing) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveDraft(), 500);
    });
    const off = onPause(() => void saveDraft());
    return () => {
      unsub();
      off();
      clearTimeout(timer.current);
      void saveDraft();
    };
  }, []);

  // Android back: Question → Build → other pages → Studio → home.
  useEffect(() => {
    objectsBack.current = () => {
      const s = st();
      if (objectsModal.current) return (objectsModal.current(), true);
      if (s.page === 'studio' && s.step === 'question') return (s.set({ step: 'build' }), true);
      if (s.page !== 'studio') return (s.set({ page: 'studio' }), true);
      return false;
    };
    return () => {
      objectsBack.current = null;
    };
  }, []);

  return (
    <div className="ob-module">
      <header className="ob-head">
        <button className="icon" aria-label="Back to CREATIVE" onClick={onExit}>
          <ArrowLeft size={20} />
        </button>
        <h1>OBJECTS</h1>
        <span className="ob-status" aria-live="polite">
          {status === 'saving' ? <Loader2 size={13} className="spin" /> : status === 'saved' ? <Check size={13} /> : null}
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
        </span>
      </header>
      <nav className="ob-pages" aria-label="OBJECTS">
        {PAGES.map(([p, l]) => (
          <button key={p} className={page === p ? 'on' : ''} aria-current={page === p ? 'page' : undefined} onClick={() => st().set({ page: p })}>
            {l}
          </button>
        ))}
      </nav>

      {page === 'studio' && (
        <>
          <div className="ob-steps">
            <button className={step === 'build' ? 'on' : ''} onClick={() => st().set({ step: 'build' })}>
              1 · Build
            </button>
            <button className={step === 'question' ? 'on' : ''} onClick={() => st().set({ step: 'question' })}>
              2 · Question
            </button>
            {step === 'build' && (
              <div className="ob-seg" role="radiogroup" aria-label="Object kind">
                <button role="radio" aria-checked={kind === 'blocks'} className={kind === 'blocks' ? 'on' : ''} onClick={() => st().set({ kind: 'blocks', family: 'same' })}>
                  3D
                </button>
                <button role="radio" aria-checked={kind === 'figure'} className={kind === 'figure' ? 'on' : ''} onClick={() => st().set({ kind: 'figure', family: 'f-turn' })}>
                  2D
                </button>
              </div>
            )}
            <span className="ob-tools">
              <button className="icon" aria-label="Undo" disabled={!canUndo} onClick={() => st().undo()}>
                <Undo2 size={18} />
              </button>
              <button className="icon" aria-label="Redo" disabled={!canRedo} onClick={() => st().redo()}>
                <Redo2 size={18} />
              </button>
              <button className="icon" aria-label="New object" onClick={() => st().newObject()}>
                <FilePlus2 size={18} />
              </button>
            </span>
          </div>
          {editing && <div className="ob-editing">Editing {editing.id} · v{editing.version} — commit saves v{editing.version + 1}</div>}
          {step === 'build' ? kind === 'blocks' ? <BuildBlocks /> : <BuildFigure /> : <QuestionStep />}
        </>
      )}
      {page === 'bank' && <Bank />}
      {page === 'test' && (
        <div className="ob-placeholder">
          <h2>Test Management</h2>
          <p className="muted">Phase 2</p>
        </div>
      )}
      {page === 'analysis' && (
        <div className="ob-placeholder">
          <h2>Result Analysis</h2>
          <p className="muted">Phase 3</p>
        </div>
      )}
      {toast && <div className="ob-toast">{toast}</div>}
    </div>
  );
}
