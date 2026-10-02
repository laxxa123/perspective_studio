// The Style bar (PUBLISH §6.1): one row of chips — only what applies to the
// selected element — and above it the one control of the chip in use, so the
// tile stays in view. Fixed choices are buttons (font, weight, text size,
// coils, colour); ranges are sliders with soft snaps. While a control is
// touched the rest of the bar fades, so the change is seen in full. A slider
// drag is one undo step.
import { useState, type ReactNode } from 'react';
import { AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Lock, LockOpen, Plus, Star } from 'lucide-react';
import { normHex, pushRecent } from '../core/colour';
import { bounds } from '../core/layout';
import { CENTRE, COILS, OPACITY, SPACING, SPIRAL_SIZE, TEXT_SIZES, TURN, WEIGHTS, clamp, nearest, softSnap } from '../core/styleScale';
import { restack, updateElement } from '../core/tile';
import type { FontFamily, SpiralElement, TextElement, TileElement } from '../core/types';
import { MARGIN, TILE_H, TILE_W } from '../core/types';
import { fittedTextHeight } from '../render/draw';
import { usePublishStore } from '../state/usePublishStore';
import { ColourPicker } from './ColourPicker';

const st = usePublishStore.getState;
type Chip = 'font' | 'weight' | 'size' | 'colour' | 'coils' | 'centre' | 'turn' | 'spacing' | 'opacity' | 'align' | 'order';
const LABEL: Record<Chip, string> = { font: 'Font', weight: 'Weight', size: 'Size', colour: 'Colour', coils: 'Coils', centre: 'Centre', turn: 'Turn', spacing: 'Spacing', opacity: 'Opacity', align: 'Align', order: 'Order' };

const KEY = 'creative.publish.styleColours';
const START = ['#111111', '#ffffff', '#c92a2a', '#1c7ed6', '#f2b705'];
function readColours(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    const list = Array.isArray(v) ? v.flatMap((c) => (typeof c === 'string' && normHex(c) ? [normHex(c)!] : [])) : [];
    return [...list, ...START.filter((c) => !list.includes(c))].slice(0, 5);
  } catch {
    return START;
  }
}

type StylePatch = Partial<Pick<TextElement, 'font' | 'weight' | 'size' | 'color' | 'letterSpacing' | 'align'>> & Partial<Pick<SpiralElement, 'turns' | 'innerScale' | 'rotationOffset'>>;

function chipsFor(e: TileElement): Chip[] {
  if (e.kind === 'text') return ['font', ...(e.font === 'Roboto' ? (['weight'] as Chip[]) : []), 'size', 'colour', 'spacing', 'opacity', 'align', 'order'];
  if (e.kind === 'spiral') return ['font', ...(e.font === 'Roboto' ? (['weight'] as Chip[]) : []), 'size', 'colour', 'coils', 'centre', 'turn', 'spacing', 'opacity', 'align', 'order'];
  if (e.kind === 'image') return ['opacity', 'align', 'order'];
  return ['opacity', 'order'];
}

/** A slider with soft snaps: live while dragging, one undo step on release. */
function Snap({ value, min, max, step, show, onLive, onDone }: { value: number; min: number; max: number; step: number; show: (v: number) => string; onLive: (v: number) => void; onDone: () => void }) {
  return (
    <div className="pb-sb-slider">
      <input type="range" min={min} max={max} step="any" value={value} aria-valuetext={show(value)} onChange={(ev) => onLive(clamp(softSnap(Number(ev.target.value), step, (max - min) / 60, min), min, max))} onPointerUp={onDone} onKeyUp={onDone} onBlur={onDone} />
      <output>{show(value)}</output>
    </div>
  );
}

function Options<T extends string | number>({ value, options, onPick }: { value: T; options: [T, ReactNode, string][]; onPick: (v: T) => void }) {
  return (
    <div className="pb-sb-options" role="radiogroup">
      {options.map(([v, node, label]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} aria-label={label} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>
          {node}
        </button>
      ))}
    </div>
  );
}

