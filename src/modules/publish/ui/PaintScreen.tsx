// Drawing on a tile (PUBLISH §6.5) with the SKETCH brush engine (ADR-0010),
// laid out like SKETCH: the tile edge to edge, ‹ (done) and ⋯ on top, one
// floating bar — colour · brush · eraser · grid · undo · redo. The bars stay
// put while drawing. The brush sheet holds the brushes (named), size dots,
// an opacity strip and the five recent colours; [+] opens the palette with
// the picker and an eyedropper. Done returns at once: the drawing is shown
// from memory and stored in the background.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Ellipsis, Eraser, Grid3x3, Pipette, Plus, Redo2, Undo2, X } from 'lucide-react';
import { createDocument } from '../../sketch/core/document';
import { DEFAULT_PRESETS, OPACITY_LEVELS, QUICK_COLOURS, SIZE_LEVELS, gridPreset } from '../../sketch/core/presets';
import { RasterEngine } from '../../sketch/engine/RasterEngine';
import { PointerInput } from '../../sketch/input/PointerInput';
import { withAlpha } from '../core/colour';
import { chooseBrush, chooseColour, defaultColours, ERASER, erasing, readPrefs, toggleEraser, type DrawPrefs } from '../core/drawPrefs';
import { addElement, newId, paintFor, updateElement } from '../core/tile';
import type { PaintElement } from '../core/types';
import { TILE_H, TILE_W } from '../core/types';
import { hasInk, toEngineTiles } from '../core/paintTiles';
import { canvasToBlob, renderTile } from '../render/draw';
import { cacheImage, imageCache } from '../render/images';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { ColourPicker } from './ColourPicker';
import { backgroundWrite, trackAsset } from './session';
import { PresetGlyph } from './PresetGlyph';
import { useHold } from '../../../platform/hold';

const st = usePublishStore.getState;
const KEY = 'creative.publish.draw';
const BRUSHES = DEFAULT_PRESETS.filter((p) => p.id !== ERASER);
const TILE_SHOWN = 1;

/** Leaves the drawing screen keeping the drawing (‹ and Android back). */
export const paintExit: { current: (() => void) | null } = { current: null };

function loadPrefs(): DrawPrefs {
  try {
    return readPrefs(JSON.parse(localStorage.getItem(KEY) ?? 'null'), DEFAULT_PRESETS.map((p) => p.id));
  } catch {
    return readPrefs(null, DEFAULT_PRESETS.map((p) => p.id));
  }
}

type Pixels = { w: number; h: number; data: Uint8ClampedArray };

/** Puts a drawing on the tile at once (from memory); its PNG is written in the background. */
async function commit(el: PaintElement | null, px: Pixels) {
  const tile = st().tile!;
  if (!hasInk(px.data)) {
    // Nothing drawn: a new drawing is dropped; an emptied one is removed.
    if (el) st().apply({ ...tile, elements: tile.elements.filter((x) => x.id !== el.id) });
    return;
  }
  const image = new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.w, px.h);
  // A new asset each time, so undo can bring the previous drawing back.
  const id = newId('asset');
  cacheImage(id, await createImageBitmap(image));
  trackAsset(id);
  if (el) st().apply(updateElement<PaintElement>(st().tile!, el.id, { assetId: id }));
  else st().apply(addElement(st().tile!, paintFor(id)));
  backgroundWrite(
    (async () => {
      const c = document.createElement('canvas');
      c.width = px.w;
      c.height = px.h;
      c.getContext('2d')!.putImageData(image, 0, 0);
      await (await publishStore()).putAsset(await canvasToBlob(c), id);
    })(),
  );
}

