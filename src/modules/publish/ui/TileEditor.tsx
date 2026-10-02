// The tile editor (PUBLISH §6): the 9:16 tile fills the screen; one bottom
// bar adds things (Media · Text · Draw · Spiral) or opens Layers / Background;
// selecting an element swaps in its few actions. Autosaved.
import { useEffect, useState } from 'react';
import { Brush, ChevronLeft, Copy, Crop, ImagePlus, Layers, Loader2, NotebookPen, Palette, Pencil, Redo2, Shell, SlidersHorizontal, Trash2, Type, Undo2 } from 'lucide-react';
import { addElement, duplicateElement, removeElement, spiralFor, textFor } from '../core/tile';
import type { TileElement } from '../core/types';
import { fittedTextHeight } from '../render/draw';
import { usePublishStore } from '../state/usePublishStore';
import { closeTile, scheduleSave } from './session';
import { TileCanvas } from './TileCanvas';
import { BackgroundSheet, LayersSheet } from './Sheets';
import { StyleBar } from './StyleBar';
import { MediaSheet } from './MediaSheet';
import { TextOverlay } from './TextOverlay';
import { TrimScreen } from './TrimScreen';
import { PaintScreen } from './PaintScreen';
import { Notepad } from './Notepad';

const st = usePublishStore.getState;

export function TileEditor() {
  const tile = usePublishStore((s) => s.tile)!;
  const selected = usePublishStore((s) => s.selected);
  const sheet = usePublishStore((s) => s.sheet);
  const overlay = usePublishStore((s) => s.overlay);
  const canUndo = usePublishStore((s) => s.past.length > 0);
  const canRedo = usePublishStore((s) => s.future.length > 0);
  const saving = usePublishStore((s) => s.saving);
  const [naming, setNaming] = useState<string | null>(null);
  const [notes, setNotes] = useState(false);
  const sel = tile.elements.find((e) => e.id === selected) ?? null;

  // Autosave shortly after every change.
  useEffect(() => usePublishStore.subscribe((s, p) => s.tile !== p.tile && s.tile && !s.pending && scheduleSave()), []);

  const toggle = (s: typeof sheet) => st().set({ sheet: sheet === s ? 'none' : s });
  const add = (e: TileElement, overlayFor?: 'text' | 'spiral') => {
    const placed = e.kind === 'text' ? { ...e, h: fittedTextHeight(e) } : e;
    st().apply(addElement(tile, placed));
    st().set({ selected: e.id, sheet: 'none', overlay: overlayFor ?? 'none', fresh: overlayFor ? e.id : null });
  };
  const rename = () => {
    const name = naming?.trim();
    setNaming(null);
    if (name && name !== tile.name) st().apply({ ...tile, name: name.slice(0, 60) });
  };

  return (
    <div className="pb-editor">
      <header className="pb-top">
        <button className="pb-icon sm" aria-label="Back to tiles" onClick={() => void closeTile()}>
          <ChevronLeft size={22} />
        </button>
        {naming !== null ? (
          <input className="pb-name-input" autoFocus value={naming} aria-label="Tile name" onChange={(e) => setNaming(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && rename()} />
        ) : (
          <button className="pb-name" onClick={() => setNaming(tile.name)}>
            {tile.name}
            {saving && <Loader2 size={12} className="spin" />}
          </button>
        )}
        <button className={`pb-icon sm${notes ? ' on' : ''}`} aria-label="Notepad" aria-pressed={notes} onClick={() => setNotes(!notes)}>
          <NotebookPen size={18} />
        </button>
        <button className="pb-icon sm" aria-label="Undo" disabled={!canUndo} onClick={() => st().undo()}>
          <Undo2 size={20} />
        </button>
        <button className="pb-icon sm" aria-label="Redo" disabled={!canRedo} onClick={() => st().redo()}>
          <Redo2 size={20} />
        </button>
      </header>

      <TileCanvas tile={tile} />
      {notes && (
        <Notepad
          onClose={() => setNotes(false)}
          onPlace={(t) => {
            const e = textFor(t);
            const placed = { ...e, h: fittedTextHeight(e) };
            st().apply(addElement(st().tile!, placed));
            st().set({ selected: e.id, sheet: 'none' });
          }}
        />
      )}

      {sheet !== 'none' && sheet !== 'style' && <div className="pb-scrim" onPointerDown={() => st().set({ sheet: 'none' })} />}
      {sheet === 'media' && <MediaSheet />}
      {sheet === 'style' && sel && <StyleBar key={sel.id} el={sel} />}
      {sheet === 'layers' && <LayersSheet />}
      {sheet === 'background' && <BackgroundSheet />}

      <nav className="pb-bar" aria-label={sel ? 'Selection' : 'Add'}>
        {sel ? (
          <>
            {sel.kind === 'image' && <Tool icon={Crop} label="Trim" onClick={() => st().set({ overlay: 'trim', sheet: 'none' })} />}
            {(sel.kind === 'text' || sel.kind === 'spiral') && <Tool icon={Pencil} label="Edit" onClick={() => st().set({ overlay: sel.kind === 'text' ? 'text' : 'spiral', sheet: 'none' })} />}
            {sel.kind === 'paint' && <Tool icon={Brush} label="Draw" onClick={() => st().set({ overlay: 'paint', sheet: 'none' })} />}
            <Tool icon={SlidersHorizontal} label="Style" on={sheet === 'style'} onClick={() => toggle('style')} />
            {sel.kind !== 'paint' && (
              <Tool
                icon={Copy}
                label="Duplicate"
                onClick={() => {
                  const d = duplicateElement(tile, sel.id);
                  st().apply(d.tile);
                  st().set({ selected: d.id });
                }}
              />
            )}
            <Tool
              icon={Trash2}
              label="Delete"
              danger
              onClick={() => {
                st().apply(removeElement(tile, sel.id));
                st().set({ selected: null, sheet: 'none' });
              }}
            />
          </>
        ) : (
          <>
            <Tool icon={ImagePlus} label="Media" on={sheet === 'media'} onClick={() => toggle('media')} />
            <Tool icon={Type} label="Text" onClick={() => add(textFor(), 'text')} />
            <Tool icon={Brush} label="Draw" onClick={() => st().set({ overlay: 'paint', selected: null, sheet: 'none' })} />
            <Tool icon={Shell} label="Spiral" onClick={() => add(spiralFor(), 'spiral')} />
            <Tool icon={Layers} label="Layers" on={sheet === 'layers'} onClick={() => toggle('layers')} />
            <Tool icon={Palette} label="Colour" on={sheet === 'background'} onClick={() => toggle('background')} />
          </>
        )}
      </nav>

      {(overlay === 'text' || overlay === 'spiral') && sel && (sel.kind === 'text' || sel.kind === 'spiral') && <TextOverlay el={sel} />}
      {overlay === 'trim' && sel?.kind === 'image' && <TrimScreen el={sel} />}
      {overlay === 'paint' && <PaintScreen el={sel?.kind === 'paint' ? sel : null} />}
    </div>
  );
}

function Tool({ icon: Icon, label, onClick, on, danger }: { icon: typeof Type; label: string; onClick: () => void; on?: boolean; danger?: boolean }) {
  return (
    <button className={`pb-tool${on ? ' on' : ''}${danger ? ' danger' : ''}`} onClick={onClick}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
