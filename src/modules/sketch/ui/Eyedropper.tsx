// Eyedropper (SKETCH §8): touch the canvas to take a colour from the
// artwork; a loupe shows the colour under the finger, letting go picks it.
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DOC_H, DOC_W } from '../core/types';
import { useSketchStore } from '../state/useSketchStore';
import { engineRef } from './session';

const st = useSketchStore.getState;

export function Eyedropper() {
  const [at, setAt] = useState<{ x: number; y: number; c: string | null } | null>(null);
  // The flattened artwork, read once when picking starts.
  const px = useRef<Uint8ClampedArray | null>(null);
  const el = useRef<HTMLDivElement>(null);

  const sample = (ev: React.PointerEvent) => {
    const e = engineRef.current;
    if (!e || !el.current) return;
    px.current ??= e.exportPixels(false, 1).data;
    const r = el.current.getBoundingClientRect();
    const p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    const d = e.toDoc(p);
    if (d.x < 0 || d.y < 0 || d.x >= DOC_W || d.y >= DOC_H) return setAt({ ...p, c: null });
    const i = (Math.floor(d.y) * DOC_W + Math.floor(d.x)) * 4;
    const data = px.current;
    setAt({ ...p, c: `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` });
  };
  const stop = () => st().set({ picking: false });

  return (
    <>
      <div
        ref={el}
        className="sk-pick"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          sample(ev);
        }}
        onPointerMove={(ev) => ev.buttons && sample(ev)}
        onPointerUp={() => {
          if (at?.c) st().pickColor(at.c);
          stop();
        }}
      >
        {at?.c && <i className="sk-loupe" style={{ left: at.x, top: at.y - 70, background: at.c }} />}
      </div>
      <div className="sk-top">
        <div className="sk-chip">
          <span>Touch a colour on the canvas</span>
          <button aria-label="Cancel picking" onClick={stop}>
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
