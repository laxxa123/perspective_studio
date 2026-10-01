// SKETCH settings (SKETCH §22): short groups; the brush editor holds the
// advanced parameters so the drawing screen never has to.
import { useState, type ReactNode } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { DEFAULT_PRESETS, OPACITY_LEVELS, QUICK_COLOURS, SIZE_LEVELS } from '../core/presets';
import type { Background, BrushPreset, BrushTexture, GridType } from '../core/types';
import type { FingerDraw } from '../input/PointerInput';
import { useSketchStore } from '../state/useSketchStore';
import { DEFAULT_SETTINGS } from '../state/settings';
import { PresetIcon } from './PresetIcon';

const st = useSketchStore.getState;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sk-set-group">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="sk-set-row">
      <span>{label}</span>
      <div className="sk-blends">
        {options.map(([v, l]) => (
          <button key={String(v)} className={`sk-mini${v === value ? ' on' : ''}`} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sk-set-row">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Slider({ label, value, min, max, step = 0.01, onChange, fmt }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="sk-set-row slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{fmt ? fmt(value) : value.toFixed(2)}</output>
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function BrushEditor() {
  const presets = useSketchStore((s) => s.settings.presets);
  const [id, setId] = useState(() => st().presetId);
  const p = presets.find((x) => x.id === id) ?? presets[0];
  const patch = (q: Partial<BrushPreset>) => st().setSettings({ presets: presets.map((x) => (x.id === p.id ? { ...x, ...q } : x)) });
  const reset = () => patch({ ...DEFAULT_PRESETS.find((d) => d.id === p.id)! });
  return (
    <>
      <div className="sk-presets">
        {presets.map((x) => (
          <button key={x.id} className={`sk-preset${x.id === p.id ? ' on' : ''}`} onClick={() => setId(x.id)}>
            <PresetIcon id={x.id} />
            <span>{x.name}</span>
          </button>
        ))}
      </div>
      <Slider label="Size (px)" value={p.size} min={1} max={300} step={1} onChange={(v) => patch({ size: v })} fmt={(v) => String(v)} />
      <Slider label="Opacity" value={p.opacity} min={0.05} max={1} onChange={(v) => patch({ opacity: v })} fmt={pct} />
      <Slider label="Flow" value={p.flow} min={0.01} max={1} onChange={(v) => patch({ flow: v })} fmt={pct} />
      <Slider label="Hardness" value={p.hardness} min={0} max={1} onChange={(v) => patch({ hardness: v })} fmt={pct} />
      <Slider label="Spacing" value={p.spacing} min={0.02} max={1} onChange={(v) => patch({ spacing: v })} fmt={pct} />
      <Slider label="Smoothing" value={p.smoothing} min={0} max={1} onChange={(v) => patch({ smoothing: v })} fmt={pct} />
      <Slider label="Pressure → size" value={p.pressureSize} min={0} max={1} onChange={(v) => patch({ pressureSize: v })} fmt={pct} />
      <Slider label="Pressure → opacity" value={p.pressureOpacity} min={0} max={1} onChange={(v) => patch({ pressureOpacity: v })} fmt={pct} />
      <Slider label="Speed → size" value={p.velocity} min={-1} max={1} onChange={(v) => patch({ velocity: v })} />
      <Slider label="Tilt" value={p.tilt} min={0} max={1} onChange={(v) => patch({ tilt: v })} fmt={pct} />
      <Slider label="Rotation (°)" value={p.rotation} min={0} max={180} step={1} onChange={(v) => patch({ rotation: v })} fmt={(v) => `${v}°`} />
      <Slider label="Roundness" value={p.roundness} min={0.1} max={1} onChange={(v) => patch({ roundness: v })} fmt={pct} />
      {p.engine === 'blend' && <Slider label="Blend strength" value={p.strength ?? 0.6} min={0.05} max={1} onChange={(v) => patch({ strength: v })} fmt={pct} />}
      <Choice<BrushTexture>
        label="Texture"
        value={p.texture}
        options={[
          ['none', 'None'],
          ['grain', 'Grain'],
          ['canvas', 'Canvas'],
          ['chalk', 'Chalk'],
        ]}
        onChange={(v) => patch({ texture: v })}
      />
      <Toggle label="Turn with the stroke" value={p.followStroke} onChange={(v) => patch({ followStroke: v })} />
      <div className="sk-set-row">
        <span />
        <button className="sk-mini" onClick={reset}>
          <RotateCcw size={14} /> Reset {p.name}
        </button>
      </div>
    </>
  );
}

export function SettingsScreen() {
  const s = useSketchStore((x) => x.settings);
  const set = st().setSettings;
  return (
    <div className="sk-settings">
      <header className="sk-gal-head">
        <button className="sk-icon" onClick={() => st().set({ page: st().back })} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h1>Sketch settings</h1>
        <span />
      </header>
      <div className="sk-set-body">
        <Group title="Drawing defaults">
          <Choice label="Brush" value={s.defaultPreset} options={s.presets.map((p) => [p.id, p.name] as [string, string])} onChange={(v) => set({ defaultPreset: v })} />
          <Choice label="Size" value={s.defaultSize} options={SIZE_LEVELS.map((_, i) => [i, String(i + 1)] as [number, string])} onChange={(v) => set({ defaultSize: v })} />
          <Choice label="Opacity" value={s.defaultOpacity} options={OPACITY_LEVELS.map((o, i) => [i, pct(o)] as [number, string])} onChange={(v) => set({ defaultOpacity: v })} />
          <div className="sk-set-row">
            <span>Colour</span>
            <div className="sk-swatches small">
              {QUICK_COLOURS.map((c) => (
                <button key={c} className={`sk-dot${c === s.defaultColor ? ' on' : ''}`} style={{ background: c }} onClick={() => set({ defaultColor: c })} aria-label={c} />
              ))}
            </div>
          </div>
        </Group>
        <Group title="Brushes">
          <BrushEditor />
        </Group>
        <Group title="Canvas">
          <Choice<Background>
            label="Background (new sketches)"
            value={s.background}
            options={[
              ['white', 'White'],
              ['paper', 'Paper'],
              ['transparent', 'Transparent'],
            ]}
            onChange={(v) => set({ background: v })}
          />
          <Choice
            label="Open at"
            value={s.defaultZoom}
            options={[
              ['fit', 'Fit'],
              ['actual', '100 %'],
            ]}
            onChange={(v) => set({ defaultZoom: v })}
          />
          <Choice<GridType>
            label="Grid (new sketches)"
            value={s.defaultGrid}
            options={[
              ['none', 'None'],
              ['thirds', '3 × 3'],
              ['1pt', '1-pt'],
              ['2pt', '2-pt'],
              ['3pt', '3-pt'],
            ]}
            onChange={(v) => set({ defaultGrid: v })}
          />
        </Group>
        <Group title="Gestures">
          <Toggle label="Two-finger tap undoes" value={s.tapUndo} onChange={(v) => set({ tapUndo: v })} />
          <Toggle label="Three-finger tap redoes" value={s.tapRedo} onChange={(v) => set({ tapRedo: v })} />
          <Choice<FingerDraw>
            label="One finger"
            value={s.fingerDraw}
            options={[
              ['auto', 'Draws until a pen is used'],
              ['always', 'Always draws'],
              ['never', 'Pans (pen draws)'],
            ]}
            onChange={(v) => set({ fingerDraw: v })}
          />
          <p className="sk-hint">Two fingers always pan and pinch-zoom.</p>
        </Group>
        <Group title="Export">
          <Toggle label="Transparent background" value={s.exportTransparent} onChange={(v) => set({ exportTransparent: v })} />
          <Choice
            label="PNG size"
            value={s.exportScale}
            options={[
              [1, 'Full 1080 × 1920'],
              [0.5, 'Half 540 × 960'],
            ]}
            onChange={(v) => set({ exportScale: v })}
          />
        </Group>
        <Group title="Reset">
          <div className="sk-set-row">
            <span>All SKETCH settings and brushes</span>
            <button className="sk-mini danger" onClick={() => set(structuredClone(DEFAULT_SETTINGS))}>
              Reset
            </button>
          </div>
        </Group>
      </div>
    </div>
  );
}
