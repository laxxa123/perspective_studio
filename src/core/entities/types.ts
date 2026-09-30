// Extension point: entity kinds (§8.4).
import type { z } from 'zod';
import type { RenderItem } from '../derive/renderModel';
import type { DisplayOptions } from '../derive/display';
import type { Entity, EntityBase, Id } from '../document/types';
import type { Vec2 } from '../math/vec';
import type { Camera, Family, PerspectiveSystem } from '../perspective/types';
import type { Rect } from '../viewport/viewport';

export interface DeriveCtx {
  cam: Camera;
  ps: PerspectiveSystem;
  display: DisplayOptions;
  selected: boolean;
}

export interface CreateCtx {
  cam: Camera;
  layerId: Id;
}

export interface HandleDef {
  id: string;
  /** pp */
  point: Vec2;
  family?: Family;
  kind: 'resize' | 'lift';
}

export interface DragInput<E> {
  /** The entity as it was when the drag started. */
  start: E;
  startPp: Vec2;
  pp: Vec2;
  /** World grid step for snapping, u (OD-6); null when snapping is off. */
  snapStep: number | null;
  /** The other entities (for stacking / alignment snaps). */
  others: Entity[];
}

/** `applyHandle` with this id moves the whole entity (body drag). */
export const MOVE_HANDLE = 'move';

export interface EntityKindDef<E extends EntityBase> {
  kind: string;
  schema: z.ZodType<E>;
  layerRole: 'objects' | 'sketch';
  derive(e: E, ctx: DeriveCtx): RenderItem[];
  handles(e: E, ctx: DeriveCtx): HandleDef[];
  applyHandle(e: E, handleId: string, drag: DragInput<E>, ctx: DeriveCtx): Partial<E>;
  /** pp; null when nothing is in front of the camera. */
  bounds(e: E, ctx: DeriveCtx): Rect | null;
  /** Painter's-order key (larger = farther, drawn first); picture-plane kinds return null. */
  depth(e: E, ctx: DeriveCtx): number | null;
  /** A copy moved by one "step" (duplicate, BX-04). */
  offsetCopy(e: E): Partial<E>;
}

export const snap = (v: number, step: number | null): number => (step ? Math.round(v / step) * step : v);
