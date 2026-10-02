// Colour (SKETCH §8): quick swatches, an eyedropper, recent colours and a
// compact hue / saturation-value picker. No colour-management UI (SKETCH §27).
import { useState, type PointerEvent as RPointerEvent } from 'react';
import { Pipette } from 'lucide-react';
import { QUICK_COLOURS } from '../core/presets';
import { useSketchStore } from '../state/useSketchStore';

const st = useSketchStore.getState;

export function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60 + 360) % 360) / 360, max ? d / max : 0, max];
}

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export function ColorPanel() {
  const color = useSketchStore((s) => s.color);
  const recent = useSketchStore((s) => s.recent);
  const [hsv, setHsv] = useState(() => hexToHsv(color));

  const apply = (next: [number, number, number], commit: boolean) => {
    setHsv(next);
    const hex = hsvToHex(...next);
    if (commit) st().pickColor(hex);
    else st().set({ color: hex });
  };
  const choose = (hex: string) => {
    setHsv(hexToHsv(hex));
    st().pickColor(hex);
  };

  const move = (e: RPointerEvent, commit: boolean) => {
    const el = e.currentTarget as HTMLDivElement;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    apply(el.dataset.part === 'hue' ? [x, hsv[1], hsv[2]] : [hsv[0], x, 1 - y], commit);
  };
  const drag = {
    onPointerDown: (e: RPointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      move(e, false);
    },
    onPointerMove: (e: RPointerEvent) => {
      if (e.buttons) move(e, false);
    },
    onPointerUp: (e: RPointerEvent) => move(e, true),
  };

  return (
    <div className="sk-panel" role="dialog" aria-label="Colour">
      <div className="sk-swatches">
        {QUICK_COLOURS.map((c) => (
          <button key={c} className={`sk-dot${c === color ? ' on' : ''}`} style={{ background: c }} onClick={() => choose(c)} aria-label={c} />
        ))}
        <button className="sk-dot pick" onClick={() => st().set({ picking: true, panel: 'none' })} aria-label="Pick a colour from the canvas">
          <Pipette size={16} />
        </button>
      </div>
      <div className="sk-sv" data-part="sv" style={{ background: hsvToHex(hsv[0], 1, 1) }} {...drag}>
        <div className="sk-sv-w" />
        <div className="sk-sv-b" />
        <span className="sk-knob" style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: color }} />
      </div>
      <div className="sk-hue" data-part="hue" {...drag}>
        <span className="sk-knob" style={{ left: `${hsv[0] * 100}%`, top: '50%', background: hsvToHex(hsv[0], 1, 1) }} />
      </div>
      <div className="sk-row">
        <span className="sk-label">Recent</span>
        <div className="sk-swatches small">
          {recent.map((c) => (
            <button key={c} className="sk-dot" style={{ background: c }} onClick={() => choose(c)} aria-label={c} />
          ))}
          <span className="sk-hex">{color}</span>
        </div>
      </div>
    </div>
  );
}
