// Validity constraints PV-1…PV-5 and their deterministic repair (§6.3).
import {
  ANCHOR_MARGIN_PP,
  MIN_EYE_HEIGHT,
  MIN_SPREAD_PP,
  PV1_MARGIN_FRACTION,
  PV2_EPSILON,
} from '../math/tolerance';
import type { PerspectiveSystem } from './types';

export type Violation = 'PV-1' | 'PV-2' | 'PV-3' | 'PV-4' | 'PV-5' | 'NaN';

const allFinite = (ps: PerspectiveSystem): boolean =>
  [ps.horizonY, ps.vpLeftX, ps.vpRightX, ps.verticalX, ps.anchor.x, ps.anchor.y, ps.eyeHeight].every(
    Number.isFinite,
  ) && (ps.vpVerticalY === null || Number.isFinite(ps.vpVerticalY));

/** a = (xV − xL)·(xR − xV) of §6.2. */
export const spreadProduct = (ps: PerspectiveSystem): number =>
  (ps.verticalX - ps.vpLeftX) * (ps.vpRightX - ps.verticalX);

/** Smallest |yV − h| that PV-2 allows for this system's a. */
export const minVerticalDistance = (ps: PerspectiveSystem): number =>
  Math.sqrt(Math.max(spreadProduct(ps), 0) * (1 + PV2_EPSILON));

export function violations(ps: PerspectiveSystem): Violation[] {
  if (!allFinite(ps)) return ['NaN'];
  const out: Violation[] = [];
  const spread = ps.vpRightX - ps.vpLeftX;
  const margin = spread * PV1_MARGIN_FRACTION;
  if (!(ps.vpLeftX + margin <= ps.verticalX && ps.verticalX <= ps.vpRightX - margin)) out.push('PV-1');
  if (ps.mode === '3pt') {
    const d = ps.vpVerticalY === null ? NaN : ps.vpVerticalY - ps.horizonY;
    if (!(d * d > spreadProduct(ps) * (1 + PV2_EPSILON))) out.push('PV-2');
  } else if (ps.vpVerticalY !== null) {
    out.push('PV-2');
  }
  if (!(spread >= MIN_SPREAD_PP)) out.push('PV-3');
  if (!(ps.anchor.y >= ps.horizonY + ANCHOR_MARGIN_PP)) out.push('PV-4');
  if (!(ps.eyeHeight >= MIN_EYE_HEIGHT)) out.push('PV-5');
  return out;
}

export const isValid = (ps: PerspectiveSystem): boolean => violations(ps).length === 0;

/**
 * The nearest valid system to `ps` (§6.3): a valid system is returned
 * unchanged; otherwise each constraint is repaired in order — spread (PV-3),
 * VP-V's x (PV-1), VP-V's distance from the horizon keeping its side (PV-2),
 * the anchor (PV-4), the eye height (PV-5). Non-finite input is rejected.
 */
export function clampPerspective(ps: PerspectiveSystem): PerspectiveSystem {
  if (!allFinite(ps)) throw new Error('clampPerspective: non-finite values');
  if (isValid(ps)) return ps;
  let { vpLeftX, vpRightX, verticalX, vpVerticalY } = ps;
  const { horizonY } = ps;

  // Tiny growth factors keep repaired values strictly inside the constraints
  // despite rounding.
  if (vpRightX - vpLeftX < MIN_SPREAD_PP) {
    const mid = (vpLeftX + vpRightX) / 2;
    vpLeftX = mid - (MIN_SPREAD_PP / 2) * (1 + 1e-9);
    vpRightX = mid + (MIN_SPREAD_PP / 2) * (1 + 1e-9);
  }
  const margin = (vpRightX - vpLeftX) * PV1_MARGIN_FRACTION * (1 + 1e-9);
  verticalX = Math.min(Math.max(verticalX, vpLeftX + margin), vpRightX - margin);

  if (ps.mode === '2pt') {
    vpVerticalY = null;
  } else {
    const minD = minVerticalDistance({ ...ps, vpLeftX, vpRightX, verticalX }) * (1 + 1e-9);
    const d = vpVerticalY === null ? minD : vpVerticalY - horizonY;
    // Below the horizon (d ≥ 0) stays below; above stays above.
    vpVerticalY = Math.abs(d) >= minD ? horizonY + d : horizonY + (d < 0 ? -minD : minD);
  }

  const anchor =
    ps.anchor.y >= horizonY + ANCHOR_MARGIN_PP
      ? ps.anchor
      : { x: ps.anchor.x, y: horizonY + ANCHOR_MARGIN_PP * (1 + 1e-9) };
  const eyeHeight = ps.eyeHeight >= MIN_EYE_HEIGHT ? ps.eyeHeight : MIN_EYE_HEIGHT;

  return { ...ps, vpLeftX, vpRightX, verticalX, vpVerticalY, anchor, eyeHeight };
}
