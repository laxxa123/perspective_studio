// Derived state (§7.1): camera and render model, memoized; used by the
// renderer and by the tools' hit-testing alike.
import { deriveDocument, newDeriveCache } from '../core/derive/derive';
import type { DisplayOptions } from '../core/derive/display';
import type { RenderModel } from '../core/derive/renderModel';
import { derivePlan, type PlanModel } from '../core/derive/plan';
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
let modelKey: { doc: SceneDocument; display: DisplayOptions; selection: readonly Id[]; workingPlane: number | null } | null = null;
let model: RenderModel | null = null;

export function renderModelOf(doc: SceneDocument, display: DisplayOptions, selection: readonly Id[], workingPlane: number | null = null): RenderModel {
  if (!model || !modelKey || modelKey.doc !== doc || modelKey.display !== display || modelKey.selection !== selection || modelKey.workingPlane !== workingPlane) {
    model = deriveDocument(doc, display, new Set(selection), cache, { workingPlane });
    modelKey = { doc, display, selection, workingPlane };
  }
  return model;
}

let planKey: { doc: SceneDocument } | null = null;
let plan: PlanModel | null = null;

/** The plan view model (CV-05). */
export function planModelOf(doc: SceneDocument): PlanModel {
  if (!plan || !planKey || planKey.doc !== doc) {
    plan = derivePlan(doc, cameraOf(doc.perspective));
    planKey = { doc };
  }
  return plan;
}
