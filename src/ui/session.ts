// Opening, creating and saving documents (DOC-02): IndexedDB autosave 1 s
// after the last change and on app pause (NFR-R-01); per-document UI prefs
// (viewport + display, CV-03, §7.1).
import { newDocument } from '../core/document/factory';
import { newId } from '../core/document/ids';
import { loadDocument, serializeDocument } from '../core/document/schema';
import type { SceneDocument } from '../core/document/types';
import type { DisplayOptions } from '../core/derive/display';
import { DEFAULT_DISPLAY } from '../core/derive/display';
import type { PerspectiveMode } from '../core/perspective/types';
import type { Viewport } from '../core/viewport/viewport';
import { thumbnail } from '../export/exporters';
import * as storage from '../platform/storage';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';

export const AUTOSAVE_MS = 1000;

// ----- per-document prefs (LocalStorage, not undoable) -----
interface DocPrefs {
  viewport?: Viewport;
  display?: DisplayOptions;
}
const prefsKey = (id: string) => `perspective_studio.doc.${id}`;

export function loadPrefs(id: string): DocPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(prefsKey(id)) ?? '{}') as DocPrefs;
    const v = p.viewport;
    if (v && !([v.offsetX, v.offsetY, v.zoom].every(Number.isFinite) && v.zoom > 0)) delete p.viewport;
    return p;
  } catch {
    return {};
  }
}

export function savePrefs(id: string, p: DocPrefs): void {
  try {
    localStorage.setItem(prefsKey(id), JSON.stringify(p));
  } catch {
    // Not remembered; harmless.
  }
}

// ----- saving -----
let timer: ReturnType<typeof setTimeout> | undefined;
let savedRevision = -1;
let thumbTimer: ReturnType<typeof setTimeout> | undefined;

export async function saveNow(): Promise<void> {
  clearTimeout(timer);
  const { doc, revision, txn } = useDocumentStore.getState();
  if (!doc || revision === savedRevision) return;
  const base = txn ? txn.base : doc;
  const stamped: SceneDocument = { ...base, updatedAt: new Date().toISOString() };
  savedRevision = revision;
  await storage.writeDocument(stamped.id, stamped.name, stamped.updatedAt, serializeDocument(stamped));
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    thumbnail(stamped, useUiStore.getState().display)
      .then((png) => storage.writeThumbnail(stamped.id, png))
      .catch(() => undefined);
  }, 300);
}

/** Schedules a save 1 s after the latest change. */
export function scheduleSave(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void saveNow().catch(() => useUiStore.getState().showToast('Saving failed.')), AUTOSAVE_MS);
}

// ----- opening -----
function show(doc: SceneDocument, warnings: string[] = []) {
  const prefs = loadPrefs(doc.id);
  savedRevision = 0;
  useDocumentStore.getState().load(doc);
  const objects = doc.layers.find((l) => l.role === 'objects')?.id ?? null;
  const sketch = doc.layers.find((l) => l.role === 'sketch')?.id ?? null;
  useUiStore.getState().set({
    screen: 'editor',
    viewport: prefs.viewport ?? null,
    display: prefs.display ?? DEFAULT_DISPLAY,
    tool: 'select',
    selection: [],
    panel: 'none',
    contextMenu: null,
    activeLayer: { objects, sketch },
    strokeWarningShown: false,
    live: [],
    marquee: null,
  });
  if (warnings.length) useUiStore.getState().showToast(warnings.join(' '));
}

export async function openDocument(id: string): Promise<void> {
  const raw = await storage.readDocument(id);
  if (!raw) throw new Error('Scene not found.');
  const { doc, warnings } = loadDocument(raw);
  show(doc, warnings);
}

export async function createDocument(mode: PerspectiveMode, name: string): Promise<void> {
  const doc = newDocument({ name, mode });
  await storage.writeDocument(doc.id, doc.name, doc.updatedAt, serializeDocument(doc));
  show(doc);
}

/** Stores imported / duplicated documents; ids that already exist get a new one. */
export async function storeDocuments(docs: SceneDocument[]): Promise<number> {
  const existing = new Set((await storage.listDocuments()).map((d) => d.id));
  for (const d of docs) {
    const doc = existing.has(d.id) ? { ...d, id: newId() } : d;
    await storage.writeDocument(doc.id, doc.name, doc.updatedAt, serializeDocument(doc));
    existing.add(doc.id);
  }
  return docs.length;
}

export async function closeDocument(): Promise<void> {
  await saveNow();
  const { doc } = useDocumentStore.getState();
  const ui = useUiStore.getState();
  if (doc) savePrefs(doc.id, { viewport: ui.viewport ?? undefined, display: ui.display });
  useDocumentStore.getState().close();
  ui.set({ screen: 'gallery', viewport: null, selection: [] });
}
