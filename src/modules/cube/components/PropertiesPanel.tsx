// Contextual properties (CUBE §45): what is selected decides what is shown —
// a picture being placed, an element, a face, the net, or the active tool.
import { ArrowDown, ArrowUp, Check, Copy, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import type { CubeModel, Symmetry } from '../model/CubeModel';
import { applyPreset, clearFace, elementAt, place, removeElement, reorder, rotateCell, setFace, updateElement } from '../model/edit';
import { uid } from '../model/ids';
import { STAMPS, TEXT_STAMPS } from '../model/Stamps';
import { PRESETS } from '../geometry/NetShapes';
import { textElement } from '../canvas/Interaction';
import { useCubeStore, type ShapeKind } from '../state/useCubeStore';
import { cancelImageSkin, finishImageSkin } from './imageSkin';

/** Face fill colours (Fill tool): white clears, then four tones. */
export const FACE_COLOURS = ['#ffffff', '#adb5bd', '#212529', '#e03131', '#1c7ed6'];
const SHAPES: [ShapeKind, string][] = [
  ['line', 'Line'],
  ['arrow', 'Arrow'],
  ['rect', 'Rectangle'],
  ['ellipse', 'Ellipse'],
  ['polygon', 'Polygon'],
];
/** Stamp / text sizes in face units: S, M, L (repeatable sizes). */
const SIZES: [number, string][] = [
  [0.25, 'S'],
  [0.4, 'M'],
  [0.6, 'L'],
];

export const COLOURS = ['#ffffff', '#212529', '#868e96', '#e03131', '#f08c00', '#fab005', '#2f9e44', '#1c7ed6', '#7048e8', '#e64980', '#0c8599', '#ffe8cc'];

function Swatches({ value, onPick, none, colours = COLOURS }: { value: string | null | undefined; onPick: (c: string | null) => void; none?: boolean; colours?: string[] }) {
  return (
    <div className="swatches">
      {none && <button className={value ? 'swatch none' : 'swatch none active'} aria-label="None" onClick={() => onPick(null)} />}
      {colours.map((c) => (
        <button key={c} className={value === c ? 'swatch active' : 'swatch'} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function PropertiesPanel({ model }: { model: CubeModel }) {
  const selected = useCubeStore((s) => s.selected);
  const face = useCubeStore((s) => s.selectedFace);
  const tool = useCubeStore((s) => s.tool);
  const style = useCubeStore((s) => s.style);
  const st = useCubeStore.getState;
  const apply = (m: CubeModel) => st().apply(m);
  const setStyle = (p: Partial<typeof style>) => st().set({ style: { ...style, ...p } });

  const skin = useCubeStore((s) => s.skin);
  if (skin) {
    return (
      <div className="cube-props">
        <div className="props-row">
          <strong>Place the picture</strong>
          <button className="seg" onClick={cancelImageSkin}>
            <X size={16} /> Cancel
          </button>
          <button className="seg primary" onClick={finishImageSkin}>
            <Check size={16} /> Done
          </button>
        </div>
        <p className="muted small">Drag to move; the handles scale and turn it. Done trims it to the faces as one picture across the folds.</p>
      </div>
    );
  }

  const sizeRow = (
    <div className="props-row">
      <span className="muted">Size</span>
      {SIZES.map(([v, l]) => (
        <button key={l} className={style.size === v ? 'seg active' : 'seg'} onClick={() => setStyle({ size: v })}>
          {l}
        </button>
      ))}
    </div>
  );

  const at = selected ? elementAt(model, selected) : null;
  if (selected && at) {
    const e = at.element;
    const upd = (patch: Parameters<typeof updateElement>[2]) => {
      const r = updateElement(model, selected, patch);
      st().apply(r.model);
      st().set({ selected: r.ref });
    };
    return (
      <div className="cube-props">
        <div className="props-row">
          <strong>{selected.pattern ? 'Pattern across faces' : `${e.kind === 'stamp' ? 'Stamp' : e.kind === 'text' ? 'Text' : e.kind === 'image' ? 'Image' : 'Drawing'} on ${selected.face}`}</strong>
          <button className="seg" aria-label="Bring forward" onClick={() => apply(reorder(model, selected, 1))}><ArrowUp size={16} /></button>
          <button className="seg" aria-label="Send backward" onClick={() => apply(reorder(model, selected, -1))}><ArrowDown size={16} /></button>
          <button className="seg" aria-label="Duplicate" onClick={() => {
            const r = place(model, selected.face, { ...e, id: uid('el'), transform: { ...at.transform, x: at.transform.x + 0.08, y: at.transform.y + 0.08 } });
            st().apply(r.model);
            st().set({ selected: r.ref });
          }}><Copy size={16} /></button>
          <button className="seg" aria-label="Rotate 90°" onClick={() => upd({ transform: { ...at.transform, rotation: (at.transform.rotation + 90) % 360 } })}><RotateCw size={16} /></button>
          <button className="seg danger" aria-label="Delete" onClick={() => { apply(removeElement(model, selected)); st().set({ selected: null }); }}><Trash2 size={16} /></button>
        </div>
        {e.kind === 'text' && (
          <label className="row-field">
            <span>Text</span>
            <input value={e.text ?? ''} onChange={(ev) => upd({ text: ev.target.value })} />
          </label>
        )}
        {e.kind !== 'image' && (
          <div className="props-row">
            <span className="muted">Fill</span>
            <Swatches value={e.fill} none onPick={(c) => upd({ fill: c })} />
          </div>
        )}
        {e.kind !== 'image' && e.kind !== 'text' && (
          <>
            <div className="props-row">
              <span className="muted">Line</span>
              <Swatches value={e.stroke} none onPick={(c) => upd({ stroke: c })} />
            </div>
            <Slider label="Line width" value={e.strokeWidth ?? 0} min={0} max={0.2 / Math.max(at.transform.scaleX, 0.05)} step={0.005} onChange={(v) => upd({ strokeWidth: v })} />
          </>
        )}
        <Slider label="Opacity" value={e.opacity} min={0.05} max={1} step={0.05} onChange={(v) => upd({ opacity: v })} />
      </div>
    );
  }

  if (tool === 'fill') {
    return (
      <div className="cube-props">
        <div className="props-row">
          <span className="muted">Fill colour</span>
          <Swatches value={style.faceFill} colours={FACE_COLOURS} onPick={(c) => setStyle({ faceFill: c ?? '#ffffff' })} />
        </div>
        <p className="muted small">Tap a face to fill it. White clears the fill.</p>
      </div>
    );
  }

  if (face && !['pen', 'shape', 'text', 'stamp'].includes(tool)) {
    const f = model.faces[face];
    return (
      <div className="cube-props">
        <div className="props-row">
          <strong>Face {face}</strong>
          <button className="seg" aria-label="Turn face anticlockwise on the net" onClick={() => apply(rotateCell(model, face, -1))}><RotateCcw size={16} /></button>
          <button className="seg" aria-label="Turn face clockwise on the net" onClick={() => apply(rotateCell(model, face, 1))}><RotateCw size={16} /></button>
          <button className="seg danger" onClick={() => apply(clearFace(model, face))}>Clear</button>
        </div>
        <div className="props-row">
          <span className="muted">Colour</span>
          <Swatches value={f.background} colours={FACE_COLOURS} onPick={(c) => apply(setFace(model, face, { background: c ?? '#ffffff' }))} />
        </div>
        <Slider label="Transparency" value={1 - f.backgroundOpacity} min={0} max={0.9} step={0.05} onChange={(v) => apply(setFace(model, face, { backgroundOpacity: 1 - v }))} />
        <div className="props-row">
          <span className="muted">Looks the same when turned</span>
          {(['auto', 1, 2, 4] as Symmetry[]).map((s) => (
            <button key={String(s)} className={f.symmetry === s ? 'seg active' : 'seg'} onClick={() => apply(setFace(model, face, { symmetry: s }))}>
              {s === 'auto' ? 'Auto' : s === 1 ? 'Never' : s === 2 ? 'Half turn' : 'Any turn'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (tool === 'stamp') {
    return (
      <div className="cube-props">
        <div className="stamp-grid">
          {STAMPS.map((s) => (
            <button key={s.id} className={style.stamp === s.id ? 'stamp active' : 'stamp'} aria-label={s.label} onClick={() => setStyle({ stamp: s.id })}>
              <svg viewBox="-0.6 -0.6 1.2 1.2" width="26" height="26"><path d={s.path} fill={s.filled ? style.fill : 'none'} stroke={s.filled ? 'none' : style.stroke} strokeWidth={0.08} /></svg>
            </button>
          ))}
        </div>
        <div className="stamp-grid">
          {TEXT_STAMPS.map((t) => (
            <button key={t} className="stamp" onClick={() => {
              const f = face ?? 'A';
              const r = place(model, f, textElement(t, { x: 0.5, y: 0.5 }, style, style.size));
              st().apply(r.model);
              st().set({ selected: r.ref, selectedFace: r.ref.face, tool: 'select' });
            }}>{t}</button>
          ))}
        </div>
        {sizeRow}
        <div className="props-row">
          <span className="muted">Colour</span>
          <Swatches value={style.fill} onPick={(c) => setStyle({ fill: c ?? '#212529' })} />
        </div>
        <p className="muted small">Tap a face to stamp; it lands on the nearest snap point. Letters go to the selected face.</p>
      </div>
    );
  }

  if (tool === 'text') {
    return (
      <div className="cube-props">
        {sizeRow}
        <div className="props-row">
          <span className="muted">Colour</span>
          <Swatches value={style.fill} onPick={(c) => setStyle({ fill: c ?? '#212529' })} />
        </div>
        <p className="muted small">Tap a face to write; text lands on the nearest snap point.</p>
      </div>
    );
  }

  if (tool === 'pen' || tool === 'shape') {
    const filled = tool === 'shape' && style.shape !== 'line' && style.shape !== 'arrow';
    return (
      <div className="cube-props">
        {tool === 'shape' && (
          <div className="props-row">
            {SHAPES.map(([k, l]) => (
              <button key={k} className={style.shape === k ? 'seg active' : 'seg'} onClick={() => setStyle({ shape: k })}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="props-row">
          <span className="muted">Line</span>
          <Swatches value={style.stroke} onPick={(c) => setStyle({ stroke: c ?? '#212529' })} />
        </div>
        {filled && (
          <div className="props-row">
            <span className="muted">Fill</span>
            <Swatches value={style.fill} onPick={(c) => setStyle({ fill: c ?? '#1c7ed6' })} />
          </div>
        )}
        <Slider label="Width" value={style.width} min={0.01} max={0.15} step={0.005} onChange={(v) => setStyle({ width: v })} />
        {tool === 'shape' && style.shape === 'polygon' && <Slider label={`Sides (${style.sides})`} value={style.sides} min={3} max={8} step={1} onChange={(v) => setStyle({ sides: v })} />}
        <p className="muted small">{tool === 'pen' ? 'Draw anywhere on the board; what falls outside the faces is trimmed. Across a fold it stays one pattern.' : 'Corners snap to the dots, so sizes repeat. Draw across a fold for one continuous pattern.'}</p>
      </div>
    );
  }

  return (
    <div className="cube-props">
      <div className="props-row">
        <span className="muted">Start from</span>
        {PRESETS.map((p) => (
          <button key={p.id} className="seg" onClick={() => apply(applyPreset(model, p.id))}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted small">{tool === 'net' ? 'Drag faces to other board cells to rearrange the net. A face dropped on another swaps with it.' : 'Tap a face to select it; pick a tool to draw. Faces move only with Net. Two fingers pan and zoom.'}</p>
    </div>
  );
}
