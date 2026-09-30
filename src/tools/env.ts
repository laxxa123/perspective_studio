// What tools may do (§8.6): read the document and derived state, run
// commands, and drive UI feedback. Wired to the stores in tools/registry.ts.
import type { Command, Recipe } from '../core/commands/history';
import type { DisplayOptions } from '../core/derive/display';
import type { RenderItem, RenderModel } from '../core/derive/renderModel';
import type { Id, Layer, SceneDocument } from '../core/document/types';
import type { Camera } from '../core/perspective/types';
import type { Vec2 } from '../core/math/vec';
import type { HapticsPort } from '../platform/haptics';
import type { SketchSettings } from '../state/uiStore';

export interface ToolEnv {
  doc(): SceneDocument;
  cam(): Camera;
  display(): DisplayOptions;
  model(): RenderModel;
  selection(): Id[];
  select(ids: Id[]): void;
  run(cmd: Command): void;
  begin(label: string): void;
  preview(recipe: Recipe): void;
  commit(): void;
  cancel(): void;
  setLive(items: RenderItem[]): void;
  setMarquee(r: { x: number; y: number; width: number; height: number } | null): void;
  openContextMenu(id: Id, screen: Vec2): void;
  toast(msg: string): void;
  haptics: HapticsPort;
  /** World grid step (u) when grid snapping is on. */
  snapStep(): number | null;
  /** The layer new entities of this role go to (created if needed by the caller). */
  targetLayer(role: Layer['role']): Id | null;
  afterPlace(): void;
  sketch(): SketchSettings;
  /** The chosen shape (UI-01). */
  shape(): { kind: string; option: string };
  /** Working plane height, or null when off (PL-01). */
  workingPlane(): number | null;
  /** Touch multi-select mode (UI-04). */
  multi(): boolean;
  penSeen(): boolean;
}

/** Can the user pick / edit this entity? (not locked, layer visible and unlocked) */
export function isEditable(doc: SceneDocument, id: Id): boolean {
  const e = doc.entities[id];
  if (!e || 'unknown' in e || e.locked || !e.visible) return false;
  const l = doc.layers.find((x) => x.id === e.layerId);
  return !!l && l.visible && !l.locked;
}
