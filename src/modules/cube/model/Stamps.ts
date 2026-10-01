// The stamp library (CUBE §13): reusable shapes as SVG path data in a unit
// box centred on (0, 0). Extensible: add an entry here.

export interface StampDef {
  id: string;
  label: string;
  path: string;
  /** Filled shape (true) or outline only. */
  filled: boolean;
}

const star = (points: number, outer = 0.5, inner = 0.2) => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(r * Math.cos(a)).toFixed(4)} ${(r * Math.sin(a)).toFixed(4)}`);
  }
  return `M ${pts.join(' L ')} Z`;
};

export const STAMPS: readonly StampDef[] = [
  { id: 'circle', label: 'Circle', path: 'M -0.5 0 A 0.5 0.5 0 1 0 0.5 0 A 0.5 0.5 0 1 0 -0.5 0 Z', filled: true },
  { id: 'square', label: 'Square', path: 'M -0.5 -0.5 L 0.5 -0.5 L 0.5 0.5 L -0.5 0.5 Z', filled: true },
  { id: 'triangle', label: 'Triangle', path: 'M 0 -0.5 L 0.5 0.5 L -0.5 0.5 Z', filled: true },
  { id: 'star', label: 'Star', path: star(5), filled: true },
  { id: 'heart', label: 'Heart', path: 'M 0 0.45 C -0.6 0.05 -0.45 -0.5 0 -0.2 C 0.45 -0.5 0.6 0.05 0 0.45 Z', filled: true },
  { id: 'diamond', label: 'Diamond', path: 'M 0 -0.5 L 0.4 0 L 0 0.5 L -0.4 0 Z', filled: true },
  { id: 'arrow', label: 'Arrow', path: 'M -0.5 -0.12 L 0.1 -0.12 L 0.1 -0.32 L 0.5 0 L 0.1 0.32 L 0.1 0.12 L -0.5 0.12 Z', filled: true },
  { id: 'arrow-up', label: 'Arrow up', path: 'M -0.12 0.5 L -0.12 -0.1 L -0.32 -0.1 L 0 -0.5 L 0.32 -0.1 L 0.12 -0.1 L 0.12 0.5 Z', filled: true },
  { id: 'plus', label: 'Plus', path: 'M -0.15 -0.5 L 0.15 -0.5 L 0.15 -0.15 L 0.5 -0.15 L 0.5 0.15 L 0.15 0.15 L 0.15 0.5 L -0.15 0.5 L -0.15 0.15 L -0.5 0.15 L -0.5 -0.15 L -0.15 -0.15 Z', filled: true },
  { id: 'half', label: 'Half disc', path: 'M -0.5 0.2 A 0.5 0.5 0 0 1 0.5 0.2 Z', filled: true },
  { id: 'corner', label: 'L-shape', path: 'M -0.5 -0.5 L -0.2 -0.5 L -0.2 0.2 L 0.5 0.2 L 0.5 0.5 L -0.5 0.5 Z', filled: true },
  { id: 'flag', label: 'Flag', path: 'M -0.35 -0.5 L -0.25 -0.5 L -0.25 -0.4 L 0.45 -0.2 L -0.25 0 L -0.25 0.5 L -0.35 0.5 Z', filled: true },
  { id: 'dot', label: 'Dot', path: 'M -0.2 0 A 0.2 0.2 0 1 0 0.2 0 A 0.2 0.2 0 1 0 -0.2 0 Z', filled: true },
  { id: 'stripe', label: 'Stripe', path: 'M -0.5 -0.08 L 0.5 -0.08 L 0.5 0.08 L -0.5 0.08 Z', filled: true },
];

/** Letters and digits are text stamps (kept as text, CUBE §14). */
export const TEXT_STAMPS: readonly string[] = ['A', 'B', 'C', 'P', 'R', 'F', 'L', 'G', '1', '2', '3', '4', '5', '6', '7', '9', '?', '#'];

export const stampById = (id: string) => STAMPS.find((s) => s.id === id);
