// Eye level and scale edits (PS-07, PS-08, PS-09, PS-10, ADR-0005).
import { mulTransposeVec } from '../math/mat3';
import { ANCHOR_MARGIN_PP, MIN_EYE_HEIGHT } from '../math/tolerance';
import { dist2, v3, type Vec2, type Vec3 } from '../math/vec';
import { deriveCamera, project } from './camera';
import type { Camera, PerspectiveSystem } from './types';
import { isValid } from './validity';

/** The camera's horizontal distance to the world origin, u. */
export const originDistance = (cam: Camera): number => Math.hypot(cam.C.x, cam.C.y);

/**
 * PS-08: the horizon is the eye level. Moving it by Δ moves VP-L, VP-R and
 * (3pt) VP-V by Δ, so the rotation and focal length are unchanged; the anchor
 * stays pinned and the camera keeps its horizontal distance to the origin;
 * the eye height is re-derived. The result may be invalid (anchor at or above
 * the new horizon, eye below the floor limit): callers check validity.
 */
export function moveHorizon(ps: PerspectiveSystem, horizonY: number): PerspectiveSystem {
  const cam = deriveCamera(ps);
  const d = horizonY - ps.horizonY;
  const moved: PerspectiveSystem = {
    ...ps,
    horizonY,
    vpVerticalY: ps.vpVerticalY === null ? null : ps.vpVerticalY + d,
  };
  const r = mulTransposeVec(cam.M, v3(ps.anchor.x - cam.p.x, ps.anchor.y - (cam.p.y + d), cam.f));
  const horizontal = Math.hypot(r.x, r.y);
  const eyeHeight = r.z < 0 && horizontal > 0 ? (originDistance(cam) * -r.z) / horizontal : NaN;
  return { ...moved, eyeHeight };
}

const eyeAt = (ps: PerspectiveSystem, horizonY: number): number => {
  const m = moveHorizon(ps, horizonY);
  return isValid(m) ? m.eyeHeight : NaN;
};

/**
 * PS-07: setting the eye height moves the horizon (the same operation as
 * PS-08, solved for the horizon). Clamped to the reachable range.
 */
export function setEyeHeight(ps: PerspectiveSystem, target: number): PerspectiveSystem {
  const goal = Math.max(target, MIN_EYE_HEIGHT);
  // Eye height falls as the horizon moves down toward the anchor.
  const lowest = ps.anchor.y - ANCHOR_MARGIN_PP * 1.5;
  let hi = lowest; // low eye
  if (!(eyeAt(ps, hi) <= goal)) hi = ps.horizonY;
  let lo = ps.horizonY;
  let step = Math.max(50, Math.abs(ps.vpRightX - ps.vpLeftX) * 0.05);
  for (let i = 0; i < 60 && !(eyeAt(ps, lo) >= goal); i++) {
    lo -= step;
    step *= 2;
  }
  if (!(eyeAt(ps, lo) >= goal)) return ps;
  if (!(eyeAt(ps, hi) <= goal)) return moveHorizon(ps, hi);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (eyeAt(ps, mid) >= goal) lo = mid;
    else hi = mid;
  }
  const out = moveHorizon(ps, lo);
  return isValid(out) ? out : ps;
}

/**
 * The scale reference (PS-09): mean paper length of the three 1 u edges from
 * the origin (X, Y, Z). The vertical edge alone would not do: its length is
 * fixed by the anchor, the horizon (= eye height) and VP-V, so it never
 * changes when VP-L or VP-R move — the widths do.
 */
export function unitLengthAtOrigin(ps: PerspectiveSystem): number {
  const cam = deriveCamera(ps);
  const o = project(cam, v3(0, 0, 0));
  const ends = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((P) => project(cam, P));
  if (!o || ends.some((e) => !e)) return NaN;
  return ends.reduce((sum, e) => sum + dist2(o, e!), 0) / 3;
}

/**
 * PS-09 scale lock: adjusts the eye height (horizon unchanged, i.e. the camera
 * slides along the anchor ray) so the 1 u reference keeps paper length `target`.
 */
export function withScaleLock(ps: PerspectiveSystem, target: number): PerspectiveSystem {
  if (!(target > 0)) return ps;
  let out = ps;
  for (let i = 0; i < 8; i++) {
    const len = unitLengthAtOrigin(out);
    if (!(len > 0)) return ps;
    const next = { ...out, eyeHeight: Math.max(MIN_EYE_HEIGHT, (out.eyeHeight * len) / target) };
    if (!isValid(next)) return out;
    out = next;
    if (Math.abs(len - target) < 1e-6 * target) break;
  }
  return out;
}

/**
 * PS-10 pin: moves the anchor so world point P projects to paper point `q`
 * (keeps the selected object in place while VPs move). Returns `ps` unchanged
 * when that is not reachable.
 */
export function pinWorldPoint(ps: PerspectiveSystem, P: Vec3, q: Vec2): PerspectiveSystem {
  let out = ps;
  for (let i = 0; i < 12; i++) {
    const at = project(deriveCamera(out), P);
    if (!at) return ps;
    const dx = q.x - at.x;
    const dy = q.y - at.y;
    if (Math.hypot(dx, dy) < 1e-6) break;
    const next = { ...out, anchor: { x: out.anchor.x + dx, y: out.anchor.y + dy } };
    if (!isValid(next)) return out;
    out = next;
  }
  return out;
}
