// Build · blocks (OBJECTS §A.3): the 3D view, the tools and the drawing the
// questions will use. Add: tap a face or the floor next to the object;
// Remove: tap a block; Mark: tap the block a Track question follows.
import { Box, Drill, Eraser, Focus, Highlighter, RotateCw, Trash2 } from 'lucide-react';
import { add, cannotAdd, connected, drill, has, keepHoles, remove, turnAllWith, MAX_BLOCKS, MAX_EXTENT, type Axis, type Cell } from '../core/blocks';
import { hiddenCount, holesShown } from '../core/iso';
import type { Hit } from '../render/BlockScene';
import { useObjects } from '../state/store';
import { Drawing } from './Drawing';
import { Viewport } from './Viewport';

const st = useObjects.getState;
const REFUSED = { occupied: '', full: `At most ${MAX_BLOCKS} blocks`, 'too-big': `At most ${MAX_EXTENT} blocks in each direction`, 'below-floor': '', detached: 'Add next to a block' } as const;

export function BuildBlocks() {
  const blocks = useObjects((s) => s.blocks);
  const holes = useObjects((s) => s.holes);
  const marked = useObjects((s) => s.marked);
  const tool = useObjects((s) => s.blockTool);
  const frame = useObjects((s) => s.frame);

  const onTap = (hit: Hit | null) => {
    if (!hit) return;
    if (tool === 'hole') {
      // Drill through the whole line of blocks behind the face (tap again to fill it).
      if (hit.kind === 'block') {
        const next = drill(blocks, holes, hit.cell, hit.normal);
        st().edit({ holes: next });
        if (next.length < holes.length) st().showToast('Hole filled');
      }
      return;
    }
    if (tool === 'mark') {
      if (hit.kind === 'block') st().edit({ marked: marked && hit.cell.join() === marked.join() ? null : hit.cell });
      return;
    }
    if (tool === 'remove') {
      if (hit.kind === 'block') {
        const b = remove(blocks, hit.cell);
        st().edit({ blocks: b, holes: keepHoles(b, holes), marked: marked && hit.cell.join() === marked.join() ? null : marked });
      }
      return;
    }
    const c: Cell = hit.kind === 'floor' ? hit.cell : [hit.cell[0] + hit.normal[0], hit.cell[1] + hit.normal[1], hit.cell[2] + hit.normal[2]];
    const why = cannotAdd(blocks, c);
    if (why) return void (REFUSED[why] && st().showToast(REFUSED[why]));
    st().edit({ blocks: add(blocks, c) });
  };
  const turn = (a: Axis) => {
    // The marked block turns with the object.
    const i = marked ? blocks.findIndex((c) => c.join() === marked.join()) : -1;
    const t = turnAllWith(blocks, holes, a);
    st().edit({ blocks: t.blocks, holes: t.holes, marked: i >= 0 ? t.blocks[i] : null });
    st().set({ frame: frame + 1 });
  };
  const hidden = hiddenCount(blocks);
  const holesHidden = !holesShown(blocks, holes);
  const onePiece = connected(blocks);

  return (
    <>
      <Viewport blocks={blocks} holes={holes} marked={marked && has(blocks, marked) ? marked : null} onTap={onTap} frameKey={frame} />
      <section className="ob-strip" aria-label="Drawing">
        <Drawing item={{ kind: 'blocks', blocks, holes, tint: marked && has(blocks, marked) ? [marked] : [] }} size={96} label="Isometric drawing" />
        <p className={onePiece ? '' : 'bad'}>
          <b>
            {blocks.length} block{blocks.length === 1 ? '' : 's'}
          </b>
          <br />
          {!blocks.length ? 'Tap the floor to add' : !onePiece ? '⚠ Not in one piece' : hidden ? `${hidden} hidden in the drawing` : holesHidden ? 'A hole is out of sight' : '✓ All blocks visible'}
        </p>
      </section>
      <nav className="ob-bar" aria-label="Build">
        <button className={tool === 'add' ? 'on' : ''} aria-label="Add blocks" aria-pressed={tool === 'add'} onClick={() => st().set({ blockTool: 'add' })}>
          <Box size={18} />
        </button>
        <button className={tool === 'remove' ? 'on' : ''} aria-label="Remove blocks" aria-pressed={tool === 'remove'} onClick={() => st().set({ blockTool: 'remove' })}>
          <Eraser size={18} />
        </button>
        <button className={tool === 'mark' ? 'on' : ''} aria-label="Mark a block" aria-pressed={tool === 'mark'} onClick={() => st().set({ blockTool: 'mark' })}>
          <Highlighter size={18} />
        </button>
        <button className={tool === 'hole' ? 'on' : ''} aria-label="Hole: tap a face to drill through" aria-pressed={tool === 'hole'} onClick={() => st().set({ blockTool: 'hole' })}>
          <Drill size={18} />
        </button>
        <span className="ob-sep" />
        {(['x', 'y', 'z'] as Axis[]).map((a) => (
          <button key={a} aria-label={`Turn a quarter about ${a.toUpperCase()}`} onClick={() => turn(a)} disabled={!blocks.length}>
            <RotateCw size={18} />
            <span>{a.toUpperCase()}</span>
          </button>
        ))}
        <span className="ob-sep" />
        <button aria-label="Fit the view" onClick={() => st().set({ frame: frame + 1 })}>
          <Focus size={18} />
        </button>
        <button aria-label="Clear" disabled={!blocks.length} onClick={() => (st().edit({ blocks: [], holes: [], marked: null }), st().showToast('Cleared · Undo brings it back'))}>
          <Trash2 size={18} />
        </button>
      </nav>
    </>
  );
}
