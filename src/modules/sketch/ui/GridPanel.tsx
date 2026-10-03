// Grid / guides (SKETCH §13): none, cube net, 3×3 and 1-, 2-, 3-point
// perspective (held grid button). The grid chosen is the one a tap brings back.
// Vanishing points are dragged on the canvas (when the grid is unlocked).
import { Eye, EyeOff, Lock, LockOpen, RotateCcw } from 'lucide-react';
import { defaultGuides, gridPreset } from '../core/presets';
import type { GridType } from '../core/types';
import { useSketchStore } from '../state/useSketchStore';
import { engineRef } from './session';

const TYPES: [GridType, string][] = [
  ['none', 'None'],
  ['cube', 'Cube'],
  ['thirds', '3 × 3'],
  ['1pt', '1-point'],
  ['2pt', '2-point'],
  ['3pt', '3-point'],
];

export function GridPanel() {
  const g = useSketchStore((s) => s.doc?.guides);
  if (!g) return null;
  const set = (next: typeof g) => engineRef.current?.setGuides(next);
  const perspective = g.type !== 'none' && g.type !== 'thirds' && g.type !== 'cube';
  return (
    <div className="sk-panel" role="dialog" aria-label="Grid">
      <div className="sk-blends">
        {TYPES.map(([t, label]) => (
          <button key={t} className={`sk-mini${g.type === t ? ' on' : ''}`} onClick={() => (set({ ...gridPreset(g, t), visible: true }), t !== 'none' && useSketchStore.getState().set({ lastGrid: t }))}>
            {label}
          </button>
        ))}
      </div>
      {g.type !== 'none' && (
        <>
          <div className="sk-row">
            <span className="sk-label">Opacity</span>
            <input type="range" min={10} max={100} value={Math.round(g.opacity * 100)} aria-label="Grid opacity" onChange={(e) => set({ ...g, opacity: Number(e.target.value) / 100 })} />
          </div>
          {perspective && (
            <div className="sk-row">
              <span className="sk-label">Extent</span>
              <input type="range" min={6} max={48} value={g.density} aria-label="Grid extent" onChange={(e) => set({ ...g, density: Number(e.target.value) })} />
            </div>
          )}
          <div className="sk-row sk-actions">
            <button className="sk-chipbtn" onClick={() => set({ ...g, visible: !g.visible })}>
              {g.visible ? <Eye size={18} /> : <EyeOff size={18} />} {g.visible ? 'Visible' : 'Hidden'}
            </button>
            {perspective && (
              <button className="sk-chipbtn" onClick={() => set({ ...g, locked: !g.locked })}>
                {g.locked ? <Lock size={18} /> : <LockOpen size={18} />} {g.locked ? 'Locked' : 'Free'}
              </button>
            )}
            {perspective && (
              <button className="sk-chipbtn" onClick={() => set({ ...gridPreset({ ...defaultGuides(), density: g.density }, g.type), opacity: g.opacity, visible: g.visible, locked: g.locked })} aria-label="Reset vanishing points">
                <RotateCcw size={18} />
              </button>
            )}
          </div>
          {perspective && !g.locked && <p className="sk-hint">Drag the blue points on the canvas; the horizon follows. Pinch out to reach points beyond the page.</p>}
        </>
      )}
    </div>
  );
}
