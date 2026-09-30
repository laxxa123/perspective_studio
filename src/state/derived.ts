// Derived state (§7.1): camera and render model, memoized; used by the
// renderer and by the tools' hit-testing alike.
import { deriveDocument, newDeriveCache } from '../core/derive/derive';
import type { DisplayOptions } from '../core/derive/display';
import type { RenderModel } from '../core/derive/renderModel';
import type { Id, SceneDocument } from '../core/document/types';
import { deriveCamera } from '../core/perspective/camera';
import type { Camera, PerspectiveSystem } from '../core/perspective/types';

let camKey: PerspectiveSystem | null = null;
let cam: Camera | null = null;

export function cameraOf(ps: PerspectiveSystem): Camera {
  if (ps !== camKey || !cam) {
    cam = deriveCamera(ps);
    camKey = ps;
  }
  return cam;
}

const cache = newDeriveCache();
let modelKey: { doc: SceneDocument; display: DisplayOptions; selection: readonly Id[] } | null = null;
let model: RenderModel | null = null;

export function renderModelOf(doc: SceneDocument, display: DisplayOptions, selection: readonly Id[]): RenderModel {
  if (!model || !modelKey || modelKey.doc !== doc || modelKey.display !== display || modelKey.selection !== selection) {
    model = deriveDocument(doc, display, new Set(selection), cache);
    modelKey = { doc, display, selection };
  }
  return model;
}
