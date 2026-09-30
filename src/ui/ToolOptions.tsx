// Contextual mini bars per tool (§10.4, §10.5, SK-04), kept to one
// collapsible row so they never cover the drawing needlessly (UI-02).
import { ChevronDown, ChevronUp, Eraser } from 'lucide-react';
import { setPerspective } from '../core/commands/commands';
import { STROKE_TOOLS } from '../core/entities/stroke/stroke';
import { originDistance, setMode } from '../core/perspective';
import type { SceneDocument } from '../core/document/types';
import { cameraOf } from '../state/derived';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore, type SnapMode } from '../state/uiStore';
import type { Theme } from '../theme/theme';

export const PEN_COLORS = ['#212529', '#495057', '#1c7ed6', '#e03131', '#2f9e44', '#f08c00'];

export function ToolOptions({ doc, theme }: { doc: SceneDocument; theme: Theme }) {
  const tool = useUiStore((s) => s.tool);
  const locked = useUiStore((s) => s.perspectiveLocked);
  const sketch = useUiStore((s) => s.sketch);
  const open = useUiStore((s) => s.paletteOpen);
  const drawing = useUiStore((s) => s.live.length > 0);
  const dragging = useUiStore((s) => s.dragging);
  const scaleLock = useUiStore((s) => s.scaleLock);
  const pinSelection = useUiStore((s) => s.pinSelection);
  const multi = useUiStore((s) => s.multi);
  const hasSelection = useUiStore((s) => s.selection.length > 0);
  const set = useUiStore.getState().set;
  const setSketch = (p: Partial<typeof sketch>) => set({ sketch: { ...sketch, ...p } });

  // Hidden while a stroke is being drawn (UI-02, §10.2).
  if (drawing) return null;

  if (tool === 'perspective' && !locked) {
    const ps = doc.perspective;
    const cam = cameraOf(ps);
    return (
      <div className={dragging ? 'minibar live' : 'minibar'} role="group" aria-label="Perspective">
        {(['2pt', '3pt'] as const).map((m) => (
          <button key={m} className={ps.mode === m ? 'seg active' : 'seg'} onClick={() => useDocumentStore.getState().run(setPerspective(setMode(ps, m)))}>
            {m === '2pt' ? '2-pt' : '3-pt'}
          </button>
        ))}
        {/* UI-08: live readouts. */}
        <span className="readout">
          Eye {ps.eyeHeight.toFixed(2)} u · {originDistance(cam).toFixed(1)} u away
        </span>
        <button className={scaleLock ? 'seg active' : 'seg'} title="Scale lock (PS-09)" onClick={() => set({ scaleLock: !scaleLock })}>
          Scale
        </button>
        <button className={pinSelection ? 'seg active' : 'seg'} title="Pin the selected object (PS-10)" onClick={() => set({ pinSelection: !pinSelection })}>
          Pin
        </button>
      </div>
    );
  }

  if (tool === 'select' && (hasSelection || multi)) {
    return (
      <div className="minibar" role="group" aria-label="Selection">
        <button className={multi ? 'seg active' : 'seg'} onClick={() => set({ multi: !multi })} title="Tap objects to add / remove (UI-04)">
          Multi
        </button>
      </div>
    );
  }

  if (tool === 'sketch') {
    if (!open) {
      return (
        <button className="chip palette-chip" onClick={() => set({ paletteOpen: true })} aria-label="Show sketch options">
          <span className="dot" style={{ background: sketch.eraser ? 'transparent' : sketch.color }} />
          {sketch.eraser ? 'Eraser' : sketch.tool} · {sketch.snap === 'off' ? 'free' : sketch.snap}
          <ChevronUp size={16} />
        </button>
      );
    }
    return (
      <div className="minibar sketchbar" role="group" aria-label="Sketch options">
        <button className="seg" aria-label="Hide sketch options" onClick={() => set({ paletteOpen: false })}>
          <ChevronDown size={16} />
        </button>
        {(['pencil', 'pen', 'marker'] as const).map((t) => (
          <button
            key={t}
            className={!sketch.eraser && sketch.tool === t ? 'seg active' : 'seg'}
            onClick={() => setSketch({ tool: t, eraser: false, width: STROKE_TOOLS[t].defaultWidth, opacity: STROKE_TOOLS[t].defaultOpacity })}
          >
            {t}
          </button>
        ))}
        <button className={sketch.eraser ? 'seg active' : 'seg'} aria-label="Eraser" onClick={() => setSketch({ eraser: !sketch.eraser })}>
          <Eraser size={16} />
        </button>
        {!sketch.eraser && (
          <>
            {PEN_COLORS.map((c) => (
              <button key={c} className={c === sketch.color ? 'swatch active' : 'swatch'} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => setSketch({ color: c })} />
            ))}
            <input type="range" min={0.5} max={40} step={0.5} value={sketch.width} aria-label="Width (screen px)" onChange={(e) => setSketch({ width: Number(e.target.value) })} />
            {(['off', 'soft', 'locked'] as SnapMode[]).map((m) => (
              <button key={m} className={sketch.snap === m ? 'seg active' : 'seg'} onClick={() => setSketch({ snap: m })}>
                {m === 'off' ? 'Free' : m === 'soft' ? 'Soft' : 'Locked'}
              </button>
            ))}
            {sketch.snap === 'locked' &&
              (['auto', 'L', 'R', 'V'] as const).map((f) => (
                <button
                  key={f}
                  className={sketch.family === f ? 'seg active' : 'seg'}
                  style={f !== 'auto' && sketch.family !== f ? { color: theme.family[f] } : undefined}
                  onClick={() => setSketch({ family: f })}
                >
                  {f === 'auto' ? 'Auto' : f}
                </button>
              ))}
          </>
        )}
      </div>
    );
  }
  return null;
}
