// The open sketch: engine handle, autosave, export (SKETCH §19, §20).
import { createDocument, touch } from '../core/document';
import { gridPreset } from '../core/presets';
import { RasterEngine } from '../engine/RasterEngine';
import { encodePng, savePng, sharePng } from '../storage/ExportService';
import { projectStore } from '../storage/ProjectStore';
import { currentPreset, opacityValue, sizeScale, useSketchStore } from '../state/useSketchStore';

/** The engine of the sketch on screen (not React state: it owns the artwork). */
export const engineRef: { current: RasterEngine | null } = { current: null };

const st = useSketchStore.getState;
let chain: Promise<void> = Promise.resolve();

/** Pushes the brush choices into the engine. */
export function syncBrush() {
  const e = engineRef.current;
  if (!e) return;
  const s = st();
  e.brush = { preset: currentPreset(s), color: s.color, sizeScale: sizeScale(s.sizeLevel), opacity: opacityValue(s.opacityLevel) };
}

/** Saves what changed (queued; never two saves at once). */
export function saveNow(engine?: RasterEngine): Promise<void> {
  const target = engine ?? engineRef.current;
  chain = chain.then(async () => {
    const e = target;
    if (!e || e.lost || !e.needsSave) return;
    if (e.stroking) {
      scheduleSave();
      return;
    }
    st().set({ saving: true });
    try {
      const work = e.takeSaveWork();
      const thumb = await encodePng(e.exportPixels(false, 0.25));
      const store = await projectStore();
      await store.save(touch(work.doc), work.tiles, thumb);
    } catch (err) {
      st().showToast(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      st().set({ saving: false });
    }
  });
  return chain;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Autosave shortly after the last change (SKETCH §19: invisible, automatic). */
export function scheduleSave(delay = 1200) {
  clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), delay);
}

/** A new project with the settings' defaults; returns its id. */
export async function newProject(): Promise<string> {
  const s = st();
  const store = await projectStore();
  const n = (await store.list()).length + 1;
  const doc = createDocument(`Sketch ${n}`, s.settings.background);
  const withGrid = { ...doc, guides: gridPreset(doc.guides, s.settings.defaultGrid) };
  await store.save(withGrid, []);
  return doc.id;
}

/** The flattened PNG of the open sketch (SKETCH §20). */
export async function exportOpenPng(): Promise<Blob | null> {
  const e = engineRef.current;
  if (!e) return null;
  const s = st().settings;
  return encodePng(e.exportPixels(s.exportTransparent || e.doc.canvas.background === 'transparent', s.exportScale));
}

/** Renders a stored project to PNG without opening it (gallery "Share PNG"). */
export async function renderProjectPng(id: string): Promise<{ name: string; png: Blob } | null> {
  const store = await projectStore();
  const p = await store.load(id);
  if (!p) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const e = new RasterEngine(canvas, p.doc);
  try {
    e.loadTiles(p.tiles);
    const s = st().settings;
    const png = await encodePng(e.exportPixels(s.exportTransparent || p.doc.canvas.background === 'transparent', s.exportScale));
    return { name: p.doc.name, png };
  } finally {
    e.dispose();
    e.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export async function shareProject(id: string) {
  const r = await renderProjectPng(id);
  if (r) await sharePng(r.name, r.png);
}

export async function shareOpen() {
  const e = engineRef.current;
  const png = await exportOpenPng();
  if (e && png) await sharePng(e.doc.name, png);
}

export async function saveOpenPng(): Promise<string | null> {
  const e = engineRef.current;
  const png = await exportOpenPng();
  return e && png ? savePng(e.doc.name, png) : null;
}
