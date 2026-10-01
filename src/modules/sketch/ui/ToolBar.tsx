// The floating controls (SKETCH §5): colour · brush · grid · layers · undo /
// redo at the bottom; sketches and "more" at the top. They fade while drawing.
import { ChevronLeft, Ellipsis, Grid3x3, Layers, Redo2, Undo2 } from 'lucide-react';
import { useSketchStore, type Panel } from '../state/useSketchStore';
import { engineRef, saveNow } from './session';
import { PresetIcon } from './PresetIcon';

const st = useSketchStore.getState;

const MODE_HINT = {
  rect: 'Drag a rectangle to select',
  lasso: 'Draw around what to select',
  transform: 'Drag to move · two fingers to scale and rotate',
  reference: 'Drag the reference · two fingers to scale and rotate',
} as const;

export function ToolBar() {
  const color = useSketchStore((s) => s.color);
  const panel = useSketchStore((s) => s.panel);
  const canUndo = useSketchStore((s) => s.canUndo);
  const canRedo = useSketchStore((s) => s.canRedo);
  const presetId = useSketchStore((s) => s.presetId);
  const mode = useSketchStore((s) => s.mode);
  const grid = useSketchStore((s) => s.doc?.guides.type ?? 'none');
  const toggle = (p: Panel) => st().set({ panel: panel === p ? 'none' : p });

  const leave = async () => {
    const e = engineRef.current;
    e?.commitFloating();
    await saveNow();
    st().set({ page: 'gallery', projectId: null });
  };

  return (
    <>
      <div className="sk-top sk-fade">
        <button className="sk-fab" onClick={() => void leave()} aria-label="Sketches">
          <ChevronLeft size={22} />
        </button>
        {mode !== 'draw' && mode !== 'transform' && (
          <div className="sk-chip">
            <span>{MODE_HINT[mode]}</span>
            <button
              onClick={() => {
                const e = engineRef.current;
                if (e) e.editingRef = null;
                e?.setDraft(null);
                st().set({ mode: 'draw' });
              }}
            >
              Done
            </button>
          </div>
        )}
        <button className={`sk-fab${panel === 'more' ? ' on' : ''}`} onClick={() => toggle('more')} aria-label="More">
          <Ellipsis size={22} />
        </button>
      </div>
      <nav className="sk-bar sk-fade" aria-label="Drawing controls">
        <button className={`sk-tool${panel === 'color' ? ' on' : ''}`} onClick={() => toggle('color')} aria-label="Colour">
          <span className="sk-swatch" style={{ background: color }} />
        </button>
        <button className={`sk-tool${panel === 'brush' ? ' on' : ''}`} onClick={() => toggle('brush')} aria-label="Brush">
          <PresetIcon id={presetId} size={22} />
        </button>
        <button className={`sk-tool${panel === 'grid' ? ' on' : ''}${grid !== 'none' ? ' lit' : ''}`} onClick={() => toggle('grid')} aria-label="Grid">
          <Grid3x3 size={22} />
        </button>
        <button className={`sk-tool${panel === 'layers' ? ' on' : ''}`} onClick={() => toggle('layers')} aria-label="Layers">
          <Layers size={22} />
        </button>
        <button className="sk-tool" disabled={!canUndo} onClick={() => engineRef.current?.undo()} aria-label="Undo">
          <Undo2 size={22} />
        </button>
        <button className="sk-tool" disabled={!canRedo} onClick={() => engineRef.current?.redo()} aria-label="Redo">
          <Redo2 size={22} />
        </button>
      </nav>
    </>
  );
}
