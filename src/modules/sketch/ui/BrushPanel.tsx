// Brush panel (SKETCH §6, §8, §9): presets, five sizes, five opacities and
// the two selection tools. Advanced parameters live in Settings.
import { Lasso, SlidersHorizontal, SquareDashed } from 'lucide-react';
import { OPACITY_LEVELS, SIZE_LEVELS } from '../core/presets';
import { useSketchStore } from '../state/useSketchStore';
import { PresetIcon } from './PresetIcon';

const st = useSketchStore.getState;

export function BrushPanel() {
  const presets = useSketchStore((s) => s.settings.presets);
  const presetId = useSketchStore((s) => s.presetId);
  const size = useSketchStore((s) => s.sizeLevel);
  const opacity = useSketchStore((s) => s.opacityLevel);
  const mode = useSketchStore((s) => s.mode);
  const color = useSketchStore((s) => s.color);

  return (
    <div className="sk-panel" role="dialog" aria-label="Brush">
      <div className="sk-presets">
        {presets.map((p) => (
          <button key={p.id} className={`sk-preset${p.id === presetId && mode === 'draw' ? ' on' : ''}`} onClick={() => st().set({ presetId: p.id, mode: 'draw', panel: 'none' })}>
            <PresetIcon id={p.id} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <div className="sk-row">
        <span className="sk-label">Size</span>
        <div className="sk-levels" role="radiogroup" aria-label="Size">
          {SIZE_LEVELS.map((_, i) => (
            <button key={i} role="radio" aria-checked={i === size} aria-label={`Size ${i + 1}`} className={`sk-level${i === size ? ' on' : ''}`} onClick={() => st().set({ sizeLevel: i })}>
              <span style={{ width: 4 + i * 4, height: 4 + i * 4, background: 'currentColor' }} />
            </button>
          ))}
        </div>
      </div>
      <div className="sk-row">
        <span className="sk-label">Opacity</span>
        <div className="sk-levels" role="radiogroup" aria-label="Opacity">
          {OPACITY_LEVELS.map((o, i) => (
            <button key={i} role="radio" aria-checked={i === opacity} aria-label={`Opacity ${Math.round(o * 100)}%`} className={`sk-level${i === opacity ? ' on' : ''}`} onClick={() => st().set({ opacityLevel: i })}>
              <span style={{ width: 16, height: 16, background: color, opacity: o }} />
            </button>
          ))}
        </div>
      </div>
      <div className="sk-row sk-actions">
        <button className={`sk-chipbtn${mode === 'rect' ? ' on' : ''}`} onClick={() => st().set({ mode: 'rect', panel: 'none' })}>
          <SquareDashed size={18} /> Rectangle select
        </button>
        <button className={`sk-chipbtn${mode === 'lasso' ? ' on' : ''}`} onClick={() => st().set({ mode: 'lasso', panel: 'none' })}>
          <Lasso size={18} /> Lasso
        </button>
        <button className="sk-chipbtn" onClick={() => st().set({ page: 'settings', back: 'editor', panel: 'none' })} aria-label="Brush settings">
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </div>
  );
}