export function StyleBar({ el }: { el: TileElement }) {
  const tile = usePublishStore((s) => s.tile)!;
  const chips = chipsFor(el);
  // The last chip used opens again next time.
  const last = usePublishStore((s) => s.styleChip) as Chip | null;
  const [chip, setChip] = useState<Chip>(() => (last && chips.includes(last) ? last : chips[0]));
  const [peek, setPeek] = useState(false);
  const [colours, setColours] = useState(readColours);
  const [custom, setCustom] = useState(false);
  const active = chips.includes(chip) ? chip : chips[0];
  const pick = (c: Chip) => {
    st().set({ styleChip: c });
    setChip(c);
    setCustom(false);
  };

  // Text boxes refit their height to the lines whenever the type changes.
  const patch = (p: StylePatch, live = false) => {
    let next: Record<string, unknown> = p;
    if (el.kind === 'text' && ('size' in p || 'weight' in p || 'font' in p || 'letterSpacing' in p)) {
      const e = { ...el, ...p } as TextElement;
      const h = fittedTextHeight(e);
      next = { ...p, h, y: el.y + el.h / 2 - h / 2 };
    }
    const t = updateElement(st().tile!, el.id, next as never);
    if (live) st().preview(t);
    else st().apply(t);
  };
  const done = () => {
    st().commit();
    setPeek(false);
  };
  const colour = (c: string) => {
    patch({ color: c });
    remember(c);
  };
  const remember = (c: string) => {
    const next = pushRecent(colours, c, 5);
    setColours(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Not remembered in private mode.
    }
  };
  const alignTo = (axis: 'x' | 'y', to: 'start' | 'mid' | 'end') => {
    const b = bounds(el);
    const span = axis === 'x' ? TILE_W : TILE_H;
    const lo = axis === 'x' ? b.x0 : b.y0;
    const hi = axis === 'x' ? b.x1 : b.y1;
    const target = to === 'start' ? MARGIN : to === 'end' ? span - MARGIN - (hi - lo) : span / 2 - (hi - lo) / 2;
    st().apply(updateElement(st().tile!, el.id, axis === 'x' ? { x: el.x + (target - lo) / TILE_W } : { y: el.y + (target - lo) / TILE_H }));
  };

  const t = el.kind === 'text' || el.kind === 'spiral' ? el : null;
  let control: ReactNode = null;
  switch (active) {
    case 'font':
      control = t && (
        <Options<FontFamily>
          value={t.font}
          options={[
            ['Roboto', <span style={{ fontFamily: "'Roboto Variable'", fontWeight: 500 }}>R</span>, 'Roboto'],
            ['Ms Madi', <span style={{ fontFamily: "'Ms Madi'", fontSize: 24 }}>M</span>, 'Ms Madi'],
          ]}
          onPick={(f) => patch({ font: f, ...(f === 'Ms Madi' ? {} : { weight: nearest(t.weight, WEIGHTS) }) })}
        />
      );
      break;
    case 'weight':
      control = t && (
        <Options<number> value={nearest(t.weight, WEIGHTS)} options={WEIGHTS.map((w) => [w, <span style={{ fontFamily: "'Roboto Variable'", fontWeight: w }}>A</span>, `Weight ${w}`])} onPick={(w) => patch({ weight: w })} />
      );
      break;
    case 'size':
      control =
        el.kind === 'text' ? (
          <Options<number> value={nearest(el.size, TEXT_SIZES)} options={TEXT_SIZES.map((s) => [s, s, `Size ${s}`])} onPick={(s) => patch({ size: s })} />
        ) : el.kind === 'spiral' ? (
          <Snap value={clamp(el.size, SPIRAL_SIZE.min, SPIRAL_SIZE.max)} {...SPIRAL_SIZE} show={(v) => String(Math.round(v))} onLive={(v) => patch({ size: Math.round(v) }, true)} onDone={done} />
        ) : null;
      break;
    case 'colour':
      control =
        t &&
        (custom ? (
          <ColourPicker
            value={t.color}
            onLive={(c) => patch({ color: c }, true)}
            onDone={() => {
              st().commit();
              const now = st().tile!.elements.find((x) => x.id === el.id);
              if (now && (now.kind === 'text' || now.kind === 'spiral')) remember(now.color);
            }}
            onPick={colour}
          />
        ) : (
          <div className="pb-sb-colours">
            {colours.map((c) => (
              <button key={c} className={c.toLowerCase() === t.color.toLowerCase() ? 'on' : ''} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => colour(c)} />
            ))}
            <button className="more" aria-label="More colours" onClick={() => setCustom(true)}>
              <Plus size={14} />
            </button>
          </div>
        ));
      break;
    case 'coils':
      control = el.kind === 'spiral' && <Options<number> value={clamp(Math.round(el.turns), 1, 5)} options={COILS.map((c) => [c, c, `${c} coils`])} onPick={(c) => patch({ turns: c })} />;
      break;
    case 'centre':
      control = el.kind === 'spiral' && <Snap value={clamp(el.innerScale * 100, CENTRE.min, CENTRE.max)} {...CENTRE} show={(v) => `${Math.round(v)}%`} onLive={(v) => patch({ innerScale: Math.round(v) / 100 }, true)} onDone={done} />;
      break;
    case 'turn':
      control = el.kind === 'spiral' && <Snap value={((el.rotationOffset % 360) + 360) % 360} {...TURN} show={(v) => `${Math.round(v)}°`} onLive={(v) => patch({ rotationOffset: Math.round(v) }, true)} onDone={done} />;
      break;
    case 'spacing':
      control = t && <Snap value={clamp(t.letterSpacing, SPACING.min, SPACING.max)} {...SPACING} show={(v) => String(Math.round(v))} onLive={(v) => patch({ letterSpacing: Math.round(v) }, true)} onDone={done} />;
      break;
    case 'opacity':
      control = <Snap value={clamp(el.opacity * 100, OPACITY.min, OPACITY.max)} {...OPACITY} show={(v) => `${Math.round(v)}%`} onLive={(v) => st().preview(updateElement(st().tile!, el.id, { opacity: Math.round(v) / 100 }))} onDone={done} />;
      break;
    case 'align':
      control = (
        <div className="pb-sb-icons">
          {el.kind === 'text' && (
            <>
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} className={el.align === a ? 'on' : ''} aria-label={`Text ${a}`} onClick={() => patch({ align: a })}>
                  {a === 'left' ? <AlignLeft size={16} /> : a === 'center' ? <AlignCenter size={16} /> : <AlignRight size={16} />}
                </button>
              ))}
              <i className="sep" />
            </>
          )}
          <button aria-label="Left margin" onClick={() => alignTo('x', 'start')}>
            <AlignStartVertical size={16} />
          </button>
          <button aria-label="Centre horizontally" onClick={() => alignTo('x', 'mid')}>
            <AlignCenterVertical size={16} />
          </button>
          <button aria-label="Right margin" onClick={() => alignTo('x', 'end')}>
            <AlignEndVertical size={16} />
          </button>
          <button aria-label="Top margin" onClick={() => alignTo('y', 'start')}>
            <AlignStartHorizontal size={16} />
          </button>
          <button aria-label="Centre vertically" onClick={() => alignTo('y', 'mid')}>
            <AlignCenterHorizontal size={16} />
          </button>
          <button aria-label="Bottom margin" onClick={() => alignTo('y', 'end')}>
            <AlignEndHorizontal size={16} />
          </button>
        </div>
      );
      break;
    case 'order':
      control = (
        <div className="pb-sb-icons">
          <button aria-label="To front" onClick={() => st().apply(restack(tile, el.id, 'top'))}>
            <ArrowUpToLine size={16} />
          </button>
          <button aria-label="Forward" onClick={() => st().apply(restack(tile, el.id, 1))}>
            <ArrowUp size={16} />
          </button>
          <button aria-label="Backward" onClick={() => st().apply(restack(tile, el.id, -1))}>
            <ArrowDown size={16} />
          </button>
          <button aria-label="To back" onClick={() => st().apply(restack(tile, el.id, 'bottom'))}>
            <ArrowDownToLine size={16} />
          </button>
          {el.kind !== 'paint' && (
            <button className={el.locked ? 'on' : ''} aria-label={el.locked ? 'Unlock' : 'Lock'} onClick={() => st().apply(updateElement(tile, el.id, { locked: !el.locked }))}>
              {el.locked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
          )}
          {el.kind !== 'text' && (
            <button
              className={`pb-fp${tile.meta.featured === el.id ? ' on' : ''}`}
              aria-label="Featured picture"
              aria-pressed={tile.meta.featured === el.id}
              onClick={() => st().apply({ ...tile, meta: { ...tile.meta, featured: tile.meta.featured === el.id ? undefined : el.id } })}
            >
              <Star size={14} fill={tile.meta.featured === el.id ? 'currentColor' : 'none'} />
              <small>FP</small>
            </button>
          )}
        </div>
      );
      break;
  }

  return (
    <section className={`pb-stylebar${peek ? ' peek' : ''}`} role="dialog" aria-label="Style">
      <div className={`pb-sb-control${custom && active === 'colour' ? ' tall' : ''}`} onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerCancel={() => setPeek(false)}>
        <span className="pb-sb-label">{LABEL[active]}</span>
        {control}
      </div>
      <div className="pb-sb-chips" role="tablist">
        {chips.map((c) => (
          <button key={c} role="tab" aria-selected={c === active} className={c === active ? 'on' : ''} onClick={() => pick(c)}>
            {LABEL[c]}
          </button>
        ))}
      </div>
    </section>
  );
}
