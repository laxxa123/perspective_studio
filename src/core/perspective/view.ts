// The eye is the stored setting (ADR-0006, PS-12…PS-14): where the single eye
// stands, where it looks (turn, tilt) and how far it is from the picture
// plane. The horizon, the centre of vision and every VP are derived from it,
// including VPs at infinity (face-on, level and top views).
import { fromColumns, mulTransposeVec } from '../math/mat3';
import { MIN_EYE_HEIGHT, NEAR_FRACTION } from '../math/tolerance';
import { sub3, v3, type Vec2, type Vec3 } from '../math/vec';
import { deriveCamera, perspectiveFromCamera, toCamera, vanishingPoint } from './camera';
import { setMode } from './edit';
import { setEyeHeight } from './eye';
import type { Camera, PerspectiveMode, PerspectiveSystem } from './types';
import { violations } from './validity';

/** The persisted eye (§6.1, schema 2). Angles in degrees. */
export interface Eye {
  /** Centre of vision: where the line of sight meets the paper, pp. */
  cv: Vec2;
  /** Viewing distance: eye to picture plane, pp (> 0). */
  distance: number;
  /**
   * Turn: the line of sight's heading, 0° = looking along +Y (the right face,
   * spanned by X, square on), 90° = along +X (the left face square on),
   * 45° = the symmetric corner view.
   */
  turn: number;
  /** Tilt: 0° = level, + looking down (90° = straight down), − looking up. */
  tilt: number;
  /** Station point: the eye in the world, u; z is the eye height. */
  position: Vec3;
}

export const TURN_MIN = 0;
export const TURN_MAX = 90;
/** Tilt range of the model; the View slider covers 0…90 (decision 4A). */
export const TILT_MIN = -85;
export const TILT_MAX = 90;

const RAD = Math.PI / 180;
/** Angles this close to a limit are snapped onto it (exact level / face-on / top). */
const ANGLE_SNAP = 1e-7;

const snapAngle = (a: number, ...to: number[]): number => {
  for (const t of to) if (Math.abs(a - t) < ANGLE_SNAP) return t;
  return a;
};

/** World → camera rotation for a turn and tilt (roll is always 0: the head is level). */
export function rotationOf(turnDeg: number, tiltDeg: number) {
  const phi = turnDeg * RAD;
  const tau = tiltDeg * RAD;
  // Exact values at the limits keep VPs exactly at infinity there.
  const sp = turnDeg === 90 ? 1 : turnDeg === 0 ? 0 : Math.sin(phi);
  const cp = turnDeg === 90 ? 0 : turnDeg === 0 ? 1 : Math.cos(phi);
  const st = tiltDeg === 90 ? 1 : tiltDeg === 0 ? 0 : Math.sin(tau);
  const ct = tiltDeg === 90 ? 0 : tiltDeg === 0 ? 1 : Math.cos(tau);
  const r = v3(cp, -sp, 0); // picture right
  const h = v3(sp, cp, 0); // heading on the ground
  const fwd = v3(ct * h.x, ct * h.y, -st); // line of sight
  const d = v3(-st * h.x, -st * h.y, -ct); // picture down
  // Columns are the world axes in camera coordinates (rows r, d, fwd).
  return fromColumns(v3(r.x, d.x, fwd.x), v3(r.y, d.y, fwd.y), v3(r.z, d.z, fwd.z));
}

export function cameraFromEye(eye: Eye): Camera {
  return {
    p: eye.cv,
    f: eye.distance,
    M: rotationOf(eye.turn, eye.tilt),
    C: eye.position,
    near: NEAR_FRACTION * Math.max(Math.abs(eye.position.z), MIN_EYE_HEIGHT),
  };
}

/** The eye of a camera (roll must be 0, as every camera of the app has). */
export function eyeFromCamera(cam: Camera): Eye {
  const r = mulTransposeVec(cam.M, v3(1, 0, 0));
  const fwd = mulTransposeVec(cam.M, v3(0, 0, 1));
  const turn = snapAngle(Math.atan2(-r.y, r.x) / RAD, TURN_MIN, TURN_MAX);
  const tilt = snapAngle(Math.asin(Math.max(-1, Math.min(1, -fwd.z))) / RAD, 0, TILT_MAX);
  return { cv: { ...cam.p }, distance: cam.f, turn, tilt, position: { ...cam.C } };
}

/** The eye of a perspective system (a 2-point system is exactly level). */
export function eyeFromPerspective(ps: PerspectiveSystem): Eye {
  const eye = eyeFromCamera(deriveCamera(ps));
  return ps.mode === '2pt' ? { ...eye, tilt: 0 } : eye;
}

