// Extension point: entity kinds (§8.4).
import type { z } from 'zod';
import type { RenderItem } from '../derive/renderModel';
import type { DisplayOptions } from '../derive/display';
import type { Entity, EntityBase, Id } from '../document/types';
import type { Vec2 } from '../math/vec';
import type { Camera, Family } from '../perspective/types';
import type { Eye } from '../perspective/view';
import type { Rect } from '../viewport/viewport';

export interface DeriveCtx {
  cam: Camera;
  /** The stored eye the camera came from (memo key). */
  eye: Eye;
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

/** A placeable variant of a kind, listed in the Shapes submenu (UI-01). */
export interface ShapeOption {
  id: string;
  label: string;
  /** 'surface': placed per BX-02; a number: placed on the horizontal plane z = that height (ceiling, RC-02). */
  placeOn: 'surface' | number;
}

export interface PlaceInput {
  option: string;
  /** Where the tap landed (Placement from core/snapping). */
  point: { x: number; y: number; z: number };
  mode: 'rest' | 'hang';
  layerId: string;
  id: string;
  snapStep: number | null;
}

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
  /** Placeable variants for the Shapes submenu (world kinds only). */
  shapes?: ShapeOption[];
  /** Creates a new entity at a placement (§8.4 `create`). */
  create?(input: PlaceInput): E;
}

export const snap = (v: number, step: number | null): number => (step ? Math.round(v / step) * step : v);
