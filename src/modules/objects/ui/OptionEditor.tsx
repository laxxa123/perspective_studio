// Editing one option by hand (OBJECTS §36, §68): the same editors as Build;
// the engine then re-checks which option is correct.
import { useState } from 'react';
import { Box, Check, Eraser, X } from 'lucide-react';
import { useModalBack } from './useModalBack';
import { add, cannotAdd, remove, type Blocks, type Cell } from '../core/blocks';
import { toggleCell, type Figure } from '../core/figure';
import type { Item } from '../core/questions';
import { figureSvg, gridSvg, holesSvg } from '../core/sheet';
import type { Grid } from '../core/space';
import type { Hit } from '../render/BlockScene';
import { GridTap } from './GridTap';
import { Viewport } from './Viewport';

export function OptionEditor({ item, onDone, onCancel }: { item: Item; onDone: (i: Item) => void; onCancel: () => void }) {
  useModalBack(onCancel);
  const [it, setIt] = useState<Item>(item);
  const [tool, setTool] = useState<'add' | 'remove'>('add');
  let body: React.ReactNode = null;
  if (it.kind === 'blocks') {
    const onTap = (hit: Hit | null) => {
      if (!hit) return;
      const b: Blocks = it.blocks;
      if (tool === 'remove') return hit.kind === 'block' && setIt({ ...it, blocks: remove(b, hit.cell) });
      const c: Cell = hit.kind === 'floor' ? hit.cell : [hit.cell[0] + hit.normal[0], hit.cell[1] + hit.normal[1], hit.cell[2] + hit.normal[2]];
      if (!cannotAdd(b, c)) setIt({ ...it, blocks: add(b, c) });
    };
    body = (
      <>
        <div className="ob-edit-view">
          <Viewport blocks={it.blocks} marked={it.tint?.[0] ?? null} onTap={onTap} frameKey={1} />
        </div>
        <div className="ob-seg">
          <button className={tool === 'add' ? 'on' : ''} onClick={() => setTool('add')}>
            <Box size={14} /> Add
          </button>
          <button className={tool === 'remove' ? 'on' : ''} onClick={() => setTool('remove')}>
            <Eraser size={14} /> Remove
          </button>
        </div>
      </>
    );
  } else if (it.kind === 'figure') {
    const f: Figure = it.figure;
    body = <GridTap svg={figureSvg(f, 280)} cols={f.n} rows={f.n} size={280} label="Option figure" onTap={(c, r) => setIt({ kind: 'figure', figure: toggleCell(f, c, r) })} />;
  } else if (it.kind === 'grid') {
    const g: Grid = it.grid;
    const toggle = (c: number, r: number) => {
      const on = g.cells.some((x) => x[0] === c && x[1] === r);
      setIt({ ...it, grid: { ...g, cells: (on ? g.cells.filter((x) => !(x[0] === c && x[1] === r)) : [...g.cells, [c, r] as const]).sort((a, b) => a[1] - b[1] || a[0] - b[0]) } });
    };
    body = <GridTap svg={gridSvg(g, 280)} cols={g.w} rows={g.h} size={280} label="Option squares" onTap={toggle} />;
  } else if (it.kind === 'holes') {
    const toggle = (c: number, r: number) => {
      const on = it.holes.some((x) => x[0] === c && x[1] === r);
      setIt({ ...it, holes: on ? it.holes.filter((x) => !(x[0] === c && x[1] === r)) : [...it.holes, [c, r] as const] });
    };
    body = <GridTap svg={holesSvg(it.n, it.holes, 280)} cols={it.n} rows={it.n} size={280} label="Option holes" onTap={toggle} />;
  } else if (it.kind === 'number') {
    body = <input className="ob-number" type="number" inputMode="numeric" min={0} max={99} value={it.value} aria-label="Number" onChange={(e) => setIt({ kind: 'number', value: Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0))) })} />;
  }
  return (
    <div className="ob-modal" role="dialog" aria-label="Edit option" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ob-card">
        <header>
          <b>Edit option</b>
          <button className="icon" aria-label="Cancel" onClick={onCancel}>
            <X size={18} />
          </button>
        </header>
        {body}
        <button className="ob-primary" onClick={() => onDone(it)}>
          <Check size={16} /> Use this option
        </button>
      </div>
    </div>
  );
}
