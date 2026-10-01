// Contextual selection actions (SKETCH §15): appear only while something is
// selected; the transform shows Done / Cancel.
import { Check, Copy, Move, Trash2, X } from 'lucide-react';
import { useSketchStore } from '../state/useSketchStore';
import { engineRef } from './session';

const st = useSketchStore.getState;

export function SelectionBar() {
  const has = useSketchStore((s) => s.hasSelection);
  const floating = useSketchStore((s) => s.floating);
  const mode = useSketchStore((s) => s.mode);
  if (!has || mode === 'reference') return null;
  const e = () => engineRef.current;
  const refuse = (why: string | null) => {
    if (why) st().showToast(why === 'locked' ? 'This layer is locked' : 'This layer is hidden');
    return !why;
  };

  if (floating)
    return (
      <div className="sk-selbar sk-fade">
        <span className="sk-hint">Drag to move · two fingers to scale / rotate</span>
        <button className="sk-mini" onClick={() => (e()?.cancelFloating(), st().set({ mode: 'draw' }))}>
          <X size={14} /> Cancel
        </button>
        <button className="sk-mini on" onClick={() => (e()?.commitFloating(), st().set({ mode: 'draw' }))}>
          <Check size={14} /> Done
        </button>
      </div>
    );

  return (
    <div className="sk-selbar sk-fade">
      <button className="sk-mini" onClick={() => refuse(e()?.liftSelection(false) ?? null) && st().set({ mode: 'transform', panel: 'none' })}>
        <Move size={14} /> Transform
      </button>
      <button className="sk-mini" onClick={() => refuse(e()?.liftSelection(true) ?? null) && st().set({ mode: 'transform', panel: 'none' })}>
        <Copy size={14} /> Duplicate
      </button>
      <button className="sk-mini" onClick={() => refuse(e()?.deleteSelection() ?? null)}>
        <Trash2 size={14} /> Delete
      </button>
      <button className="sk-mini" onClick={() => (e()?.setSelection(null), st().set({ mode: 'draw' }))}>
        <X size={14} /> Deselect
      </button>
    </div>
  );
}
