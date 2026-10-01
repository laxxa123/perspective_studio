// The SKETCH document model (SKETCH §18) and engine contracts. Pure data:
// pixels live in the raster engine's tiles, not here.

/** The 9:16 portrait canvas, in document pixels (SKETCH §4). */
export const DOC_W = 1080;
export const DOC_H = 1920;
/** Tile edge, px (SKETCH §10, §17). */
export const TILE = 256;
export const TILES_X = Math.ceil(DOC_W / TILE);
export const TILES_Y = Math.ceil(DOC_H / TILE);
export const MAX_LAYERS = 12;

/** Layer blend modes (SKETCH §12); more can be added without changing the model. */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'erase';
export const BLEND_MODES: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'erase'];

export interface LayerModel {
  id: string;
  name: string;
  visible: boolean;
  /** 0..1 */
  opacity: number;
  locked: boolean;
  blend: BlendMode;
}

export type GridType = 'none' | 'thirds' | '1pt' | '2pt' | '3pt';

/** Guides are not artwork (SKETCH §13). Points in document px. */
export interface GuideModel {
  type: GridType;
  visible: boolean;
  /** 0..1 */
  opacity: number;
  locked: boolean;
  horizonY: number;
  /** Vanishing points: 1pt uses vp1; 2pt vp1 + vp2; 3pt adds vp3 (vertical). */
  vp1: { x: number; y: number };
  vp2: { x: number; y: number };
  vp3: { x: number; y: number };
  /** Rays per vanishing point (grid extent / density). */
  density: number;
}

/** A reference image, separate from paint layers (SKETCH §14). */
export interface ReferenceModel {
  id: string;
  assetId: string;
  /** Centre in document px. */
  x: number;
  y: number;
  /** Displayed width in document px; height follows the aspect. */
  width: number;
  aspect: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
}

export type Background = 'white' | 'paper' | 'transparent';

export interface SketchDocument {
  schema: 'creative.sketch.document.v1';
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number; tile: number; background: Background };
  /** Bottom → top. */
  layers: LayerModel[];
  activeLayer: string;
  guides: GuideModel;
  references: ReferenceModel[];
  metadata: { app: string; strokes: number };
}

// ----- brushes (SKETCH §6–§9) -----

/** Engines: paint (stroke buffer, then committed), erase, blend (smudge), airbrush (continuous build-up). */
export type BrushEngineKind = 'paint' | 'erase' | 'blend' | 'airbrush';
export type BrushTexture = 'none' | 'grain' | 'canvas' | 'chalk';

export interface BrushPreset {
  id: string;
  name: string;
  engine: BrushEngineKind;
  /** Diameter at full pressure, document px. */
  size: number;
  /** Stroke opacity cap, 0..1. */
  opacity: number;
  /** Paint laid per dab, 0..1. */
  flow: number;
  /** Edge hardness, 0 (soft) … 1 (hard). */
  hardness: number;
  /** Dab spacing as a fraction of the diameter. */
  spacing: number;
  /** Input smoothing, 0 … 1. */
  smoothing: number;
  /** How much pressure scales size / flow, 0 … 1. */
  pressureSize: number;
  pressureOpacity: number;
  /** Faster strokes get thinner (−) or thicker (+), −1 … 1. */
  velocity: number;
  /** How much stylus tilt widens / softens the dab, 0 … 1. */
  tilt: number;
  texture: BrushTexture;
  /** Dab rotation in degrees; `followStroke` turns it along the path. */
  rotation: number;
  followStroke: boolean;
  /** Dab roundness, 1 = circle. */
  roundness: number;
  blendMode: 'normal' | 'erase';
  /** Blender: how strongly the carried paint mixes (0 … 1). */
  strength?: number;
}

/** One brush dab in document px. */
export interface Dab {
  x: number;
  y: number;
  /** Diameter. */
  size: number;
  /** Paint amount for this dab (flow × pressure), 0..1. */
  alpha: number;
  /** Radians. */
  angle: number;
  roundness: number;
  hardness: number;
}

/** One input sample from a pointer. */
export interface InputPoint {
  x: number;
  y: number;
  /** 0..1; 1 for fingers / mouse. */
  pressure: number;
  /** Stylus tilt from vertical, 0..1 (0 = upright). */
  tilt: number;
  /** Stylus azimuth, radians. */
  azimuth: number;
  /** ms */
  t: number;
}
