// Drawing on a tile (PUBLISH §6.5) with the SKETCH brush engine (ADR-0010):
// the tile shows underneath as a locked reference; the drawing is kept as a
// full-tile transparent PNG (a flattened element). Same brushes, pressure,
// gestures (two fingers pan / zoom, two-finger tap undo) as SKETCH.
import { useEffect, useRef, useState } from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { createDocument } from '../../sketch/core/document';
import { DEFAULT_PRESETS, OPACITY_LEVELS, SIZE_LEVELS } from '../../sketch/core/presets';
import { RasterEngine } from '../../sketch/engine/RasterEngine';
import { PointerInput } from '../../sketch/input/PointerInput';
import { addElement, paintFor, updateElement } from '../core/tile';
import type { PaintElement } from '../core/types';
import { TILE_H, TILE_W } from '../core/types';
import { hasInk, toEngineTiles } from '../core/paintTiles';
import { canvasToBlob, renderTile } from '../render/draw';
import { cacheImage, imageCache } from '../render/images';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { trackAsset } from './session';
import { PresetGlyph } from './PresetGlyph';

const st = usePublishStore.getState;
const INKS = ['#111111', '#ffffff', '#6c757d', '#c92a2a', '#e8590c', '#f2c94c', '#2b8a3e', '#1c7ed6', '#5f3dc4', '#d6336c'];

export function PaintScreen({ el }: { el: PaintElement | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const engine = useRef<RasterEngine | null>(null);
  const [preset, setPreset] = useState('pen');
  const [size, setSize] = useState(2);
  const [opacity, setOpacity] = useState(4);
  const [color, setColor] = useState('#111111');
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const doc = { ...createDocument('Paint', 'transparent'), references: [{ id: 'under', assetId: 'under', x: TILE_W / 2, y: TILE_H / 2, width: TILE_W, aspect: TILE_W / TILE_H, rotation: 0, opacity: 1, locked: true, hidden: false }] };
    const e = new RasterEngine(canvas, doc);
    engine.current = e;
    e.setPageColor([0.13, 0.13, 0.14]);
    // The tile without this drawing, as the reference underneath.
    const tile = st().tile!;
    e.setReferenceImage('under', renderTile(tile, imageCache, 1, (x) => x.id === el?.id));
    const bmp = el ? imageCache.get(el.assetId) : undefined;
    if (bmp) {
      const c = document.createElement('canvas');
      c.width = TILE_W;
      c.height = TILE_H;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0, TILE_W, TILE_H);
      const px = ctx.getImageData(0, 0, TILE_W, TILE_H).data;
      e.loadTiles(toEngineTiles(px, TILE_W, TILE_H).map((t) => ({ layerId: doc.layers[0].id, ...t })));
    }
    const off = e.subscribe(() => setHist({ undo: e.canUndo, redo: e.canRedo }));
    const resize = () => {
      const r = box.getBoundingClientRect();
      e.resize(r.width, r.height, Math.min(3, window.devicePixelRatio || 1));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    const input = new PointerInput(canvas, e, {
      mode: () => 'draw',
      fingerDraw: () => 'auto',
      tapUndo: () => true,
      tapRedo: () => true,
      onStroke: (a) => setDrawing(a),
      onRefused: () => undefined,
      onUndo: () => e.undo(),
      onRedo: () => e.redo(),
      onReference: () => undefined,
    });
    return () => {
      ro.disconnect();
      input.dispose();
      off();
      e.dispose();
      engine.current = null;
    };
  }, [el]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const p = DEFAULT_PRESETS.find((x) => x.id === preset) ?? DEFAULT_PRESETS[0];
    e.brush = { preset: p, color, sizeScale: SIZE_LEVELS[size], opacity: OPACITY_LEVELS[opacity] };
  }, [preset, size, opacity, color]);

  const done = async () => {
    const e = engine.current;
    if (!e) return;
    const px = e.exportPixels(true, 1);
    const tile = st().tile!;
    if (!hasInk(px.data)) {
      // Nothing drawn: a new drawing is dropped; an emptied one is removed.
      if (el) st().apply({ ...tile, elements: tile.elements.filter((x) => x.id !== el.id) });
      st().set({ overlay: 'none', selected: null });
      return;
    }
    const c = document.createElement('canvas');
    c.width = px.w;
    c.height = px.h;
    c.getContext('2d')!.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.w, px.h), 0, 0);
    const blob = await canvasToBlob(c);
    // A new asset each time, so undo can bring the previous drawing back.
    const id = await (await publishStore()).putAsset(blob);
    trackAsset(id);
    cacheImage(id, await createImageBitmap(blob));
    if (el) st().apply(updateElement<PaintElement>(st().tile!, el.id, { assetId: id }));
    else {
      const p = paintFor(id);
      st().apply(addElement(st().tile!, p));
    }
    st().set({ overlay: 'none', selected: null });
  };

  return (
    <div className="pb-paint" role="dialog" aria-label="Draw">
      <header className={`pb-top dark${drawing ? ' fade' : ''}`}>
        <button className="pb-pill ghost" onClick={() => st().set({ overlay: 'none' })}>
          Cancel
        </button>
        <span className="pb-spacer" />
        <button className="pb-icon light" aria-label="Undo" disabled={!hist.undo} onClick={() => engine.current?.undo()}>
          <Undo2 size={22} />
        </button>
        <button className="pb-icon light" aria-label="Redo" disabled={!hist.redo} onClick={() => engine.current?.redo()}>
          <Redo2 size={22} />
        </button>
        <button className="pb-pill primary" onClick={() => void done()}>
          Done
        </button>
      </header>
      <div className="pb-paint-area" ref={boxRef}>
        <canvas ref={canvasRef} aria-label="Drawing canvas" />
      </div>
      <footer className={`pb-paint-bar${drawing ? ' fade' : ''}`}>
        <div className="pb-brushes">
          {DEFAULT_PRESETS.map((p) => (
            <button key={p.id} className={p.id === preset ? 'on' : ''} aria-label={p.name} onClick={() => setPreset(p.id)}>
              <PresetGlyph id={p.id} />
            </button>
          ))}
        </div>
        <div className="pb-row">
          {SIZE_LEVELS.map((_, i) => (
            <button key={i} className={`pb-dot-btn${i === size ? ' on' : ''}`} aria-label={`Size ${i + 1}`} onClick={() => setSize(i)}>
              <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
            </button>
          ))}
          <span className="pb-spacer" />
          {OPACITY_LEVELS.map((o, i) => (
            <button key={i} className={`pb-dot-btn${i === opacity ? ' on' : ''}`} aria-label={`Opacity ${Math.round(o * 100)}%`} onClick={() => setOpacity(i)}>
              <i style={{ width: 14, height: 14, background: color, opacity: o }} />
            </button>
          ))}
        </div>
        <div className="pb-swatches">
          {INKS.map((c) => (
            <button key={c} className={`pb-swatch${c === color ? ' on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setColor(c)} />
          ))}
        </div>
      </footer>
    </div>
  );
}
