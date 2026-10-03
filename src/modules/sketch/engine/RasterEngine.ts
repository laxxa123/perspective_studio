// The SKETCH raster engine (SKETCH §3, §25): owns the artwork. React never
// sees a pointer move; the UI calls this API and listens for state changes.
// Rendering is on demand: a frame is drawn only when something changed.
import type { BrushPreset, InputPoint, LayerModel, ReferenceModel, SketchDocument, GuideModel } from '../core/types';
import { DOC_H, DOC_W, TILE } from '../core/types';
import { insertLayer, layerIndex, moveLayer as moveLayerIn, newLayer, nextLayerName, patchLayer as patchLayerIn, removeLayer, activeLayer } from '../core/document';
import { cubeDots, cubeLetters, cubeOutline, nearestSnap, snapPoints } from '../core/grids';
import { actualSizeView, fitView, guideHandles, pageGuideSegments, polygonBounds, toDoc, type GuideHandle, type Pt, type SelTransform, type View } from '../core/geometry';
import type { Command } from '../core/history';
import { bindTarget, hexToRgb, type GL, type Target } from './gl';
import { Renderer } from './Renderer';
import { TilePool, Surface, TILE_BYTES } from './TileManager';
import { BACKGROUNDS, Compositor } from './Compositor';
import { BrushEngine } from './BrushEngine';
import { SelectionEngine } from './SelectionEngine';
import { UndoEngine } from './UndoEngine';

export interface BrushSettings {
  preset: BrushPreset;
  color: string;
  sizeScale: number;
  opacity: number;
}

export interface StoredTile {
  layerId: string;
  index: number;
  /** Premultiplied RGBA, 256×256, top row first. */
  data: Uint8Array;
}

export interface SaveWork {
  doc: SketchDocument;
  tiles: { layerId: string; index: number; data: Uint8Array | null }[];
}

/** Why a stroke or edit could not start. */
export type Refusal = 'locked' | 'hidden' | null;

const GUIDE_COLOR = [0.11, 0.49, 0.84];
const SEL_COLOR = [0.11, 0.49, 0.84, 1];

