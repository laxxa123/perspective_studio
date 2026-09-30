import type { Mat3 } from '../math/mat3';
import type { Vec2, Vec3 } from '../math/vec';

export type PerspectiveMode = '3pt' | '2pt';

/** The persisted perspective system (§6.1). All values in pp unless noted. */
export interface PerspectiveSystem {
  mode: PerspectiveMode;
  horizonY: number;
  vpLeftX: number;
  vpRightX: number;
  /** x of VP-V (3pt) / of the principal point (2pt). */
  verticalX: number;
  /** y of VP-V; null in 2pt (VP-V at infinity). */
  vpVerticalY: number | null;
  /** Where the world origin (0,0,0) projects; below the horizon. */
  anchor: Vec2;
  /** Camera height above the ground, u (> 0). */
  eyeHeight: number;
}

export type Family = 'L' | 'R' | 'V';

/** The camera derived from a perspective system (§6.2). Never persisted. */
export interface Camera {
  /** Principal point, pp. */
  p: Vec2;
  /** Focal length, pp. */
  f: number;
  /** Rotation, columns x̂ ŷ ẑ: world vectors → camera coordinates. */
  M: Mat3;
  /** Camera centre in the world, u. */
  C: Vec3;
  /** Near-plane depth (camera z). */
  near: number;
}
