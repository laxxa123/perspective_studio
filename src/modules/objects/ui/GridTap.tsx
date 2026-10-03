// Tap-to-edit grid (2D figures, views, cuts, holes): the drawing comes from
// the renderer; a tap on it gives the cell under the finger.
import { useMemo } from 'react';
import { svgUrl } from '../services/service';

interface Props {
  svg: string;
  cols: number;
  rows: number;
  size: number;
  onTap: (c: number, r: number) => void;
  label: string;
}

export function GridTap({ svg, cols, rows, size, onTap, label }: Props) {
  const url = useMemo(() => svgUrl(svg), [svg]);
  const tap = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / size;
    const cell = ((size * 0.84) / Math.max(cols, rows)) * k;
    const ox = (r.width - cols * cell) / 2;
    const oy = (r.height - rows * cell) / 2;
    const c = Math.floor((e.clientX - r.left - ox) / cell);
    const w = Math.floor((e.clientY - r.top - oy) / cell);
    if (c >= 0 && w >= 0 && c < cols && w < rows) onTap(c, w);
  };
  return (
    <div className="ob-gridtap" role="application" aria-label={label} onPointerUp={tap}>
      <img src={url} alt="" draggable={false} />
    </div>
  );
}