export class RasterEngine {
  readonly gl: GL;
  private r: Renderer;
  private pool: TilePool;
  private compositor: Compositor;
  private brushEngine: BrushEngine;
  readonly selection: SelectionEngine;
  private undoEngine: UndoEngine;
  private surfaces = new Map<string, Surface>();
  private refs = new Map<string, { tex: WebGLTexture; w: number; h: number }>();
  private listeners = new Set<() => void>();
  private dirtyListeners = new Set<() => void>();
  private saveTiles = new Map<string, Set<number>>();
  private docDirty = false;
  private pending: InputPoint[] = [];
  private raf = 0;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private page = [0.91, 0.91, 0.9, 1];
  doc: SketchDocument;
  view: View = { scale: 0.3, x: 0, y: 0 };
  brush: BrushSettings | null = null;
  /** A selection being drawn (rectangle / lasso), document px. */
  draft: Pt[] | null = null;
  /** The reference being edited (outlined). */
  editingRef: string | null = null;
  /** The GPU context was lost (the UI reopens the project from storage). */
  lost = false;
  /** Strokes start and end on a grid's snap point when they are near one. */
  private snap = false;
  private snapCache: { g: GuideModel; pts: readonly Pt[] } | null = null;
  private fitted = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    doc: SketchDocument,
  ) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, depth: false, stencil: false });
    if (!gl) throw new Error('WebGL 2 is not available on this device.');
    this.gl = gl;
    this.r = new Renderer(gl);
    this.pool = new TilePool(gl);
    this.compositor = new Compositor(gl, this.r);
    this.brushEngine = new BrushEngine(gl, this.r, this.pool);
    this.selection = new SelectionEngine(gl, this.r);
    this.undoEngine = new UndoEngine(
      {
        surface: (id) => this.surfaces.get(id),
        tilesChanged: (id, tiles) => this.tilesChanged(id, tiles),
        // Layer commands restore the layer stack only; guides, references and metadata stay as they are now.
        applyDoc: (d) => this.applyDoc({ ...this.doc, layers: d.layers, activeLayer: d.activeLayer }),
        applySelection: (p) => {
          this.selection.set(p);
          this.invalidate();
        },
      },
      this.pool,
      () => {
        this.gc();
        this.emit();
      },
    );
    this.doc = doc;
    for (const l of doc.layers) this.surfaces.set(l.id, new Surface(this.pool));
    canvas.addEventListener('webglcontextlost', this.onLost);
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.raf);
    this.emit();
  };

  // ----- events -----

  /** State the UI mirrors (document, history, selection). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Something needs saving. */
  onDirty(fn: () => void): () => void {
    this.dirtyListeners.add(fn);
    return () => this.dirtyListeners.delete(fn);
  }
  private emit() {
    for (const f of this.listeners) f();
  }
  private dirtied() {
    for (const f of this.dirtyListeners) f();
  }

  get canUndo() {
    return this.undoEngine.history.canUndo;
  }
  get canRedo() {
    return this.undoEngine.history.canRedo;
  }
  get floating() {
    return this.selection.floating;
  }
  get hasSelection() {
    return this.selection.poly !== null;
  }

  // ----- loading / saving -----

  /** Uploads stored tiles (premultiplied RGBA). */
  loadTiles(tiles: readonly StoredTile[]) {
    const gl = this.gl;
    for (const t of tiles) {
      const s = this.surfaces.get(t.layerId);
      if (!s || t.data.length !== TILE * TILE * 4) continue;
      const tile = s.ensure(t.index);
      gl.bindTexture(gl.TEXTURE_2D, tile.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TILE, TILE, gl.RGBA, gl.UNSIGNED_BYTE, t.data);
    }
    this.compositor.markAll();
    this.invalidate();
  }

  /** A reference image's pixels (decoded by the UI). */
  setReferenceImage(assetId: string, img: TexImageSource & { width: number; height: number }) {
    const gl = this.gl;
    const old = this.refs.get(assetId);
    if (old) gl.deleteTexture(old.tex);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.refs.set(assetId, { tex, w: img.width, h: img.height });
    this.invalidate();
  }

  /** Reads one tile back (premultiplied RGBA, top row first). */
  readTile(t: Target): Uint8Array {
    const gl = this.gl;
    const out = new Uint8Array(TILE * TILE * 4);
    bindTarget(gl, t);
    gl.readPixels(0, 0, TILE, TILE, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  get needsSave() {
    return this.docDirty || this.saveTiles.size > 0;
  }

  /** Everything changed since the last call (SKETCH §19: autosave writes only dirty tiles). */
  takeSaveWork(): SaveWork {
    const tiles: SaveWork['tiles'] = [];
    for (const [layerId, set] of this.saveTiles) {
      const s = this.surfaces.get(layerId);
      if (!s || !this.doc.layers.some((l) => l.id === layerId)) continue;
      for (const index of set) {
        const t = s.get(index);
        tiles.push({ layerId, index, data: t ? this.readTile(t) : null });
      }
    }
    this.saveTiles.clear();
    this.docDirty = false;
    return { doc: this.doc, tiles };
  }

  /** Marks every tile of every layer for saving (a duplicated project, a first save). */
  markAllForSave() {
    for (const l of this.doc.layers) this.saveTiles.set(l.id, new Set(this.surfaces.get(l.id)?.tiles.keys()));
    this.docDirty = true;
  }

  private tilesChanged(layerId: string, tiles: Iterable<number>) {
    const set = this.saveTiles.get(layerId) ?? new Set<number>();
    for (const i of tiles) set.add(i);
    this.saveTiles.set(layerId, set);
    this.compositor.mark(set);
    this.invalidate();
    this.dirtied();
  }

  // ----- view -----

  /** The canvas' CSS size changed. */
  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    if (!this.fitted) {
      this.fitted = true;
      this.fit();
    }
    this.invalidate();
  }

  fit() {
    this.setView(fitView(this.cssW, this.cssH));
  }
  actualSize() {
    this.setView(actualSizeView(this.view, this.cssW, this.cssH, this.dpr));
  }
  setView(v: View) {
    this.view = v;
    this.invalidate();
  }
  get screen(): { w: number; h: number; dpr: number } {
    return { w: this.cssW, h: this.cssH, dpr: this.dpr };
  }
  toDoc(p: Pt): Pt {
    return toDoc(this.view, p);
  }
  /** Fill colour around the canvas (theme). */
  setPageColor(rgb: readonly number[]) {
    this.page = [rgb[0], rgb[1], rgb[2], 1];
    this.invalidate();
  }

  // ----- painting -----

  private layerModel(id = this.doc.activeLayer): LayerModel | undefined {
    return this.doc.layers[layerIndex(this.doc, id)];
  }

  /** Whether the active layer can be edited. */
  refusal(): Refusal {
    const l = this.layerModel();
    return !l ? 'locked' : l.locked ? 'locked' : !l.visible ? 'hidden' : null;
  }

  strokeBegin(p: InputPoint): Refusal {
    const why = this.refusal();
    if (why || !this.brush || this.floating) return why;
    const b = this.brush;
    const layer = this.surfaces.get(this.doc.activeLayer)!;
    const tiles = this.brushEngine.begin(
      { preset: b.preset, color: hexToRgb(b.color), sizeScale: b.sizeScale, opacity: b.opacity * b.preset.opacity, layerId: this.doc.activeLayer, layer, mask: this.selection.maskTex },
      p,
    );
    this.compositor.mark(tiles);
    this.invalidate();
    return null;
  }

  strokeMove(points: InputPoint[]) {
    if (!this.brushEngine.active) return;
    this.pending.push(...points);
    this.invalidate();
  }

  strokeEnd() {
    if (!this.brushEngine.active) return;
    this.flushPending();
    const { change, tiles } = this.brushEngine.end();
    this.compositor.mark(tiles);
    if (change) {
      const preset = this.brush?.preset;
      this.undoEngine.push(this.undoEngine.tiles(preset?.name ?? 'Stroke', change.layerId, change.before));
      this.doc = { ...this.doc, metadata: { ...this.doc.metadata, strokes: this.doc.metadata.strokes + 1 } };
      this.docDirty = true;
      this.tilesChanged(change.layerId, change.before.keys());
    }
    this.invalidate();
  }

  /** Drops the stroke in progress (it turned out to be a gesture). */
  strokeCancel() {
    this.pending = [];
    this.compositor.mark(this.brushEngine.cancel());
    this.invalidate();
  }

  get stroking() {
    return this.brushEngine.active;
  }

  private flushPending() {
    if (!this.pending.length) return;
    const pts = this.pending;
    this.pending = [];
    this.compositor.mark(this.brushEngine.move(pts));
  }

  // ----- document / layers -----

  /** Replaces the document; recorded as one undo step unless `record` is false. */
  editDoc(next: SketchDocument, label: string, record = true, before = this.doc) {
    if (next === this.doc && before === next) return;
    this.applyDoc(next);
    if (record && before !== next) this.undoEngine.push(this.undoEngine.doc(label, before, next));
  }

  private applyDoc(d: SketchDocument) {
    const prev = new Set(this.doc.layers.map((l) => l.id));
    for (const l of d.layers) {
      if (!this.surfaces.has(l.id)) this.surfaces.set(l.id, new Surface(this.pool));
      // A layer that comes back (undo of a delete) must be saved again.
      if (!prev.has(l.id)) this.saveTiles.set(l.id, new Set(this.surfaces.get(l.id)!.tiles.keys()));
    }
    this.doc = d;
    this.docDirty = true;
    this.compositor.markAll();
    this.invalidate();
    this.emit();
    this.dirtied();
  }

  /** Frees the pixels of layers nothing can bring back. */
  private gc() {
    const keep = this.undoEngine.referencedLayers();
    for (const l of this.doc.layers) keep.add(l.id);
    for (const [id, s] of this.surfaces) {
      if (keep.has(id)) continue;
      s.dispose();
      this.surfaces.delete(id);
    }
  }

  selectLayer(id: string) {
    if (layerIndex(this.doc, id) < 0 || id === this.doc.activeLayer) return;
    this.commitFloating();
    this.applyDoc({ ...this.doc, activeLayer: id });
  }

  addLayer() {
    this.commitFloating();
    this.editDoc(insertLayer(this.doc, newLayer(nextLayerName(this.doc))), 'New layer');
  }

  duplicateLayer(id: string) {
    const src = this.layerModel(id);
    const surface = this.surfaces.get(id);
    if (!src || !surface) return;
    this.commitFloating();
    const copy = { ...newLayer(`${src.name} copy`), opacity: src.opacity, blend: src.blend, visible: src.visible };
    this.surfaces.set(copy.id, surface.clone());
    this.editDoc(insertLayer(this.doc, copy, layerIndex(this.doc, id) + 1), 'Duplicate layer');
    this.saveTiles.set(copy.id, new Set(this.surfaces.get(copy.id)!.tiles.keys()));
  }

  deleteLayer(id: string) {
    this.commitFloating();
    this.editDoc(removeLayer(this.doc, id), 'Delete layer');
  }

  moveLayer(id: string, to: number) {
    this.editDoc(moveLayerIn(this.doc, id, to), 'Reorder layers');
  }

  /** Layer properties; sliders preview with `record` false, then record once with the drag's start document. */
  patchLayer(id: string, patch: Partial<Omit<LayerModel, 'id'>>, record = true, before = this.doc) {
    this.editDoc(patchLayerIn(this.doc, id, patch), 'Layer', record, before);
  }

  /** Clears every visible, unlocked layer as one undo step; false when there was nothing to clear. */
  clearSheet(): boolean {
    this.commitFloating();
    const parts: Command[] = [];
    for (const l of this.doc.layers) {
      const s = this.surfaces.get(l.id);
      if (!s || !s.tiles.size || l.locked || !l.visible) continue;
      const before = new Map<number, Target | null>();
      for (const i of [...s.tiles.keys()]) {
        before.set(i, s.snapshot(i));
        s.restore(i, null);
      }
      parts.push(this.undoEngine.tiles('Clear sheet', l.id, before));
      this.tilesChanged(l.id, before.keys());
    }
    if (!parts.length) return false;
    this.undoEngine.push(this.undoEngine.group('Clear sheet', parts));
    return true;
  }

  /** Clears a layer's pixels (undoable). */
  clearLayer(id: string) {
    const s = this.surfaces.get(id);
    if (!s || !s.tiles.size) return;
    const before = new Map<number, Target | null>();
    for (const i of [...s.tiles.keys()]) {
      before.set(i, s.snapshot(i));
      s.restore(i, null);
    }
    this.undoEngine.push(this.undoEngine.tiles('Clear layer', id, before));
    this.tilesChanged(id, before.keys());
  }

  // ----- guides & references (not artwork, not in the undo history) -----

  setGuides(g: GuideModel) {
    this.doc = { ...this.doc, guides: g };
    this.docDirty = true;
    this.invalidate();
    this.emit();
    this.dirtied();
  }

  setSnap(on: boolean) {
    if (on === this.snap) return;
    this.snap = on;
    this.invalidate();
  }

  private snapPts(): readonly Pt[] {
    const g = this.doc.guides;
    if (this.snapCache?.g !== g) this.snapCache = { g, pts: snapPoints(g) };
    return this.snapCache.pts;
  }

  /** Soft snap: the grid point near a document point (within a finger's reach, never more than a third of the dot spacing), or null. */
  snapTo(p: Pt, reach = 16): Pt | null {
    if (!this.snap) return null;
    return nearestSnap(this.snapPts(), p, Math.min(reach / this.view.scale, 20));
  }

  /** The guide handle under a screen point (CSS px), if the grid can be edited. */
  handleAt(p: Pt, radius = 26): GuideHandle | null {
    const g = this.doc.guides;
    if (!g.visible || g.locked) return null;
    let best: GuideHandle | null = null;
    let bestD = radius;
    for (const h of guideHandles(g)) {
      const d = Math.hypot(h.at.x * this.view.scale + this.view.x - p.x, h.at.y * this.view.scale + this.view.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
    return best;
  }

  setReferences(refs: ReferenceModel[]) {
    this.doc = { ...this.doc, references: refs };
    this.docDirty = true;
    this.invalidate();
    this.emit();
    this.dirtied();
  }

  /** The topmost visible reference under a document point. */
  referenceAt(p: Pt): ReferenceModel | null {
    for (let i = this.doc.references.length - 1; i >= 0; i--) {
      const r = this.doc.references[i];
      if (r.hidden) continue;
      const c = Math.cos(-r.rotation);
      const s = Math.sin(-r.rotation);
      const dx = p.x - r.x;
      const dy = p.y - r.y;
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      if (Math.abs(lx) <= r.width / 2 && Math.abs(ly) <= r.width / r.aspect / 2) return r;
    }
    return null;
  }

  private refMatrix(r: ReferenceModel, w: number): number[] {
    const k = r.width / w;
    const c = Math.cos(r.rotation) * k;
    const s = Math.sin(r.rotation) * k;
    const hw = w / 2;
    const hh = w / r.aspect / 2;
    // source px → document: rotate/scale about the image centre, then place at (x, y).
    return [c, s, -s, c, r.x - (c * hw - s * hh), r.y - (s * hw + c * hh)];
  }

  // ----- selection (SKETCH §15) -----

  setDraft(poly: Pt[] | null) {
    this.draft = poly;
    this.invalidate();
  }

  setSelection(poly: Pt[] | null) {
    this.commitFloating();
    const before = this.selection.poly;
    const next = poly && poly.length >= 3 && area(poly) > 4 ? poly : null;
    if (!before && !next) return;
    this.selection.set(next);
    this.undoEngine.push(this.undoEngine.selection(next ? 'Select' : 'Deselect', before, next));
    this.invalidate();
  }

  /** Starts moving / scaling / rotating the selection (a copy when `duplicate`). */
  liftSelection(duplicate = false): Refusal {
    const why = this.refusal();
    if (why) return why;
    if (this.floating) return null;
    const layer = this.surfaces.get(this.doc.activeLayer)!;
    const f = this.selection.lift(this.doc.activeLayer, layer, duplicate);
    if (f) this.compositor.mark(f.before.keys());
    this.invalidate();
    this.emit();
    return null;
  }

  transformFloating(t: SelTransform) {
    if (!this.floating) return;
    this.floating.t = t;
    this.invalidate();
  }

  commitFloating() {
    const f = this.floating;
    if (!f) return;
    const layer = this.surfaces.get(f.layerId);
    if (!layer) {
      this.selection.cancel(undefined, (t) => this.pool.release(t));
      return;
    }
    const before = this.selection.poly;
    const res = this.selection.commit(layer)!;
    this.selection.set(res.poly);
    this.undoEngine.push(this.undoEngine.group('Transform', [this.undoEngine.tiles('Transform', f.layerId, res.before), this.undoEngine.selection('Transform', before, res.poly)]));
    this.tilesChanged(f.layerId, res.tiles);
    this.emit();
  }

  cancelFloating() {
    const f = this.floating;
    if (!f) return;
    this.compositor.mark(this.selection.cancel(this.surfaces.get(f.layerId), (t) => this.pool.release(t)));
    this.invalidate();
    this.emit();
  }

  deleteSelection(): Refusal {
    const why = this.refusal();
    if (why) return why;
    this.commitFloating();
    const before = this.selection.erase(this.surfaces.get(this.doc.activeLayer)!);
    if (before.size) {
      this.undoEngine.push(this.undoEngine.tiles('Delete selection', this.doc.activeLayer, before));
      this.tilesChanged(this.doc.activeLayer, before.keys());
    }
    return null;
  }

  // ----- history -----

  undo() {
    if (this.stroking) return;
    if (this.floating) return this.cancelFloating();
    this.undoEngine.history.undo();
  }
  redo() {
    if (this.stroking || this.floating) return;
    this.undoEngine.history.redo();
  }

  /** Pushes a ready-made command (tests / tools). */
  record(c: Command) {
    this.undoEngine.push(c);
  }

  // ----- export (SKETCH §20) -----

  private background(transparent: boolean) {
    return transparent ? BACKGROUNDS.transparent : BACKGROUNDS[this.doc.canvas.background];
  }

  /** The flattened image (straight alpha, top row first). Never changes the project. */
  exportPixels(transparent = this.doc.canvas.background === 'transparent', scale = 1) {
    this.compositor.update(this.compositeLayers(), null);
    return this.compositor.flatten(this.background(transparent), scale);
  }

  // ----- frame loop -----

  invalidate() {
    if (this.raf || this.lost) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private compositeLayers() {
    return this.doc.layers.map((model) => ({ model, surface: this.surfaces.get(model.id)! })).filter((l) => l.surface);
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.lost) return;
    this.flushPending();
    if (this.brushEngine.active) {
      this.compositor.mark(this.brushEngine.tick(now));
      if (this.brushEngine.kind === 'airbrush') this.invalidate();
    }
    this.compositor.update(this.compositeLayers(), this.brushEngine.live());
    this.present();
  };

  /** Draws everything now (also used by tests and after a resize). */
  renderNow() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.frame(performance.now());
  }

  private present() {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    bindTarget(gl, null, W, H);
    gl.clearColor(this.page[0], this.page[1], this.page[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const clip = Compositor.screenClip(this.view, W, H, this.dpr);
    const refs = this.doc.references
      .filter((r) => !r.hidden && this.refs.has(r.assetId))
      .map((r) => {
        const t = this.refs.get(r.assetId)!;
        return { tex: t.tex, w: t.w, h: t.h, m: this.refMatrix(r, t.w), opacity: r.opacity };
      });
    this.compositor.drawArtwork(clip, this.view.scale * this.dpr, BACKGROUNDS[this.doc.canvas.background], refs);
    this.selection.drawFloating(clip);
    this.drawOverlays();
  }

  private drawOverlays() {
    const v = this.view;
    const scr: [number, number] = [this.cssW, this.cssH];
    const g = this.doc.guides;
    if (g.visible && g.type !== 'none') {
      const a = g.opacity;
      const tint = (k: number) => [GUIDE_COLOR[0] * a * k, GUIDE_COLOR[1] * a * k, GUIDE_COLOR[2] * a * k, a * k];
      if (g.type === 'cube') {
        // The square faintly, the six faces firmly, their letters and dots.
        this.r.drawLines(pageGuideSegments(g), v, scr, 1, tint(0.45));
        this.r.drawLines(cubeOutline(), v, scr, 1.6, tint(1));
        this.r.drawLines(cubeLetters(), v, scr, 1.2, tint(0.7));
        this.r.drawDots(cubeDots().map((d) => ({ ...d, r: 2 })), v, scr, tint(1), this.dpr, false);
      } else {
        this.r.drawLines(pageGuideSegments(g), v, scr, 1.1, tint(1));
        // The snap points show while snapping is on.
        if (this.snap) this.r.drawDots(this.snapPts().map((d) => ({ ...d, r: 2.5 })), v, scr, tint(1), this.dpr, false);
      }
      if (!g.locked) this.r.drawDots(guideHandles(g).map((h) => ({ ...h.at, r: 9 })), v, scr, [0.11, 0.49, 0.84, 1], this.dpr);
    }
    const outline = (poly: Pt[] | null, closed = true) => {
      if (!poly || poly.length < 2) return;
      const segs: number[][] = [];
      for (let i = 0; i < poly.length - (closed ? 0 : 1); i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        segs.push([a.x, a.y, b.x, b.y]);
      }
      this.r.drawLines(segs, v, scr, 1.5, [1, 1, 1, 1]);
      this.r.drawLines(segs, v, scr, 1.5, SEL_COLOR, 5);
    };
    const f = this.floating;
    if (f) {
      const poly = this.selection.transformedPoly();
      outline(poly);
      const m = this.selection.matrix()!;
      const b = f.bounds;
      const box = [
        { x: b.x0, y: b.y0 },
        { x: b.x1, y: b.y0 },
        { x: b.x1, y: b.y1 },
        { x: b.x0, y: b.y1 },
      ].map((p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }));
      outline(box);
      this.r.drawDots(
        box.map((p) => ({ ...p, r: 7 })),
        v,
        scr,
        SEL_COLOR,
        this.dpr,
      );
    } else outline(this.selection.poly);
    outline(this.draft, false);
    if (this.editingRef) {
      const r = this.doc.references.find((x) => x.id === this.editingRef);
      const t = r && this.refs.get(r.assetId);
      if (r && t) {
        const m = this.refMatrix(r, t.w);
        const h = t.w / r.aspect;
        outline(
          [
            { x: 0, y: 0 },
            { x: t.w, y: 0 },
            { x: t.w, y: h },
            { x: 0, y: h },
          ].map((p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })),
        );
      }
    }
  }

  // ----- diagnostics (SKETCH §24: monitor texture memory) -----

  stats() {
    let layerTiles = 0;
    for (const l of this.doc.layers) layerTiles += this.surfaces.get(l.id)?.tiles.size ?? 0;
    return { layerTiles, gpuBytes: this.pool.bytes + DOC_W * DOC_H * 4, undoBytes: this.undoEngine.history.bytes(), undoSteps: this.undoEngine.history.size, tileBytes: TILE_BYTES, dabs: this.brushEngine.dabs };
  }

  get active(): LayerModel {
    return activeLayer(this.doc);
  }

  /** The bounds of the selection, document px. */
  selectionBounds() {
    return this.selection.poly ? polygonBounds(this.selection.poly) : null;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.brushEngine.dispose();
    this.undoEngine.history.clear();
    for (const s of this.surfaces.values()) s.dispose();
    this.surfaces.clear();
    for (const r of this.refs.values()) this.gl.deleteTexture(r.tex);
    this.selection.dispose();
    this.compositor.dispose();
    this.pool.dispose();
    this.r.dispose();
    this.listeners.clear();
    this.dirtyListeners.clear();
  }
}

function area(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  return Math.abs(a / 2);
}
