// Tool registry (§8.4 "tools follow the same pattern"): one line per tool,
// all sharing one ToolEnv wired to the stores.
import { setPerspective } from '../core/commands/commands';
import type { Layer } from '../core/document/types';
import { haptics } from '../platform/haptics';
import { cameraOf, renderModelOf } from '../state/derived';
import type { KnownEntity } from '../core/document/types';
import { pinPointOf } from '../core/entities/pin';
import { useDocumentStore } from '../state/documentStore';
import { useSettingsStore } from '../state/settingsStore';
import { useUiStore, type ToolId } from '../state/uiStore';
import type { ToolEnv } from './env';
import { createPerspectiveTool, type PerspectiveTool } from './perspectiveTool';
import { createPlaceTool } from './placeTool';
import { createSelectTool } from './selectTool';
import { createSketchTool } from './sketchTool';
import type { Tool } from './types';

let penSeen = false;
export const notePen = () => {
  penSeen = true;
};

const docState = () => useDocumentStore.getState();
const ui = () => useUiStore.getState();

/** The first visible, unlocked layer of a role: the active one if it qualifies. */
function targetLayer(role: Layer['role']): string | null {
  const doc = docState().doc!;
  const ok = (l: Layer | undefined) => !!l && l.role === role && l.visible && !l.locked;
  const active = doc.layers.find((l) => l.id === ui().activeLayer[role]);
  if (ok(active)) return active!.id;
  const top = [...doc.layers].reverse().find(ok);
  return top?.id ?? null;
}

export const toolEnv: ToolEnv = {
  doc: () => docState().doc!,
  cam: () => cameraOf(docState().doc!.perspective),
  display: () => ui().display,
  model: () => renderModelOf(docState().doc!, ui().display, ui().selection, ui().workingPlane),
  selection: () => ui().selection,
  select: (ids) => ui().select(ids),
  run: (cmd) => docState().run(cmd),
  begin: (label) => docState().begin(label),
  preview: (recipe) => docState().preview(recipe),
  commit: () => docState().commit(),
  cancel: () => docState().cancel(),
  setLive: (live) => ui().set({ live }),
  setMarquee: (marquee) => ui().set({ marquee }),
  openContextMenu: (id, s) => ui().set({ contextMenu: { id, x: s.x, y: s.y } }),
  toast: (m) => ui().showToast(m),
  haptics,
  snapStep: () => {
    const s = useSettingsStore.getState();
    return s.gridSnap ? s.gridStep : null;
  },
  targetLayer,
  afterPlace: () => {
    if (useSettingsStore.getState().returnToSelect) ui().setTool('select');
  },
  sketch: () => ui().sketch,
  shape: () => ui().shape,
  workingPlane: () => ui().workingPlane,
  multi: () => ui().multi,
  penSeen: () => penSeen,
};

export const perspectiveTool: PerspectiveTool = createPerspectiveTool({
  getPerspective: () => docState().doc!.perspective,
  getViewport: () => ui().viewport!,
  begin: () => docState().begin('Change perspective'),
  preview: (ps) => docState().preview(setPerspective(ps).recipe),
  commit: () => docState().commit(),
  cancel: () => docState().cancel(),
  setDragging: (d) => ui().setDragging(d),
  haptics,
  scaleLock: () => ui().scaleLock,
  pinTarget: () => {
    // PS-10: the selected object's front-bottom corner (nearest the eye).
    if (!ui().pinSelection || ui().selection.length !== 1) return null;
    const e = docState().doc!.entities[ui().selection[0]];
    if (!e || 'unknown' in e) return null;
    return pinPointOf(e as KnownEntity, cameraOf(docState().doc!.perspective));
  },
  onDragStart: () => {
    // SK-06: once per document, when it has strokes.
    const doc = docState().doc!;
    if (!ui().strokeWarningShown && Object.values(doc.entities).some((e) => e.kind === 'stroke')) {
      ui().set({ strokeWarningShown: true });
      ui().showToast('Sketch strokes stay where they are on the paper; they do not follow the perspective.');
    }
  },
});

const TOOLS: Record<ToolId, Tool> = {
  select: createSelectTool(toolEnv),
  shape: createPlaceTool(toolEnv),
  sketch: createSketchTool(toolEnv),
  perspective: perspectiveTool,
};

export const toolFor = (id: ToolId): Tool => TOOLS[id];
