// The persisted document (§7.2–§7.7).
import type { Vec2, Vec3 } from '../math/vec';
import type { Family } from '../perspective/types';
import type { Eye } from '../perspective/view';

export type Id = string;

export interface Layer {
  id: Id;
  name: string;
  /** Which entity kinds it accepts. */
  role: 'objects' | 'sketch';
  visible: boolean;
  locked: boolean;
  /** 0..1 */
  opacity: number;
  /** Entity ids, bottom → top. */
  order: Id[];
}

export interface EntityBase {
  id: Id;
  kind: string;
  layerId: Id;
  name?: string;
  visible: boolean;
  locked: boolean;
}

/** Axis-aligned rectangular prism (§7.4). A cube is a box with uniform: true. */
export interface BoxEntity extends EntityBase {
  kind: 'box';
  /** World min corner; z = 0 is on the ground. */
  position: Vec3;
  /** x along family R, y along family L, z along family V; all > 0. */
  size: Vec3;
  uniform: boolean;
}

/** Ground / wall rectangle (§7.5). */
export interface RectEntity extends EntityBase {
  kind: 'rect';
  /** normal Z, normal X, normal Y */
  plane: 'ground' | 'wallL' | 'wallR';
  position: Vec3;
  /** Extents along the plane's two axes. */
  size: Vec2;
}

/** Sketch stroke on the picture plane (§7.6). */
export interface StrokeEntity extends EntityBase {
  kind: 'stroke';
  space: 'picture';
  tool: 'pencil' | 'pen' | 'marker';
  color: string;
  width: number;
  opacity: number;
  /** Flat [x, y, pressure, …] in pp. */
  points: number[];
  constraint?: { family: Family; mode: 'soft' | 'locked' };
}

/** An entity of an unregistered kind, kept and re-saved unchanged (§7.7). */
export interface UnknownEntity {
  id: Id;
  kind: string;
  layerId: Id;
  unknown: true;
  raw: unknown;
}

export type KnownEntity = BoxEntity | RectEntity | StrokeEntity;
export type Entity = KnownEntity | UnknownEntity;

export const isUnknown = (e: Entity): e is UnknownEntity => (e as UnknownEntity).unknown === true;

export interface Paper {
  width: number;
  height: number;
}

/** 2: the eye replaced the perspective system as the stored setting (ADR-0006). */
export const SCHEMA_VERSION = 2;

export interface SceneDocument {
  schemaVersion: number;
  id: Id;
  name: string;
  /** ISO */
  createdAt: string;
  updatedAt: string;
  paper: Paper;
  /** The eye (ADR-0006); the horizon and VPs are derived from it. */
  eye: Eye;
  /** Bottom → top draw order. */
  layers: Layer[];
  entities: Record<Id, Entity>;
}
