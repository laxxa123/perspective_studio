// The CUBE module (CREATIVE.md §3, CUBE §3, §48): Studio · Bank · Test ·
// Analysis. Loads and autosaves the Studio draft (CUBE §42).
import { useEffect, useRef } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useCubeStore, type Page } from './state/useCubeStore';
import { assetsFor, loadDraft, saveDraft, startModel } from './services/CubeService';
import { onPause } from '../../platform/lifecycle';
import { CubeStudio } from './components/CubeStudio';
import { QuestionBank } from './components/QuestionBank';
import { AnalysisPlaceholder, TestPlaceholder } from './components/Placeholders';
import './cube.css';

const PAGES: [Page, string][] = [
  ['studio', 'Studio'],
  ['bank', 'Question Bank'],
  ['test', 'Test'],
  ['analysis', 'Analysis'],
];

export default function CubeModule({ onExit }: { onExit: () => void }) {
  const page = useCubeStore((s) => s.page);
  const model = useCubeStore((s) => s.model);
  const status = useCubeStore((s) => s.saveStatus);
  const toast = useCubeStore((s) => s.toast);
  const st = useCubeStore.getState;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Open: restore the draft (or start a new cube).
  useEffect(() => {
    if (st().model) return;
    loadDraft()
      .then(async (d) => {
        const m = d?.model ?? startModel();
        st().load(m);
        st().set({ question: d?.question ?? null, editing: d?.editing ?? null, assets: await assetsFor(m) });
      })
      .catch((e) => {
        st().load(startModel());
        st().showToast(`Storage: ${e instanceof Error ? e.message : String(e)}`);
      });
  }, [st]);

  // Autosave: 0.8 s after the last change, and when the app goes to the background.
  useEffect(() => {
    const save = async () => {
      const s = st();
      if (!s.model) return;
      s.set({ saveStatus: 'saving' });
      try {
        await saveDraft({ model: s.model, question: s.question, editing: s.editing });
        st().set({ saveStatus: 'saved' });
      } catch {
        st().set({ saveStatus: 'idle' });
      }
    };
    const unsub = useCubeStore.subscribe((s, prev) => {
      if (s.model === prev.model && s.question === prev.question && s.editing === prev.editing) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(save, 800);
    });
    const off = onPause(() => void save());
    return () => {
      unsub();
      off();
      clearTimeout(timer.current);
      void save();
    };
  }, [st]);

  // Keyboard (desktop): undo / redo, delete.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) st().redo();
        else st().undo();
      } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        st().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);

  return (
    <div className="cube-module">
      <header className="cube-head">
        <button className="icon" aria-label="Back to home" onClick={onExit}>
          <ArrowLeft size={20} />
        </button>
        <h1>CUBE</h1>
        <nav className="cube-pages">
          {PAGES.map(([p, label]) => (
            <button key={p} className={page === p ? 'seg active' : 'seg'} onClick={() => st().set({ page: p })}>
              {label}
            </button>
          ))}
        </nav>
        <span className="save-status" aria-live="polite">
          {status === 'saving' ? <><Loader2 size={14} className="spin" /> Saving…</> : status === 'saved' ? <><Check size={14} /> Saved</> : null}
        </span>
      </header>
      <main className="cube-main">
        {page === 'studio' && (model ? <CubeStudio model={model} /> : <p className="muted empty">Loading…</p>)}
        {page === 'bank' && <QuestionBank />}
        {page === 'test' && <TestPlaceholder />}
        {page === 'analysis' && <AnalysisPlaceholder />}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
