import type { PerspectiveSystem } from './types';

/** Default 3-point system (OD-3; eye height tuned so a 1 u cube is ≈ 15% of the paper width). */
export const DEFAULT_PERSPECTIVE: PerspectiveSystem = {
  mode: '3pt',
  horizonY: 280,
  vpLeftX: -700,
  vpRightX: 1900,
  verticalX: 600,
  vpVerticalY: 3200,
  anchor: { x: 600, y: 600 },
  eyeHeight: 2.2,
};
