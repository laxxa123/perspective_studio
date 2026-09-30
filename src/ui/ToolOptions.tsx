// Contextual mini bars per tool (§10.4, §10.5, SK-04).
import { Eraser } from 'lucide-react';
import { setPerspective } from '../core/commands/commands';
import { STROKE_TOOLS } from '../core/entities/stroke/stroke';
import { setMode } from '../core/perspective';
import type { SceneDocument } from '../core/document/types';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore, type SnapMode } from '../state/uiStore';
import type { Theme } from '../theme/theme';

export const PEN_COLORS = ['#212529', '#495057', '#1c7ed6', '#e03131', '#2f9e44', '#f08c00'];

export function ToolOptions({ doc, theme }: { doc: SceneDocument; theme: Theme }) {
  const tool = useUiStore((s) => s.tool);
  const locked = useUiStore((s) => s.perspectiveLocked);
  const sketch = useUiStore((s) => s.sketch);
  const plane = useUiStore((s) => s.rectPlane);
  const set = useUiStore.getState().set;
  const setSketch = (p: Partial<typeof sketch>) => set({ sketch: { ...sketch, ...p } });

  if (tool === 'perspective' && !locked) {
    return (
      <div className="minibar" role="group" aria-label="Perspective mode">
        {(['2pt', '3pt'] as const).map((m) => (
          <button key={m} className={doc.perspective.mode === m ? 'seg active' : 'seg'} onClick={() => useDocumentStore.getState().run(setPerspective(setMode(doc.perspective, m)))}>
            {m === '2pt' ? '2-point' : '3-point'}
          </button>
        ))}
      </div>
    );
  }
  if (tool === 'rect') {
    return (
      <div className="minibar" role="group" aria-label="Rectangle plane">
        {([['ground', 'Ground'], ['wallL', 'Wall L'], ['wallR', 'Wall R']] as const).map(([p, label]) => (
          <button key={p} className={plane === p ? 'seg active' : 'seg'} onClick={() => set({ rectPlane: p })}>
            {label}
          </button>
        ))}
      </div>
    );
  }
  if (tool === 'sketch') {
    return (
      <div className="minibar sketchbar">
        <div className="seg-group">
          {(['pencil', 'pen', 'marker'] as const).map((t) => (
            <button
              key={t}
              className={!sketch.eraser && sketch.tool === t ? 'seg active' : 'seg'}
              onClick={() =>
                setSketch({ tool: t, eraser: false, width: STROKE_TOOLS[t].defaultWidth, opacity: STROKE_TOOLS[t].defaultOpacity })
              }
            >
              {t}
            </button>
          ))}
          <button className={sketch.eraser ? 'seg active' : 'seg'} aria-label="Eraser" onClick={() => setSketch({ eraser: !sketch.eraser })}>
            <Eraser size={16} />
          </button>
        </div>
        {!sketch.eraser && (
          <>
            <div className="swatches">
              {PEN_COLORS.map((c) => (
                <button key={c} className={c === sketch.color ? 'swatch active' : 'swatch'} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => setSketch({ color: c })} />
              ))}
              <input
                type="range"
                min={0.5}
                max={40}
                step={0.5}
                value={sketch.width}
                aria-label="Width (screen px)"
                onChange={(e) => setSketch({ width: Number(e.target.value) })}
              />
            </div>
            <div className="seg-group">
              {(['off', 'soft', 'locked'] as SnapMode[]).map((m) => (
                <button key={m} className={sketch.snap === m ? 'seg active' : 'seg'} onClick={() => setSketch({ snap: m })}>
                  {m === 'off' ? 'Snap off' : m === 'soft' ? 'Soft' : 'Locked'}
                </button>
              ))}
              {sketch.snap === 'locked' &&
                (['auto', 'L', 'R', 'V'] as const).map((f) => (
                  <button
                    key={f}
                    className={sketch.family === f ? 'seg active' : 'seg'}
                    style={f !== 'auto' ? { color: sketch.family === f ? undefined : theme.family[f] } : undefined}
                    onClick={() => setSketch({ family: f })}
                  >
                    {f === 'auto' ? 'Auto' : f}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    );
  }
  if (tool === 'box') return <div className="minibar hint-bar">Tap the ground or a box top to place a cube</div>;
  return null;
}
