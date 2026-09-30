// Every numeric tolerance of the app lives here (REQUIREMENTS §6.6).

/** Below this, a denominator or length is treated as zero. */
export const EPS = 1e-12;

/** PS-T1: VP-to-edge-line distance, relative to the coordinate scale. */
export const TOL_VP_INCIDENCE = 1e-6;
/** PS-T2: orthonormality of the camera rotation. */
export const TOL_ORTHONORMAL = 1e-12;
/** PS-T3 / PS-T4 / PS-T5: round trips, relative to the coordinate scale. */
export const TOL_ROUND_TRIP = 1e-9;

/** PV-2: VP-V must satisfy (yV − h)² > a · (1 + PV2_EPSILON). */
export const PV2_EPSILON = 0.05;
/** PV-1: VP-V's x keeps at least this fraction of the VP spread from VP-L / VP-R. */
export const PV1_MARGIN_FRACTION = 0.01;
/** PV-3: minimum distance between VP-L and VP-R, pp. */
export const MIN_SPREAD_PP = 50;
/** PV-4: the anchor stays at least this far below the horizon, pp. */
export const ANCHOR_MARGIN_PP = 4;
/** PV-5: smallest eye height, u. */
export const MIN_EYE_HEIGHT = 1e-3;

/** Near plane, as a fraction of the eye height (§6.2 NEAR = 1e-6 · scale). */
export const NEAR_FRACTION = 1e-6;

/** Tolerance scaled by the magnitude of the numbers involved. */
export const scaled = (tol: number, ...magnitudes: number[]): number =>
  tol * Math.max(1, ...magnitudes.map(Math.abs));
