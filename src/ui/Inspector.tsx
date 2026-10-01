// Inspector (§10.6): bottom sheet on phones, floating card on wide screens.
// Selected box / rect / stroke fields; with nothing selected, the Scene panel.
import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import {
  deleteEntities,
  duplicateEntities,
  moveToLayer,
  renameDocument,
  reorderEntity,
  setEye,
  updateEntity,
} from '../core/commands/commands';
import { MIN_BOX_SIZE } from '../core/entities/box/box';
import type { BoxEntity, KnownEntity, RectEntity, SceneDocument, StrokeEntity } from '../core/document/types';
import { modeOf, setEyeMode, withEyeHeight } from '../core/perspective';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';
import type { Theme } from '../theme/theme';
import { NumberField } from './NumberField';
import { PEN_COLORS } from './ToolOptions';

const run = (c: Parameters<ReturnType<typeof useDocumentStore.getState>['run']>[0]) => useDocumentStore.getState().run(c);

function LayerSelect({ doc, e }: { doc: SceneDocument; e: KnownEntity }) {
  const role = doc.layers.find((l) => l.id === e.layerId)?.role;
  const options = doc.layers.filter((l) => l.role === role);
  if (options.length < 2) return null;
  return (
    <label className="row-field">
      <span>Layer</span>
      <select value={e.layerId} onChange={(ev) => run(moveToLayer([e.id], ev.target.value))}>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function BoxFields({ b, theme }: { b: BoxEntity; theme: Theme }) {
  const setDim = (axis: 'x' | 'y' | 'z', v: number) => {
    const next = Math.max(MIN_BOX_SIZE, v);
    const size = b.uniform ? { x: (b.size.x * next) / b.size[axis], y: (b.size.y * next) / b.size[axis], z: (b.size.z * next) / b.size[axis] } : { ...b.size, [axis]: next };
    run(updateEntity(b.id, { size }, 'Resize'));
  };
  return (
    <>
      <NumberField label="W" color={theme.family.R} value={b.size.x} step={0.1} min={MIN_BOX_SIZE} onChange={(v) => setDim('x', v)} />
      <NumberField label="D" color={theme.family.L} value={b.size.y} step={0.1} min={MIN_BOX_SIZE} onChange={(v) => setDim('y', v)} />
      <NumberField label="H" color={theme.family.V} value={b.size.z} step={0.1} min={MIN_BOX_SIZE} onChange={(v) => setDim('z', v)} />
      <NumberField label="Elev." value={b.position.z} step={0.1} onChange={(v) => run(updateEntity(b.id, { position: { ...b.position, z: v } }, 'Lift'))} />
      <label className="check">
        <input type="checkbox" checked={b.uniform} onChange={(e) => run(updateEntity(b.id, { uniform: e.target.checked }, 'Cube lock'))} />
        Cube lock
      </label>
    </>
  );
}

function RectFields({ r }: { r: RectEntity }) {
  const planeName = { ground: 'Ground', wallL: 'Wall (L)', wallR: 'Wall (R)' }[r.plane];
  return (
    <>
      <p className="muted">{planeName}</p>
      <NumberField label="W" value={r.size.x} step={0.1} min={0.05} onChange={(v) => run(updateEntity(r.id, { size: { ...r.size, x: v } }, 'Resize'))} />
      <NumberField label="H" value={r.size.y} step={0.1} min={0.05} onChange={(v) => run(updateEntity(r.id, { size: { ...r.size, y: v } }, 'Resize'))} />
      <NumberField label="Elev." value={r.position.z} step={0.1} onChange={(v) => run(updateEntity(r.id, { position: { ...r.position, z: v } }, 'Lift'))} />
    </>
  );
}

function StrokeFields({ s }: { s: StrokeEntity }) {
  return (
    <>
      <div className="seg-group">
        {(['pencil', 'pen', 'marker'] as const).map((t) => (
          <button key={t} className={s.tool === t ? 'seg active' : 'seg'} onClick={() => run(updateEntity(s.id, { tool: t }, 'Stroke tool'))}>
            {t}
          </button>
        ))}
      </div>
      <div className="swatches">
        {PEN_COLORS.map((c) => (
          <button key={c} className={c === s.color ? 'swatch active' : 'swatch'} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => run(updateEntity(s.id, { color: c }, 'Colour'))} />
        ))}
      </div>
      <NumberField label="Width" value={s.width} step={1} min={0.5} max={80} onChange={(v) => run(updateEntity(s.id, { width: v }, 'Width'))} />
      <NumberField label="Opacity" value={s.opacity} step={0.1} min={0.05} max={1} onChange={(v) => run(updateEntity(s.id, { opacity: v }, 'Opacity'))} />
    </>
  );
}

function ScenePanel({ doc }: { doc: SceneDocument }) {
  const eye = doc.eye;
  const locked = useUiStore((s) => s.perspectiveLocked);
  return (
    <>
      <label className="row-field">
        <span>Name</span>
        <input defaultValue={doc.name} key={doc.name} onBlur={(e) => e.target.value.trim() && e.target.value !== doc.name && run(renameDocument(e.target.value.trim()))} />
      </label>
      <div className="seg-group">
        {(['2pt', '3pt'] as const).map((m) => (
          <button key={m} className={modeOf(eye) === m ? 'seg active' : 'seg'} disabled={locked} onClick={() => run(setEye(setEyeMode(eye, m)))}>
            {m === '2pt' ? '2-point' : '3-point'}
          </button>
        ))}
      </div>
      {/* PS-07 (revised): eye height and horizon are the same thing (ADR-0005). */}
      <NumberField
        label="Eye height (u)"
        value={eye.position.z}
        step={0.1}
        min={0.1}
        onChange={(v) => !locked && run(setEye(withEyeHeight(eye, v)))}
      />
      <p className="muted">Changing the eye height moves the horizon; the ground point sets the distance.</p>
      <p className="muted">Paper {doc.paper.width} × {doc.paper.height} pp</p>
    </>
  );
}

export function Inspector({ doc, theme }: { doc: SceneDocument; theme: Theme }) {
  const selection = useUiStore((s) => s.selection);
  const panel = useUiStore((s) => s.panel);
  // Collapsed on phones so the canvas stays visible; open on wide screens.
  const [open, setOpen] = useState(() => window.innerWidth >= 820);
  const selected = selection.map((id) => doc.entities[id]).filter((e): e is KnownEntity => !!e && !('unknown' in e));
  if (!selected.length && panel !== 'inspector') return null;

  const one = selected.length === 1 ? selected[0] : null;
  const title = one
    ? one.kind === 'box'
      ? (one as BoxEntity).uniform
        ? 'Cube'
        : 'Box'
      : one.kind === 'rect'
        ? 'Rectangle'
        : 'Stroke'
    : selected.length
      ? `${selected.length} items`
      : 'Scene';
  const ids = selected.map((e) => e.id);

  return (
    <aside className={open ? 'inspector open' : 'inspector'}>
      <button className="sheet-handle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <strong>{title}</strong>
        {one?.kind === 'box' && <span className="muted">{(['x', 'y', 'z'] as const).map((k) => (one as BoxEntity).size[k].toFixed(2)).join(' × ')} u</span>}
        {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>
      {open && (
        <div className="sheet-body">
          {!selected.length && <ScenePanel doc={doc} />}
          {one?.kind === 'box' && <BoxFields b={one as BoxEntity} theme={theme} />}
          {one?.kind === 'rect' && <RectFields r={one as RectEntity} />}
          {one?.kind === 'stroke' && <StrokeFields s={one as StrokeEntity} />}
          {one && <LayerSelect doc={doc} e={one} />}
          {selected.length > 0 && (
            <div className="actions">
              <button onClick={() => {
                const out: string[] = [];
                run(duplicateEntities(ids, out));
                useUiStore.getState().select(out);
              }}>
                <Copy size={16} /> Duplicate
              </button>
              {one && (
                <>
                  <button aria-label="Bring forward" onClick={() => run(reorderEntity(one.id, 1))}>
                    <ArrowUp size={16} />
                  </button>
                  <button aria-label="Send backward" onClick={() => run(reorderEntity(one.id, -1))}>
                    <ArrowDown size={16} />
                  </button>
                </>
              )}
              <button className="danger" onClick={() => {
                run(deleteEntities(ids));
                useUiStore.getState().select([]);
              }}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
