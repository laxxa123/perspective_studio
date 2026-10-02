// The PUBLISH tile model (PUBLISH §4). A tile is one 9:16 sheet; its elements
// are positioned in normalised tile coordinates (0..1 of width / height) so
// the same JSON can be rebuilt by the WordPress theme. Pure data.

/** Tile canvas in document px (P2, 9:16). */
export const TILE_W = 1080;
export const TILE_H = 1920;
/** Safe margin band (5 % of the width), shown while editing, never published. */
export const MARGIN = 54;

export type FontFamily = 'Roboto' | 'Ms Madi';
export type TextAlign = 'left' | 'center' | 'right';

/** Shared by every element: an unrotated box (top-left, size) turned clockwise about its centre. */
export interface BaseElement {
  /** Stable component id: survives edits and republishing. */
  id: string;
  /** Normalised to the tile: x, w of the width; y, h of the height. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** 0..1 */
  opacity: number;
  locked?: boolean;
}

/** A picture from the media library, trimmed to `crop` (fractions of the source). */
export interface ImageElement extends BaseElement {
  kind: 'image';
  mediaId: string;
  crop: { x: number; y: number; w: number; h: number };
}

/** Live text: rebuilt by the theme as HTML text. Sizes in document px of a 1080 px wide tile. */
export interface TextElement extends BaseElement {
  kind: 'text';
  text: string;
  font: FontFamily;
  /** 100..900 (Roboto); Ms Madi has one weight. */
  weight: number;
  size: number;
  color: string;
  align: TextAlign;
  /** Multiple of the size. */
  lineHeight: number;
  /** px */
  letterSpacing: number;
}

/** Text along a clockwise Archimedean coil; flattened (published as a picture). */
export interface SpiralElement extends BaseElement {
  kind: 'spiral';
  text: string;
  font: FontFamily;
  weight: number;
  size: number;
  color: string;
  letterSpacing: number;
  /** Coils, 1..6. */
  turns: number;
  /** Glyph scale at the centre, 0.1..1. */
  innerScale: number;
  /** Degrees. */
  rotationOffset: number;
}

/** Freehand painting made with the SKETCH brush engine; flattened. `assetId` = a full-tile transparent PNG. */
export interface PaintElement extends BaseElement {
  kind: 'paint';
  assetId: string;
}

export type TileElement = ImageElement | TextElement | SpiralElement | PaintElement;
export type ElementKind = TileElement['kind'];

/** Elements the theme rebuilds from data; the rest are published as pictures. */
export const LIVE_KINDS: readonly ElementKind[] = ['image', 'text'];

/** Where an old post came from: an ordinary WordPress post or WP Studio. */
export type Origin = 'wp' | 'wpstudio';

export interface TileDocument {
  schema: 'creative.publish.tile.v1';
  /** Stable tile id (the manifest's tileId). */
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number; background: string };
  /** Bottom → top. */
  elements: TileElement[];
  /** Tile-level meta that travels with the tile into the post meta. */
  meta: {
    caption?: string;
    /** The element chosen as the featured picture (an image, drawing or spiral). */
    featured?: string;
    /** Made from an old post: an ordinary WordPress post (red dot) or a WP Studio post (yellow dot), until republished. */
    legacy?: Origin;
  };
}

/** A picture in the media library: one file, one canonical name, reused by any number of tiles. */
export interface MediaAsset {
  id: string;
  /** e.g. `harbour-walk-03-3fa2c1.jpg` — the WordPress file name; fixed once published. */
  name: string;
  /** SHA-256 of the cleaned picture before its id was written (dedup on import). */
  hash: string;
  /** Permanent picture id, written inside the file (EXIF ImageUniqueID / PNG text). */
  uid: string;
  /** The name was chosen by hand (publishing keeps it). */
  named?: boolean;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  source: 'device' | 'wordpress';
  /** The WordPress attachment, once published or pulled. */
  wpMediaId?: number;
  wpUrl?: string;
}
