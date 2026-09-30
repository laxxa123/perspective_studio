import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  color?: string;
  onChange: (v: number) => void;
}

/** Numeric entry with steppers (§10.6). Rounds for display only (NFR-A-02). */
export function NumberField({ label, value, step, min = -Infinity, max = Infinity, color, onChange }: Props) {
  const [text, setText] = useState<string | null>(null);
  const clampV = (v: number) => Math.min(max, Math.max(min, v));
  const commit = () => {
    if (text === null) return;
    const v = Number(text.replace(',', '.'));
    if (Number.isFinite(v)) onChange(clampV(v));
    setText(null);
  };
  return (
    <label className="numfield">
      <span style={color ? { color } : undefined}>{label}</span>
      <button type="button" className="step" aria-label={`Decrease ${label}`} onClick={() => onChange(clampV(Math.round((value - step) / step) * step))}>
        <Minus size={14} />
      </button>
      <input
        inputMode="decimal"
        value={text ?? String(Math.round(value * 1000) / 1000)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" className="step" aria-label={`Increase ${label}`} onClick={() => onChange(clampV(Math.round((value + step) / step) * step))}>
        <Plus size={14} />
      </button>
    </label>
  );
}
