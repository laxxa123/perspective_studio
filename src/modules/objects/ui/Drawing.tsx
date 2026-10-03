// A drawing from the pure renderer (OBJECTS §A.6), shown as a crisp vector image.
import { useMemo } from 'react';
import type { Item } from '../core/questions';
import { itemSvg } from '../core/sheet';
import { svgUrl } from '../services/service';

export function Drawing({ item, size, label }: { item: Item; size: number; label?: string }) {
  const svg = useMemo(() => itemSvg(item, size), [item, size]);
  const w = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? size);
  return <img className="ob-drawing" src={svgUrl(svg)} width={w} height={size} alt={label ?? 'Drawing'} draggable={false} />;
}