export function PaintScreen({ el }: { el: PaintElement | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const engine = useRef<RasterEngine | null>(null);
  const under = useRef<HTMLCanvasElement | null>(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [panel, setPanel] = useState<'none' | 'brush' | 'colour' | 'more'>('none');
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [picking, setPicking] = useState<null | { x: number; y: number; c: string | null }>(null);
  const sampler = useRef<((x: number, y: number) => string) | null>(null);

  const update = (next: DrawPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode: settings are just not remembered.
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = boxRef.current!;
    const doc = { ...createDocument('Paint', 'transparent'), references: [{ id: 'under', assetId: 'under', x: TILE_W / 2, y: TILE_H / 2, width: TILE_W, aspect: TILE_W / TILE_H, rotation: 0, opacity: TILE_SHOWN, locked: true, hidden: false }] };
    const e = new RasterEngine(canvas, doc);
    engine.current = e;
    e.setPageColor([0.93, 0.92, 0.9]);
    // The tile without this drawing, as the reference underneath.
    under.current = renderTile(st().tile!, imageCache, 1, (x) => x.id === el?.id);
    e.setReferenceImage('under', under.current);
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
      // The bars stay where they are while drawing (no flicker); an open sheet closes.
      onStroke: (a) => a && setPanel('none'),
      onRefused: () => undefined,
      onUndo: () => e.undo(),
      onRedo: () => e.redo(),
      onReference: () => undefined,
      onTap: () => setPanel('none'),
    });
    paintExit.current = () => {
      const px = e.exportPixels(true, 1);
      st().set({ overlay: 'none', selected: null });
      void commit(el, px);
    };
    return () => {
      paintExit.current = null;
      ro.disconnect();
      input.dispose();
      off();
      e.dispose();
      engine.current = null;
    };
  }, [el]);

  // Brush, guides and the tile underneath follow the settings.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const p = DEFAULT_PRESETS.find((x) => x.id === prefs.preset) ?? DEFAULT_PRESETS[0];
    e.brush = { preset: p, color: prefs.color, sizeScale: SIZE_LEVELS[prefs.size], opacity: OPACITY_LEVELS[prefs.opacity] };
    const ref = e.doc.references[0];
    if (ref && ref.hidden === prefs.showTile) e.setReferences([{ ...ref, opacity: TILE_SHOWN, hidden: !prefs.showTile }]);
    const want = prefs.grid ? 'thirds' : 'none';
    if (e.doc.guides.type !== want) e.setGuides({ ...gridPreset(e.doc.guides, want), visible: prefs.grid });
  }, [prefs]);

  const discard = () => {
    const e = engine.current;
    if (!e) return;
    const px = e.exportPixels(true, 1);
    st().set({ overlay: 'none', selected: null });
    st().showSnack('Drawing changes discarded', { label: 'Undo', run: () => void commit(el, px) });
  };
  const clear = () => {
    const e = engine.current;
    if (!e) return;
    e.clearLayer(e.doc.layers[0].id);
    setPanel('none');
    st().showSnack('Drawing cleared', { label: 'Undo', run: () => engine.current?.undo() });
  };
  // Tap: eraser on / off; hold: clear the drawing (as in SKETCH).
  const eraserHold = useHold(() => update(toggleEraser(prefs)), clear);

  /** Eyedropper: the colour at a point — the drawing over the tile. */
  const startPick = () => {
    const e = engine.current;
    if (!e || !under.current) return;
    const px = e.exportPixels(true, 1);
    const ref = under.current.getContext('2d')!.getImageData(0, 0, TILE_W, TILE_H).data;
    sampler.current = (dx, dy) => {
      const x = Math.max(0, Math.min(TILE_W - 1, Math.round(dx)));
      const y = Math.max(0, Math.min(TILE_H - 1, Math.round(dy)));
      const i = (y * TILE_W + x) * 4;
      const a = px.data[i + 3] / 255;
      const ch = (k: number) => Math.round(px.data[i + k] * a + ref[i + k] * (1 - a));
      return `#${[ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    };
    setPanel('none');
    setPicking({ x: -1, y: -1, c: null });
  };
  const pickAt = (ev: React.PointerEvent) => {
    const e = engine.current;
    const r = boxRef.current!.getBoundingClientRect();
    const p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    const d = e?.toDoc(p);
    const inside = d && d.x >= 0 && d.y >= 0 && d.x < TILE_W && d.y < TILE_H;
    setPicking({ x: p.x, y: p.y, c: inside && sampler.current ? sampler.current(d.x, d.y) : null });
  };
  const stopPick = () => {
    sampler.current = null;
    setPicking(null);
  };

  const erase = erasing(prefs);
  const brushId = erase ? prefs.lastBrush : prefs.preset;
  const color = prefs.color;
  return (
    <div className="pb-draw" role="dialog" aria-label="Draw">
      <div className="pb-draw-area" ref={boxRef}>
        <canvas ref={canvasRef} aria-label="Drawing canvas" />
        {picking && (
          <div
            className="pb-pick"
            onPointerDown={(ev) => {
              ev.currentTarget.setPointerCapture(ev.pointerId);
              pickAt(ev);
            }}
            onPointerMove={(ev) => ev.buttons && pickAt(ev)}
            onPointerUp={() => {
              if (picking.c) update(chooseColour(prefs, picking.c));
              stopPick();
            }}
          >
            {picking.c && <i className="pb-loupe" style={{ left: picking.x, top: picking.y - 70, background: picking.c }} />}
          </div>
        )}
      </div>

      <div className="pb-draw-top">
        <button className="pb-fab" aria-label="Done" onClick={() => paintExit.current?.()}>
          <ChevronLeft size={22} />
        </button>
        {picking && (
          <div className="pb-draw-chip">
            Touch a colour on the tile
            <button aria-label="Cancel picking" onClick={stopPick}>
              <X size={14} />
            </button>
          </div>
        )}
        <button className={`pb-fab${panel === 'more' ? ' on' : ''}`} aria-label="More" onClick={() => setPanel(panel === 'more' ? 'none' : 'more')}>
          <Ellipsis size={22} />
        </button>
      </div>

      {panel === 'more' && (
        <div className="pb-draw-menu" role="menu">
          <label className="pb-draw-check">
            <input type="checkbox" checked={prefs.showTile} onChange={() => update({ ...prefs, showTile: !prefs.showTile })} /> Show tile underneath
          </label>
          <button role="menuitem" onClick={clear}>
            Clear drawing
          </button>
          <button role="menuitem" className="danger" onClick={discard}>
            Discard changes
          </button>
        </div>
      )}

      {panel === 'brush' && (
        <div className="pb-draw-sheet" role="dialog" aria-label="Brush">
          <div className="pb-draw-brushes">
            {BRUSHES.map((p) => (
              <button key={p.id} className={!erase && p.id === brushId ? 'on' : ''} aria-pressed={!erase && p.id === brushId} onClick={() => update(chooseBrush(prefs, p.id))}>
                <PresetGlyph id={p.id} size={20} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className="pb-draw-row">
            <span>Size</span>
            <div className="pb-draw-sizes" role="radiogroup" aria-label="Size">
              {SIZE_LEVELS.map((_, i) => (
                <button key={i} role="radio" aria-checked={i === prefs.size} aria-label={`Size ${i + 1}`} className={i === prefs.size ? 'on' : ''} onClick={() => update({ ...prefs, size: i })}>
                  <i style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
                </button>
              ))}
            </div>
          </div>
          {!erase && (
            <>
              <div className="pb-draw-row">
                <span>Opacity</span>
                <div className="pb-draw-opacity" role="radiogroup" aria-label="Opacity">
                  {OPACITY_LEVELS.map((o, i) => (
                    <button
                      key={i}
                      role="radio"
                      aria-checked={i === prefs.opacity}
                      aria-label={`Opacity ${Math.round(o * 100)}%`}
                      className={i === prefs.opacity ? 'on' : ''}
                      style={{ backgroundImage: `linear-gradient(${withAlpha(color, o)}, ${withAlpha(color, o)}), conic-gradient(#e2ded6 25%, #fff 0 50%, #e2ded6 0 75%, #fff 0)`, backgroundSize: 'auto, 10px 10px' }}
                      onClick={() => update({ ...prefs, opacity: i })}
                    />
                  ))}
                </div>
              </div>
              <div className="pb-draw-row">
                <button className="pb-draw-label" aria-label="Default colours" title="Default colours" onClick={() => (update(defaultColours(prefs)), st().showSnack('Default colours'))}>
                  Colour
                </button>
                <div className="pb-draw-colours">
                  {prefs.recent.map((c) => (
                    <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => update(chooseColour(prefs, c))} />
                  ))}
                  <button className="more" aria-label="More colours" onClick={() => setPanel('colour')}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {panel === 'colour' && (
        <div className="pb-draw-sheet" role="dialog" aria-label="Colour">
          <div className="pb-draw-palette">
            {QUICK_COLOURS.map((c) => (
              <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => (update(chooseColour(prefs, c)), setPanel('none'))} />
            ))}
            <button className="pick" aria-label="Pick a colour from the tile" onClick={startPick}>
              <Pipette size={18} />
            </button>
          </div>
          <ColourPicker value={color} onLive={(c) => setPrefs({ ...prefs, color: c })} onDone={() => update(chooseColour(prefs, prefs.color))} onPick={(c) => update(chooseColour(prefs, c))} />
        </div>
      )}

      <nav className="pb-draw-bar" aria-label="Drawing controls">
        <button className={panel === 'colour' ? 'on' : ''} aria-label="Colour" onClick={() => setPanel(panel === 'colour' ? 'none' : 'colour')}>
          <span className="pb-draw-dot" style={{ background: color }} />
        </button>
        <button className={`${panel === 'brush' ? 'on' : ''}${erase ? '' : ' cur'}`} aria-label={`Brush: ${BRUSHES.find((b) => b.id === brushId)?.name ?? ''}`} onClick={() => setPanel(panel === 'brush' ? 'none' : 'brush')}>
          <PresetGlyph id={brushId} size={22} />
        </button>
        <button className={`hold${erase ? ' cur' : ''}`} aria-label="Eraser (hold to clear the drawing)" aria-pressed={erase} {...eraserHold}>
          <Eraser size={22} />
        </button>
        <button className={prefs.grid ? 'lit' : ''} aria-label="Grid" aria-pressed={prefs.grid} onClick={() => update({ ...prefs, grid: !prefs.grid })}>
          <Grid3x3 size={22} />
        </button>
        <button aria-label="Undo" disabled={!hist.undo} onClick={() => engine.current?.undo()}>
          <Undo2 size={22} />
        </button>
        <button aria-label="Redo" disabled={!hist.redo} onClick={() => engine.current?.redo()}>
          <Redo2 size={22} />
        </button>
      </nav>
    </div>
  );
}