/** 2-point when level, 3-point otherwise (decision 6A). */
export const modeOf = (eye: Eye): PerspectiveMode => (eye.tilt === 0 ? '2pt' : '3pt');

/**
 * The VP-handle form of the eye: a valid perspective system, or null when a
 * VP the system stores is at infinity (face-on or top views) or the world
 * origin is not in front of the eye below the horizon.
 */
export function perspectiveOf(eye: Eye): PerspectiveSystem | null {
  try {
    const ps = perspectiveFromCamera(cameraFromEye(eye), modeOf(eye));
    return violations(ps).length ? null : ps;
  } catch {
    return null;
  }
}

/** The horizon's y on the paper; null when it is at infinity (top view). */
export function horizonOf(cam: Camera): number | null {
  const vR = vanishingPoint(cam, 'R');
  const vL = vanishingPoint(cam, 'L');
  const v = vR.w !== 0 ? vR : vL.w !== 0 ? vL : null;
  return v ? v.y / v.w : null;
}

const finiteVec = (...n: number[]) => n.every(Number.isFinite);

export function eyeViolations(eye: Eye): string[] {
  const out: string[] = [];
  const { cv, position: c } = eye;
  if (!finiteVec(cv.x, cv.y, eye.distance, eye.turn, eye.tilt, c.x, c.y, c.z)) return ['NaN'];
  if (!(eye.distance > 0)) out.push('distance');
  if (eye.turn < TURN_MIN || eye.turn > TURN_MAX) out.push('turn');
  if (eye.tilt < TILT_MIN || eye.tilt > TILT_MAX) out.push('tilt');
  if (!(c.z >= MIN_EYE_HEIGHT)) out.push('eye height');
  return out;
}

export const isValidEye = (eye: Eye): boolean => eyeViolations(eye).length === 0;

/** The nearest valid eye (finite input only). */
export function clampEye(eye: Eye): Eye {
  if (eyeViolations(eye).includes('NaN')) throw new Error('clampEye: non-finite values');
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  return {
    cv: eye.cv,
    distance: eye.distance > 0 ? eye.distance : 1,
    turn: clamp(eye.turn, TURN_MIN, TURN_MAX),
    tilt: clamp(eye.tilt, TILT_MIN, TILT_MAX),
    position: { ...eye.position, z: Math.max(eye.position.z, MIN_EYE_HEIGHT) },
  };
}

/**
 * Orbit (PS-13): the eye walks around `pivot` to a new turn and tilt, keeping
 * the pivot where it is on the paper at the same depth — so the viewing
 * distance and the size stay steady and the eye height changes. Null when the
 * pivot is not in front of the eye or the eye would go below the floor.
 */
export function orbit(base: Eye, pivot: Vec3, turn: number, tilt: number): Eye | null {
  const cam = cameraFromEye(base);
  const Pc = toCamera(cam, pivot);
  if (!(Pc.z > cam.near)) return null;
  const t = Math.min(TURN_MAX, Math.max(TURN_MIN, turn));
  const k = Math.min(TILT_MAX, Math.max(TILT_MIN, tilt));
  const C = sub3(pivot, mulTransposeVec(rotationOf(t, k), Pc));
  if (!(C.z >= MIN_EYE_HEIGHT)) return null;
  return { ...base, turn: t, tilt: k, position: C };
}

/** The eye's horizontal distance to the world origin, u. */
export const eyeOriginDistance = (eye: Eye): number => Math.hypot(eye.position.x, eye.position.y);

/** Tilt the 3-point button gives a level eye that has no VP-handle form, degrees. */
const DEFAULT_TILT = 20;

/**
 * The 2-pt / 3-pt switch (§6.4, decision 6A): through the VP-handle form when
 * there is one; otherwise an orbit about the ground point to level / 20° down.
 */
export function setEyeMode(eye: Eye, mode: PerspectiveMode): Eye {
  if (modeOf(eye) === mode) return eye;
  const ps = perspectiveOf(eye);
  if (ps) return eyeFromPerspective(setMode(ps, mode));
  return orbit(eye, v3(0, 0, 0), eye.turn, mode === '2pt' ? 0 : DEFAULT_TILT) ?? eye;
}

/**
 * PS-07: the eye height. With a VP-handle form it moves the horizon (ADR-0005);
 * in face-on or top views the eye simply rises or sinks.
 */
export function withEyeHeight(eye: Eye, height: number): Eye {
  const ps = perspectiveOf(eye);
  if (ps) return eyeFromPerspective(setEyeHeight(ps, height));
  return { ...eye, position: { ...eye.position, z: Math.max(height, MIN_EYE_HEIGHT) } };
}
