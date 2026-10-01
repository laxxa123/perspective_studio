// The CubeModel (CUBE §6, §14–§16): the single source of truth for a cube.
// Konva and Three.js only render it. Pure data, no UI or storage types.

export type FaceId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const FACE_IDS: readonly FaceId[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Clockwise quarter turns. */
export type Turns = 0 | 1 | 2 | 3;

/**
 * A face placed on the unfolded net: grid cell (col, row) and how far its
 * artwork is turned clockwise inside the cell. Net coordinates: one cell = 1,
 * x to the right, y down.
 */
export interface NetCell {
  face: FaceId;
  col: number;
  row: number;
  turns: Turns;
  /** Only in question figures: a mirrored face (distractor D05). */
  mirrored?: boolean;
}

export interface NetLayout {
  cells: NetCell[];
}

/**
 * Placement of an artwork element in face-local units (CUBE §15): the face is
 * the unit square, (0, 0) its top-left corner, x right, y down. `x, y` is the
 * element's centre; rotation in degrees, clockwise.
 */
export interface Transform2 {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type ElementKind = 'path' | 'text' | 'image' | 'stamp';

/** How a path element was drawn (for editing and DNA only). */
export type PathOrigin = 'pen' | 'line' | 'rect' | 'ellipse' | 'polygon' | 'arrow' | 'stamp';

/**
 * One semantic artwork element (CUBE §14). Geometry is in element-local units
 * centred on (0, 0), inside a `w × h` box; `transform` places it on the face.
 */
export interface ArtworkElement {
  id: string;
  kind: ElementKind;
  transform: Transform2;
  w: number;
  h: number;
  opacity: number;
  /** SVG path data (path, stamp). */
  path?: string;
  origin?: PathOrigin;
  /** Stamp id from the stamp library. */
  stamp?: string;
  fill?: string | null;
  stroke?: string | null;
  /** Element-local units. */
  strokeWidth?: number;
  text?: string;
  /** Element-local units. */
  fontSize?: number;
  /** Stable asset id (CUBE §19), never a device path. */
  assetId?: string;
  /** Image crop as fractions of the source image. */
  crop?: { x: number; y: number; w: number; h: number };
}

/** Rotational symmetry of a face's artwork: 4 = looks the same at every quarter turn. */
export type Symmetry = 'auto' | 1 | 2 | 4;

export interface FaceModel {
  id: FaceId;
  background: string;
  /** 0..1 */
  backgroundOpacity: number;
  /** Bottom → top. */
  elements: ArtworkElement[];
  /** 'auto': blank faces are fully symmetric, faces with artwork are not. */
  symmetry: Symmetry;
}

/**
 * Artwork spanning several faces (CUBE §16): one source element, anchored to a
 * face, with one clipped fragment per face it covers. Fragments are face-local,
 * so the pattern survives folding and re-layout without copies.
 */
export interface SurfacePattern {
  id: string;
  /** The element, its transform in the anchor face's frame. */
  element: ArtworkElement;
  anchor: FaceId;
  fragments: { face: FaceId; transform: Transform2 }[];
  continuityMode: 'fold';
}

export interface CubeModel {
  schema: 'creative.cube.model.v1';
  faces: Record<FaceId, FaceModel>;
  net: NetLayout;
  patterns: SurfacePattern[];
}

export const IDENTITY: Transform2 = { x: 0.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 };

const DEFAULT_COLOURS: Record<FaceId, string> = {
  A: '#ffffff',
  B: '#ffffff',
  C: '#ffffff',
  D: '#ffffff',
  E: '#ffffff',
  F: '#ffffff',
};

export function blankFace(id: FaceId): FaceModel {
  return { id, background: DEFAULT_COLOURS[id], backgroundOpacity: 1, elements: [], symmetry: 'auto' };
}

export function newCubeModel(net: NetLayout): CubeModel {
  const faces = Object.fromEntries(FACE_IDS.map((f) => [f, blankFace(f)])) as Record<FaceId, FaceModel>;
  return { schema: 'creative.cube.model.v1', faces, net, patterns: [] };
}

/** Elements that make a face's orientation matter. */
export const hasArtwork = (m: CubeModel, f: FaceId): boolean =>
  m.faces[f].elements.length > 0 || m.patterns.some((p) => p.fragments.some((fr) => fr.face === f));

/** The face's rotational symmetry order (1, 2 or 4). */
export function symmetryOf(m: CubeModel, f: FaceId): 1 | 2 | 4 {
  const s = m.faces[f].symmetry;
  if (s !== 'auto') return s;
  return hasArtwork(m, f) ? 1 : 4;
}

/** Whether a mirrored copy of the face can be told apart (blank faces cannot). */
export const mirrorVisible = (m: CubeModel, f: FaceId): boolean => hasArtwork(m, f);
