import type { Vec2 } from '../math/geometry';

/** Horizon + the three vanishing points of a three-point perspective scene. */
export interface PerspectiveSetup {
  /** Horizon line height in canvas units (y). */
  horizonY: number;
  /** Left and right vanishing points; both lie on the horizon. */
  vpLeft: Vec2;
  vpRight: Vec2;
  /** Third (vertical) vanishing point, above or below the horizon. */
  vpVertical: Vec2;
}

export function defaultSetup(width: number, height: number): PerspectiveSetup {
  const horizonY = height * 0.4;
  return {
    horizonY,
    vpLeft: { x: width * 0.1, y: horizonY },
    vpRight: { x: width * 0.9, y: horizonY },
    vpVertical: { x: width * 0.5, y: height * 1.6 },
  };
}

/** Moving the horizon carries both horizon vanishing points with it. */
export function withHorizon(setup: PerspectiveSetup, horizonY: number): PerspectiveSetup {
  return {
    ...setup,
    horizonY,
    vpLeft: { ...setup.vpLeft, y: horizonY },
    vpRight: { ...setup.vpRight, y: horizonY },
  };
}
