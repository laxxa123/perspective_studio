// Derived state (§7.1): camera and render model, memoized; used by the
// renderer and by the tools' hit-testing alike.
import { deriveDocument, newDeriveCache } from '../core/derive/derive';
import type { DisplayOptions } from '../core/derive/display';
import type { RenderModel } from '../core/derive/renderModel';
import { derivePlan, type PlanModel } from '../core/derive/plan';
import type { Id, SceneDocument } from '../core/document/types';
import type { Camera, PerspectiveSystem } from '../core/perspective/types';
import { cameraFromEye, perspectiveOf, type Eye } from '../core/perspective/view';

const cams = new WeakMap<Eye, Camera>();
const systems = new WeakMap<Eye, PerspectiveSystem | null>();

export function cameraOf(eye: Eye): Camera {
  let cam = cams.get(eye);
  if (!cam) cams.set(eye, (cam = cameraFromEye(eye)));
  return cam;
}

/** The VP-handle form of the eye; null when a stored VP is at infinity (PS-14). */
export function perspectiveFor(eye: Eye): PerspectiveSystem | null {
  if (!systems.has(eye)) systems.set(eye, perspectiveOf(eye));
  return systems.get(eye)!;
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
    plan = derivePlan(doc, cameraOf(doc.eye));
    planKey = { doc };
  }
  return plan;
}
