// Bottom sheets of the tile editor (PUBLISH §6): Layers (stacking, lock) and
// Background. Style is the compact Style bar (StyleBar.tsx).
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Brush, Image, Lock, Shell, Star, Type } from 'lucide-react';
import { restack } from '../core/tile';
import type { TileElement } from '../core/types';
import { ColourPicker } from './ColourPicker';
import { usePublishStore } from '../state/usePublishStore';

const st = usePublishStore.getState;
export const BACKGROUNDS = ['#f7f4ec', '#ffffff', '#efefef', '#111111', '#1f2a36', '#e9e2d0', '#f3d9d1', '#dbe9e0', '#dce6f2', '#f6e7b0'];

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pb-sheet" role="dialog" aria-label={title}>
      <div className="pb-grab" />
      {children}
    </section>
  );
}

function Swatches({ value, colours, onPick, custom = true }: { value: string; colours: string[]; onPick: (c: string) => void; custom?: boolean }) {
  return (
    <div className="pb-swatches">
      {colours.map((c) => (
        <button key={c} className={`pb-swatch${c.toLowerCase() === value.toLowerCase() ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
      ))}
      {custom && (
        <label className="pb-swatch custom" aria-label="Custom colour">
          <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
        </label>
      )}
    </div>
  );
}

const ICON = { image: Image, text: Type, spiral: Shell, paint: Brush } as const;
const label = (e: TileElement) => (e.kind === 'text' || e.kind === 'spiral' ? e.text.split('\n')[0].slice(0, 40) || (e.kind === 'text' ? 'Text' : 'Spiral') : e.kind === 'paint' ? 'Drawing' : 'Picture');

export function LayersSheet() {
  const tile = usePublishStore((s) => s.tile)!;
  const selected = usePublishStore((s) => s.selected);
  const top = [...tile.elements].reverse();
  return (
    <Sheet title="Layers">
      {!top.length && <p className="pb-hint">Nothing here yet. Add media, text, a drawing or a spiral.</p>}
      <ul className="pb-layers">
        {top.map((e, i) => {
          const Icon = ICON[e.kind];
          return (
            <li key={e.id} className={e.id === selected ? 'on' : ''}>
              <button className="pb-layer" onClick={() => st().set({ selected: e.id, sheet: 'none' })}>
                <span className="pb-num">{top.length - i}</span>
                <Icon size={18} />
                <span className="pb-layer-name">{label(e)}</span>
                {tile.meta.featured === e.id && <Star size={14} fill="currentColor" aria-label="Featured picture" />}
                {e.locked && <Lock size={14} />}
              </button>
              <button className="pb-icon sm" aria-label="Forward" disabled={i === 0} onClick={() => st().apply(restack(tile, e.id, 1))}>
                <ArrowUp size={18} />
              </button>
              <button className="pb-icon sm" aria-label="Backward" disabled={i === top.length - 1} onClick={() => st().apply(restack(tile, e.id, -1))}>
                <ArrowDown size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

export function BackgroundSheet() {
  const tile = usePublishStore((s) => s.tile)!;
  return (
    <Sheet title="Background">
      <span className="pb-label">Background</span>
      <Swatches value={tile.canvas.background} colours={BACKGROUNDS} custom={false} onPick={(c) => st().apply({ ...st().tile!, canvas: { ...tile.canvas, background: c } })} />
      <ColourPicker
        value={tile.canvas.background}
        onLive={(c) => st().preview({ ...st().tile!, canvas: { ...st().tile!.canvas, background: c } })}
        onDone={() => st().commit()}
        onPick={(c) => st().apply({ ...st().tile!, canvas: { ...st().tile!.canvas, background: c } })}
      />
    </Sheet>
  );
}
