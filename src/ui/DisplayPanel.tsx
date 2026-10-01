// Display popover (§10.7): presets and fine toggles.
import { X } from 'lucide-react';
import { DISPLAY_PRESETS, presetOf, type DisplayOptions, type DisplayPreset } from '../core/derive/display';
import { useUiStore } from '../state/uiStore';

const TOGGLES: [keyof DisplayOptions, string][] = [
  ['guides', 'Horizon & VPs'],
  ['objects', 'Objects'],
  ['hiddenEdges', 'Hidden edges'],
  ['faceFills', 'Face fills'],
  ['paperFrame', 'Paper frame'],
  ['floorGrid', 'Floor grid (1 u)'],
  ['coneOfVision', 'Cone of vision (60°)'],
];

export function DisplayPanel({ onFitPaper }: { onFitPaper: () => void }) {
  const display = useUiStore((s) => s.display);
  const set = useUiStore.getState().set;
  const preset = presetOf(display);
  const change = (p: Partial<DisplayOptions>) => set({ display: { ...display, ...p } });
  return (
    <aside className="panel display">
      <header>
        <strong>Display</strong>
        <button className="icon" aria-label="Close" onClick={() => set({ panel: 'none' })}>
          <X size={18} />
        </button>
      </header>
      <div className="seg-group">
        {(Object.keys(DISPLAY_PRESETS) as DisplayPreset[]).map((p) => (
          <button key={p} className={preset === p ? 'seg active' : 'seg'} onClick={() => set({ display: DISPLAY_PRESETS[p] })}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="seg-group">
        <span className="muted">Rays</span>
        {(['none', 'selected', 'all'] as const).map((r) => (
          <button key={r} className={display.rays === r ? 'seg active' : 'seg'} onClick={() => change({ rays: r })}>
            {r}
          </button>
        ))}
      </div>
      {TOGGLES.map(([k, label]) => (
        <label key={k} className="check">
          <input type="checkbox" checked={Boolean(display[k])} onChange={(e) => change({ [k]: e.target.checked })} />
          {label}
        </label>
      ))}
      <button onClick={onFitPaper}>Fit paper</button>
    </aside>
  );
}
