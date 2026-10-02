// Bottom sheets of the tile editor (PUBLISH §6): Style (per element type, with
// alignment to the tile), Layers (stacking, lock) and Background.
import type { ReactNode } from 'react';
import { AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Brush, Image, Lock, LockOpen, Shell, Star, Type } from 'lucide-react';
import { bounds } from '../core/layout';
import { restack, updateElement } from '../core/tile';
import type { FontFamily, SpiralElement, TextElement, TileElement } from '../core/types';
import { MARGIN, TILE_H, TILE_W } from '../core/types';
import { fittedTextHeight } from '../render/draw';
import { ColourPicker } from './ColourPicker';
import { usePublishStore } from '../state/usePublishStore';

const st = usePublishStore.getState;
export const COLOURS = ['#111111', '#ffffff', '#6c757d', '#c92a2a', '#e8590c', '#f2c94c', '#2b8a3e', '#1c7ed6', '#5f3dc4', '#d6336c'];
export const BACKGROUNDS = ['#f7f4ec', '#ffffff', '#efefef', '#111111', '#1f2a36', '#e9e2d0', '#f3d9d1', '#dbe9e0', '#dce6f2', '#f6e7b0'];

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pb-sheet" role="dialog" aria-label={title}>
      <div className="pb-grab" />
      {children}
    </section>
  );
}

