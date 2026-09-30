// Shapes submenu (UI-01) with the working plane (PL-01).
import { shapeOptions } from '../core/entities/registry';
import { WORKING_PLANE_MIN_GAP } from '../core/snapping/boxSnap';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';
import { NumberField } from './NumberField';

/** Default working-plane height (OD-14), u. */
export const DEFAULT_WORKING_PLANE = 2.4;

export function ShapesMenu() {
  const shape = useUiStore((s) => s.shape);
  const wp = useUiStore((s) => s.workingPlane);
  const eye = useDocumentStore((s) => s.doc?.perspective.eyeHeight ?? 1.6);
  const set = useUiStore.getState().set;
  const close = () => set({ panel: 'none' });
  const setPlane = (h: number) => {
    // A plane at eye level is edge-on and cannot be tapped (PL-01).
    const safe = Math.abs(h - eye) < WORKING_PLANE_MIN_GAP ? eye + (h >= eye ? 1 : -1) * WORKING_PLANE_MIN_GAP : h;
    set({ workingPlane: safe });
  };
  return (
    <div className="ctx-backdrop" onPointerDown={close}>
      <div className="menu shapes" onPointerDown={(e) => e.stopPropagation()}>
        {shapeOptions().map((o) => (
          <button
            key={`${o.kind}:${o.id}`}
            className={shape.kind === o.kind && shape.option === o.id ? 'active' : undefined}
            onClick={() => {
              set({ shape: { kind: o.kind, option: o.id }, tool: 'shape', panel: 'none', selection: [] });
            }}
          >
            {o.label}
          </button>
        ))}
        <hr />
        <label className="check">
          <input type="checkbox" checked={wp !== null} onChange={(e) => (e.target.checked ? setPlane(DEFAULT_WORKING_PLANE) : set({ workingPlane: null }))} />
          Working plane
        </label>
        {wp !== null && <NumberField label="Height" value={wp} step={0.1} onChange={setPlane} />}
        <p className="muted">Taps that hit nothing land on it. Eye is at {eye.toFixed(2)} u.</p>
      </div>
    </div>
  );
}
