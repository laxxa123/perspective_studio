// The floating controls (SKETCH §5): colour · brush · eraser · grid · layers ·
// undo / redo at the bottom; sketches and "more" at the top. They stay put
// while drawing (no flicker). The brush button shows the brush in use. Hold
// the eraser to clear the sheet; tap the grid to show / hide it, hold it for
// the grid options.
import { ChevronLeft, Ellipsis, Eraser, Grid3x3, Layers, Redo2, Undo2 } from 'lucide-react';
import { ERASER, useSketchStore, type Panel } from '../state/useSketchStore';
import { gridPreset } from '../core/presets';
import { firstTimes, useHold } from '../../../platform/hold';
import { engineRef, saveNow } from './session';
import { PresetIcon } from './PresetIcon';
import { NoteButton } from '../../../shared/NoteButton';

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
  const lastBrush = useSketchStore((s) => s.lastBrush);
  const erasing = presetId === ERASER;
  const mode = useSketchStore((s) => s.mode);
  const gridOn = useSketchStore((s) => !!s.doc && s.doc.guides.type !== 'none' && s.doc.guides.visible);
  const toggle = (p: Panel) => st().set({ panel: panel === p ? 'none' : p });

  const eraser = useHold(
    () => {
      st().toggleEraser();
      if (st().presetId === ERASER && firstTimes('sketch.eraser')) st().showToast('Hold the eraser to clear the sheet');
    },
    () => {
      const cleared = engineRef.current?.clearSheet();
      st().set({ panel: 'none' });
      st().showToast(cleared ? 'Sheet cleared · Undo brings it back' : 'Nothing to clear');
    },
  );
  const grid = useHold(
    () => {
      const e = engineRef.current;
      if (!e) return;
      const g = e.doc.guides;
      if (g.type !== 'none' && g.visible) return e.setGuides({ ...g, visible: false });
      e.setGuides(g.type === 'none' ? { ...gridPreset(g, st().lastGrid), visible: true } : { ...g, visible: true });
      if (firstTimes('sketch.grid')) st().showToast('Hold the grid button for grid options');
    },
    () => toggle('grid'),
  );

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
        <NoteButton className="sk-fab sk-note" />
        <button className={`sk-fab${panel === 'more' ? ' on' : ''}`} onClick={() => toggle('more')} aria-label="More">
          <Ellipsis size={22} />
        </button>
      </div>
      <nav className="sk-bar sk-fade" aria-label="Drawing controls">
        <button className={`sk-tool${panel === 'color' ? ' on' : ''}`} onClick={() => toggle('color')} aria-label="Colour">
          <span className="sk-swatch" style={{ background: color }} />
        </button>
        <button className={`sk-tool${panel === 'brush' ? ' on' : ''}${!erasing && mode === 'draw' ? ' cur' : ''}`} onClick={() => toggle('brush')} aria-label="Brush">
          <PresetIcon id={erasing ? lastBrush : presetId} size={22} />
        </button>
        <button className={`sk-tool hold${erasing && mode === 'draw' ? ' cur' : ''}`} {...eraser} aria-label="Eraser (hold to clear the sheet)" aria-pressed={erasing}>
          <Eraser size={22} />
        </button>
        <button className={`sk-tool hold${panel === 'grid' ? ' on' : ''}${gridOn ? ' lit' : ''}`} {...grid} aria-label="Grid (hold for options)" aria-pressed={gridOn}>
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
