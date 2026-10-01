// View (PS-13, M9): turn and tilt sliders that walk the eye around the
// selected object (or the ground point). A preview until Apply; Revert
// restores the view it started from. The knobs show the true angles, so they
// follow VP drags too (decision 11A).
import { useEffect, useState } from 'react';
import { Check, Eye as EyeIcon, Undo2 } from 'lucide-react';
import { setEye } from '../core/commands/commands';
import { orbitPivotOf } from '../core/entities/pin';
import type { KnownEntity, SceneDocument } from '../core/document/types';
import { v3, type Vec3 } from '../core/math/vec';
import { orbit, TILT_MAX, TURN_MAX, TURN_MIN, type Eye } from '../core/perspective';
import { haptics } from '../platform/haptics';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';

/** Snap ticks (decision 10A), degrees; labelled ones can be tapped. */
const TURN_TICKS: [number, string][] = [[90, 'L'], [67.5, ''], [45, '¾'], [22.5, ''], [0, 'R']];
const TILT_TICKS: [number, string][] = [[90, 'Top'], [67.5, ''], [45, '45°'], [22.5, ''], [0, 'Level']];
const SNAP_DEG = 2.5;

const snap = (a: number, ticks: [number, string][]) => {
  for (const [t] of ticks) if (Math.abs(a - t) <= SNAP_DEG) return t;
  return Math.round(a * 10) / 10;
};

interface Props {
  doc: SceneDocument;
  side: 'left' | 'right';
}

export function ViewPanel({ doc, side }: Props) {
  const ds = useDocumentStore.getState;
  const ui = useUiStore.getState;
  // The view the panel opened on, and what it turns around (decision 2A).
  const [{ eye: base, pivot, label }] = useState((): { eye: Eye; pivot: Vec3; label: string } => {
    const s = useUiStore.getState().selection;
    const sel = s.length === 1 ? (doc.entities[s[0]] as KnownEntity | undefined) : undefined;
    const p = sel && !('unknown' in sel) ? orbitPivotOf(sel) : null;
    return { eye: doc.eye, pivot: p ?? v3(0, 0, 0), label: p ? 'the selected object' : 'the ground point' };
  });
  const eye = doc.eye;
  const tiltMin = Math.min(0, base.tilt);


  const aim = (turn: number, tilt: number) => {
    const next = orbit(base, pivot, turn, tilt);
    if (next) ds().preview(setEye(next, 'Change view').recipe);
    else haptics.tick();
  };
  const close = () => ui().set({ viewOpen: false });
  const apply = () => {
    ds().commit();
    close();
  };
  const revert = () => {
    ds().cancel();
    close();
  };

  useEffect(() => {
    ds().begin('Change view');
    // SK-06 / decision 13A: strokes stay on the paper; say so once.
    if (!ui().strokeWarningShown && Object.values(doc.entities).some((e) => e.kind === 'stroke')) {
      ui().set({ strokeWarningShown: true });
      ui().showToast('Sketch strokes stay on the paper; they do not turn with the view.');
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && revert();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- slider dragging -----
  const drag = (axis: 'turn' | 'tilt') => (e: React.PointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget.getBoundingClientRect();
    const valueAt = (ev: { clientX: number; clientY: number }) => {
      if (axis === 'turn') {
        const f = Math.min(1, Math.max(0, (ev.clientX - track.left) / track.width));
        return snap(TURN_MAX - f * (TURN_MAX - TURN_MIN), TURN_TICKS);
      }
      const f = Math.min(1, Math.max(0, (ev.clientY - track.top) / track.height));
      return snap(TILT_MAX - f * (TILT_MAX - tiltMin), TILT_TICKS);
    };
    const apply1 = (ev: { clientX: number; clientY: number }) => {
      const cur = useDocumentStore.getState().doc!.eye;
      const v = valueAt(ev);
      if (axis === 'turn') aim(v, cur.tilt);
      else aim(cur.turn, v);
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    apply1(e);
    const el = e.currentTarget;
    const move = (ev: PointerEvent) => apply1(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const turnPct = ((TURN_MAX - eye.turn) / (TURN_MAX - TURN_MIN)) * 100;
  const tiltPct = ((TILT_MAX - Math.max(tiltMin, eye.tilt)) / (TILT_MAX - tiltMin)) * 100;

  return (
    <>
      <div className="view-slider turn" role="slider" aria-label="Turn" aria-valuemin={0} aria-valuemax={90} aria-valuenow={Math.round(eye.turn)}>
        <div className="track" onPointerDown={drag('turn')}>
          {TURN_TICKS.map(([t]) => (
            <span key={t} className="tick" style={{ left: `${((TURN_MAX - t) / 90) * 100}%` }} />
          ))}
          <span className="knob" style={{ left: `${turnPct}%` }}>
            <EyeIcon size={14} />
          </span>
        </div>
        <div className="labels">
          {TURN_TICKS.filter(([, l]) => l).map(([t, l]) => (
            <button key={t} style={{ left: `${((TURN_MAX - t) / 90) * 100}%` }} onClick={() => aim(t, eye.tilt)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className={`view-slider tilt ${side}`} role="slider" aria-label="Tilt" aria-valuemin={tiltMin} aria-valuemax={90} aria-valuenow={Math.round(eye.tilt)}>
        <div className="track" onPointerDown={drag('tilt')}>
          {TILT_TICKS.map(([t]) => (
            <span key={t} className="tick" style={{ top: `${((TILT_MAX - t) / (TILT_MAX - tiltMin)) * 100}%` }} />
          ))}
          <span className="knob" style={{ top: `${tiltPct}%` }}>
            <EyeIcon size={14} />
          </span>
        </div>
        <div className="labels">
          {TILT_TICKS.filter(([, l]) => l).map(([t, l]) => (
            <button key={t} style={{ top: `${((TILT_MAX - t) / (TILT_MAX - tiltMin)) * 100}%` }} onClick={() => aim(eye.turn, t)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="minibar view-bar" role="group" aria-label="View">
        <span className="readout">
          Turn {eye.turn.toFixed(0)}° · Tilt {eye.tilt.toFixed(0)}° · Eye {eye.position.z.toFixed(2)} u
        </span>
        <span className="readout muted-note">around {label}</span>
        <button className="seg" onClick={revert}>
          <Undo2 size={16} /> Revert
        </button>
        <button className="seg active" onClick={apply}>
          <Check size={16} /> Apply
        </button>
      </div>
    </>
  );
}
