// Layers (SKETCH §10, §11): tap selects, the grip drags to reorder, the eye
// hides, long press (or ⋯) opens rename / duplicate / lock / clear / delete.
// The active layer shows its opacity and blend mode. Everything is undoable.
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Copy, Ellipsis, Eraser, Eye, EyeOff, GripVertical, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { BLEND_MODES, MAX_LAYERS, type BlendMode, type SketchDocument } from '../core/types';
import { useSketchStore } from '../state/useSketchStore';
import { engineRef } from './session';

const BLEND_NAMES: Record<BlendMode, string> = { normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', erase: 'Erase' };
const ROW_H = 52;

export function LayerPanel() {
  const doc = useSketchStore((s) => s.doc);
  const [menu, setMenu] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; from: number; dy: number } | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const before = useRef<SketchDocument | null>(null);
  if (!doc) return null;
  const e = () => engineRef.current;
  const top = [...doc.layers].reverse();

  const startDrag = (ev: RPointerEvent, id: string, row: number) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setDrag({ id, from: row, dy: 0 });
    (ev.currentTarget as HTMLElement).dataset.y0 = String(ev.clientY);
  };
  const moveDrag = (ev: RPointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dy: ev.clientY - Number((ev.currentTarget as HTMLElement).dataset.y0) });
  };
  const endDrag = () => {
    if (!drag) return;
    const row = Math.max(0, Math.min(top.length - 1, drag.from + Math.round(drag.dy / ROW_H)));
    if (row !== drag.from) e()?.moveLayer(drag.id, top.length - 1 - row);
    setDrag(null);
  };

  return (
    <div className="sk-panel sk-layers" role="dialog" aria-label="Layers">
      <div className="sk-panel-head">
        <span className="sk-label">Layers</span>
        <button className="sk-chipbtn" disabled={doc.layers.length >= MAX_LAYERS} onClick={() => e()?.addLayer()}>
          <Plus size={18} /> Layer
        </button>
      </div>
      <ul className="sk-layer-list">
        {top.map((l, row) => {
          const active = l.id === doc.activeLayer;
          const offset = drag?.id === l.id ? drag.dy : 0;
          return (
            <li key={l.id} className={`sk-layer${active ? ' on' : ''}${drag?.id === l.id ? ' dragging' : ''}`} style={offset ? { transform: `translateY(${offset}px)` } : undefined}>
              <div
                className="sk-layer-row"
                onClick={() => e()?.selectLayer(l.id)}
                onPointerDown={() => {
                  clearTimeout(press.current);
                  press.current = setTimeout(() => setMenu(l.id), 550);
                }}
                onPointerUp={() => clearTimeout(press.current)}
                onPointerLeave={() => clearTimeout(press.current)}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  setMenu(l.id);
                }}
              >
                <button
                  className="sk-icon"
                  aria-label={l.visible ? 'Hide layer' : 'Show layer'}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    e()?.patchLayer(l.id, { visible: !l.visible });
                  }}
                >
                  {l.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
                <span className="sk-layer-name">{l.name}</span>
                {l.locked && <Lock size={14} className="muted" />}
                {l.blend !== 'normal' && <span className="sk-tag">{BLEND_NAMES[l.blend]}</span>}
                {l.opacity < 1 && <span className="sk-tag">{Math.round(l.opacity * 100)}%</span>}
                <button
                  className="sk-icon"
                  aria-label="Layer actions"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setMenu(menu === l.id ? null : l.id);
                  }}
                >
                  <Ellipsis size={18} />
                </button>
                <span className="sk-grip" aria-label="Drag to reorder" onPointerDown={(ev) => (ev.stopPropagation(), startDrag(ev, l.id, row))} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={(ev) => ev.stopPropagation()}>
                  <GripVertical size={18} />
                </span>
              </div>
              {active && (
                <div className="sk-layer-props">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(l.opacity * 100)}
                    aria-label="Layer opacity"
                    onPointerDown={() => (before.current = engineRef.current?.doc ?? null)}
                    onChange={(ev) => e()?.patchLayer(l.id, { opacity: Number(ev.target.value) / 100 }, false)}
                    onPointerUp={(ev) => {
                      const b = before.current;
                      before.current = null;
                      if (b) e()?.patchLayer(l.id, { opacity: Number((ev.target as HTMLInputElement).value) / 100 }, true, b);
                    }}
                  />
                  <div className="sk-blends">
                    {BLEND_MODES.map((m) => (
                      <button key={m} className={`sk-mini${l.blend === m ? ' on' : ''}`} onClick={() => e()?.patchLayer(l.id, { blend: m })}>
                        {BLEND_NAMES[m]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {menu === l.id && <LayerMenu id={l.id} name={l.name} locked={l.locked} canDelete={doc.layers.length > 1} canAdd={doc.layers.length < MAX_LAYERS} close={() => setMenu(null)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LayerMenu({ id, name, locked, canDelete, canAdd, close }: { id: string; name: string; locked: boolean; canDelete: boolean; canAdd: boolean; close: () => void }) {
  const [text, setText] = useState(name);
  const e = () => engineRef.current;
  const rename = () => {
    const t = text.trim();
    if (t && t !== name) e()?.patchLayer(id, { name: t.slice(0, 40) });
  };
  return (
    <div className="sk-layer-menu">
      <input
        className="sk-input"
        value={text}
        aria-label="Layer name"
        onChange={(ev) => setText(ev.target.value)}
        onBlur={rename}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            rename();
            close();
          }
        }}
      />
      <div className="sk-blends">
        <button className="sk-mini" disabled={!canAdd} onClick={() => (e()?.duplicateLayer(id), close())}>
          <Copy size={14} /> Duplicate
        </button>
        <button className="sk-mini" onClick={() => (e()?.patchLayer(id, { locked: !locked }), close())}>
          {locked ? <LockOpen size={14} /> : <Lock size={14} />} {locked ? 'Unlock' : 'Lock'}
        </button>
        <button className="sk-mini" disabled={locked} onClick={() => (e()?.clearLayer(id), close())}>
          <Eraser size={14} /> Clear
        </button>
        <button className="sk-mini danger" disabled={!canDelete} onClick={() => (e()?.deleteLayer(id), close())}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}
