// Layers panel (LY-02): add, rename, reorder, visibility, lock, opacity, and
// the entity list per layer with select-on-tap.
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Plus, Trash2, X } from 'lucide-react';
import { addLayer, deleteLayer, reorderLayer, updateLayer } from '../core/commands/commands';
import { newLayer } from '../core/document/factory';
import type { SceneDocument } from '../core/document/types';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';

const run = (c: Parameters<ReturnType<typeof useDocumentStore.getState>['run']>[0]) => useDocumentStore.getState().run(c);

const entityLabel = (doc: SceneDocument, id: string, i: number) => {
  const e = doc.entities[id];
  if (!e) return id;
  if ('unknown' in e) return `${e.kind} (unsupported)`;
  return e.name ?? `${e.kind === 'box' ? 'Box' : e.kind === 'rect' ? 'Rect' : 'Stroke'} ${i + 1}`;
};

export function LayersPanel({ doc }: { doc: SceneDocument }) {
  const selection = useUiStore((s) => s.selection);
  const active = useUiStore((s) => s.activeLayer);
  const ui = useUiStore.getState;
  const top = [...doc.layers].reverse();

  return (
    <aside className="panel layers">
      <header>
        <strong>Layers</strong>
        <button onClick={() => run(addLayer(newLayer('objects', `Objects ${doc.layers.filter((l) => l.role === 'objects').length + 1}`)))}>
          <Plus size={16} /> Objects
        </button>
        <button onClick={() => run(addLayer(newLayer('sketch', `Sketch ${doc.layers.filter((l) => l.role === 'sketch').length + 1}`)))}>
          <Plus size={16} /> Sketch
        </button>
        <button className="icon" aria-label="Close" onClick={() => ui().set({ panel: 'none' })}>
          <X size={18} />
        </button>
      </header>
      <ul>
        {top.map((l) => {
          const idx = doc.layers.indexOf(l);
          const isActive = active[l.role] === l.id;
          return (
            <li key={l.id} className={isActive ? 'layer active' : 'layer'}>
              <div className="layer-row">
                <button className="layer-name" onClick={() => ui().set({ activeLayer: { ...active, [l.role]: l.id } })} onDoubleClick={() => {
                  const name = window.prompt('Layer name', l.name)?.trim();
                  if (name) run(updateLayer(l.id, { name }));
                }} title="Tap: make active · double-tap: rename">
                  {l.name} <small className="muted">{l.role}</small>
                </button>
                <button className="icon" aria-label={l.visible ? 'Hide' : 'Show'} onClick={() => run(updateLayer(l.id, { visible: !l.visible }))}>
                  {l.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button className="icon" aria-label={l.locked ? 'Unlock' : 'Lock'} onClick={() => run(updateLayer(l.id, { locked: !l.locked }))}>
                  {l.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                </button>
                <button className="icon" aria-label="Up" disabled={idx === doc.layers.length - 1} onClick={() => run(reorderLayer(l.id, idx + 1))}>
                  <ArrowUp size={16} />
                </button>
                <button className="icon" aria-label="Down" disabled={idx === 0} onClick={() => run(reorderLayer(l.id, idx - 1))}>
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon danger"
                  aria-label="Delete layer"
                  disabled={doc.layers.filter((x) => x.role === l.role).length <= 1}
                  onClick={() => window.confirm(`Delete layer “${l.name}” and everything on it?`) && run(deleteLayer(l.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <label className="opacity">
                Opacity
                <input type="range" min={0} max={1} step={0.05} value={l.opacity} onChange={(e) => run(updateLayer(l.id, { opacity: Number(e.target.value) }))} />
              </label>
              <ul className="entities">
                {[...l.order].reverse().map((id, i) => (
                  <li key={id}>
                    <button className={selection.includes(id) ? 'entity active' : 'entity'} onClick={() => ui().select([id])}>
                      {entityLabel(doc, id, l.order.length - 1 - i)}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="muted">Tap a layer name to draw / place on it; double-tap to rename.</p>
    </aside>
  );
}