/** A slider: live preview while dragging, one undo step on release. */
function Slider({ label, value, min, max, step, show, onChange }: { label: string; value: number; min: number; max: number; step: number; show?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="pb-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={() => st().commit()} onKeyUp={() => st().commit()} onBlur={() => st().commit()} />
      <output>{show ? show(value) : value}</output>
    </label>
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

function Seg<T extends string | number>({ value, options, onPick }: { value: T; options: [T, ReactNode, string][]; onPick: (v: T) => void }) {
  return (
    <div className="pb-seg">
      {options.map(([v, node, label]) => (
        <button key={String(v)} className={v === value ? 'on' : ''} aria-label={label} onClick={() => onPick(v)}>
          {node}
        </button>
      ))}
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function StyleSheet({ el }: { el: TileElement }) {
  const tile = usePublishStore((s) => s.tile)!;
  const live = <E extends TileElement>(patch: Partial<E>) => st().preview(updateElement<E>(st().tile!, el.id, patch as never));
  const now = <E extends TileElement>(patch: Partial<E>) => st().apply(updateElement<E>(st().tile!, el.id, patch as never));
  // Text boxes refit their height to the lines whenever the type changes.
  const text = (patch: Partial<TextElement>, preview = false) => {
    const e = { ...(el as TextElement), ...patch };
    const h = fittedTextHeight(e);
    const p = { ...patch, h, y: el.y + el.h / 2 - h / 2 };
    if (preview) live<TextElement>(p);
    else now<TextElement>(p);
  };
  const align = (axis: 'x' | 'y', to: 'start' | 'mid' | 'end') => {
    const b = bounds(el);
    const span = axis === 'x' ? TILE_W : TILE_H;
    const lo = axis === 'x' ? b.x0 : b.y0;
    const hi = axis === 'x' ? b.x1 : b.y1;
    const target = to === 'start' ? MARGIN : to === 'end' ? span - MARGIN - (hi - lo) : span / 2 - (hi - lo) / 2;
    now(axis === 'x' ? { x: el.x + (target - lo) / TILE_W } : { y: el.y + (target - lo) / TILE_H });
  };

  return (
    <Sheet title="Style">
      {(el.kind === 'text' || el.kind === 'spiral') && (
        <>
          <Seg<FontFamily>
            value={el.font}
            options={[
              ['Roboto', <span style={{ fontFamily: "'Roboto Variable'" }}>Roboto</span>, 'Roboto'],
              ['Ms Madi', <span style={{ fontFamily: "'Ms Madi'", fontSize: 20 }}>Ms Madi</span>, 'Ms Madi'],
            ]}
            onPick={(f) => (el.kind === 'text' ? text({ font: f }) : now<SpiralElement>({ font: f }))}
          />
          {el.font === 'Roboto' && <Slider label="Weight" value={el.weight} min={100} max={900} step={100} onChange={(v) => (el.kind === 'text' ? text({ weight: v }, true) : live<SpiralElement>({ weight: v }))} />}
          <Slider label="Size" value={el.size} min={el.kind === 'text' ? 16 : 8} max={el.kind === 'text' ? 240 : 60} step={1} onChange={(v) => (el.kind === 'text' ? text({ size: v }, true) : live<SpiralElement>({ size: v }))} />
          <Swatches value={el.color} colours={COLOURS} onPick={(c) => now({ color: c })} />
        </>
      )}
      {el.kind === 'text' && (
        <>
          <Seg
            value={el.align}
            options={[
              ['left', <AlignLeft size={18} />, 'Align left'],
              ['center', <AlignCenter size={18} />, 'Centre'],
              ['right', <AlignRight size={18} />, 'Align right'],
            ]}
            onPick={(a) => now<TextElement>({ align: a })}
          />
          <Slider label="Line height" value={el.lineHeight} min={0.8} max={2.4} step={0.05} show={(v) => v.toFixed(2)} onChange={(v) => text({ lineHeight: v }, true)} />
          <Slider label="Spacing" value={el.letterSpacing} min={-4} max={40} step={1} onChange={(v) => text({ letterSpacing: v }, true)} />
        </>
      )}
      {el.kind === 'spiral' && (
        <>
          <Slider label="Coils" value={el.turns} min={1} max={6} step={0.5} onChange={(v) => live<SpiralElement>({ turns: v })} />
          <Slider label="Centre size" value={el.innerScale} min={0.1} max={1} step={0.05} show={pct} onChange={(v) => live<SpiralElement>({ innerScale: v })} />
          <Slider label="Turn" value={el.rotationOffset} min={0} max={360} step={5} show={(v) => `${v}°`} onChange={(v) => live<SpiralElement>({ rotationOffset: v })} />
          <Slider label="Spacing" value={el.letterSpacing} min={-4} max={20} step={1} onChange={(v) => live<SpiralElement>({ letterSpacing: v })} />
        </>
      )}
      <Slider label="Opacity" value={el.opacity} min={0.05} max={1} step={0.05} show={pct} onChange={(v) => live({ opacity: v })} />
      {el.kind !== 'paint' && (
        <div className="pb-row">
          <span className="pb-label">Align</span>
          <div className="pb-seg">
            <button aria-label="Left margin" onClick={() => align('x', 'start')}>
              <AlignStartVertical size={18} />
            </button>
            <button aria-label="Centre horizontally" onClick={() => align('x', 'mid')}>
              <AlignCenterVertical size={18} />
            </button>
            <button aria-label="Right margin" onClick={() => align('x', 'end')}>
              <AlignEndVertical size={18} />
            </button>
            <button aria-label="Top margin" onClick={() => align('y', 'start')}>
              <AlignStartHorizontal size={18} />
            </button>
            <button aria-label="Centre vertically" onClick={() => align('y', 'mid')}>
              <AlignCenterHorizontal size={18} />
            </button>
            <button aria-label="Bottom margin" onClick={() => align('y', 'end')}>
              <AlignEndHorizontal size={18} />
            </button>
          </div>
        </div>
      )}
      <div className="pb-row">
        <span className="pb-label">Order</span>
        <div className="pb-seg">
          <button aria-label="To front" onClick={() => st().apply(restack(tile, el.id, 'top'))}>
            <ArrowUpToLine size={18} />
          </button>
          <button aria-label="Forward" onClick={() => st().apply(restack(tile, el.id, 1))}>
            <ArrowUp size={18} />
          </button>
          <button aria-label="Backward" onClick={() => st().apply(restack(tile, el.id, -1))}>
            <ArrowDown size={18} />
          </button>
          <button aria-label="To back" onClick={() => st().apply(restack(tile, el.id, 'bottom'))}>
            <ArrowDownToLine size={18} />
          </button>
          {el.kind !== 'paint' && (
            <button className={el.locked ? 'on' : ''} aria-label={el.locked ? 'Unlock' : 'Lock'} onClick={() => now({ locked: !el.locked })}>
              {el.locked ? <Lock size={18} /> : <LockOpen size={18} />}
            </button>
          )}
          {el.kind !== 'text' && (
            <button
              className={`pb-fp${tile.meta.featured === el.id ? ' on' : ''}`}
              aria-label="Featured picture"
              aria-pressed={tile.meta.featured === el.id}
              onClick={() => st().apply({ ...tile, meta: { ...tile.meta, featured: tile.meta.featured === el.id ? undefined : el.id } })}
            >
              <Star size={16} fill={tile.meta.featured === el.id ? 'currentColor' : 'none'} />
              <small>FP</small>
            </button>
          )}
        </div>
      </div>
    </Sheet>
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
