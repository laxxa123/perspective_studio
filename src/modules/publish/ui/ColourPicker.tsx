// A compact colour picker (PUBLISH §6.6): a saturation / brightness square,
// a hue strip, the hex code and the last six colours used. Dragging previews
// live; letting go is one undo step.
import { useRef, useState } from 'react';
import { hexToHsv, hsvToHex, normHex, pushRecent, type Hsv } from '../core/colour';

const KEY = 'creative.publish.recentColours';
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!normHex(x)) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private mode: recent colours are just not remembered.
  }
}

export function ColourPicker({ value, onLive, onDone, onPick }: { value: string; onLive: (c: string) => void; onDone: () => void; onPick: (c: string) => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hex, setHex] = useState(normHex(value) ?? value);
  const [recent, setRecent] = useState(readRecent);
  const sv = useRef<HTMLDivElement>(null);
  // Follow outside changes (a swatch, undo) unless they are ours.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (normHex(value) !== hsvToHex(hsv)) setHsv(hexToHsv(value));
    setHex(normHex(value) ?? value);
  }

  const remember = (c: string) => {
    const next = pushRecent(recent, c);
    setRecent(next);
    writeRecent(next);
  };
  const live = (next: Hsv) => {
    setHsv(next);
    const c = hsvToHex(next);
    setHex(c);
    setSeen(c);
    onLive(c);
  };
  const done = () => {
    onDone();
    remember(hsvToHex(hsv));
  };
  const fromPointer = (e: React.PointerEvent) => {
    const r = sv.current!.getBoundingClientRect();
    live({ ...hsv, s: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), v: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) });
  };

  return (
    <div className="pb-picker">
      <div
        ref={sv}
        className="pb-sv"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => e.buttons && fromPointer(e)}
        onPointerUp={done}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={hex}
      >
        <i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} />
      </div>
      <input className="pb-hue" type="range" min={0} max={359} value={Math.round(hsv.h)} aria-label="Hue" onChange={(e) => live({ ...hsv, h: Number(e.target.value) })} onPointerUp={done} onKeyUp={done} />
      <div className="pb-row">
        <input
          className="pb-hex"
          value={hex}
          aria-label="Hex colour"
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => {
            const c = normHex(hex);
            if (c) {
              setHsv(hexToHsv(c));
              setSeen(c);
              onPick(c);
              remember(c);
            } else setHex(normHex(value) ?? value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {recent.map((c) => (
          <button key={c} className="pb-swatch sm" style={{ background: c }} aria-label={`Recent ${c}`} onClick={() => (setHsv(hexToHsv(c)), setSeen(c), onPick(c))} />
        ))}
      </div>
    </div>
  );
}
