// The style controls' values (PUBLISH §6.1): the few choices that matter,
// soft snapping for sliders, and the two-finger gestures on a selected text
// or spiral. Pure.

/** Text sizes (px of the 1080 px tile). */
export const TEXT_SIZES = [50, 100, 150, 200, 300] as const;
/** Weights offered (Roboto). */
export const WEIGHTS = [100, 500, 900] as const;
/** Spiral letter size, soft-snapping to 5. */
export const SPIRAL_SIZE = { min: 25, max: 100, step: 5 } as const;
export const COILS = [1, 2, 3, 4, 5] as const;
/** Centre size, % of the outer letters. */
export const CENTRE = { min: 50, max: 100, step: 5 } as const;
export const TURN = { min: 0, max: 360, step: 45 } as const;
export const SPACING = { min: -5, max: 20, step: 5 } as const;
export const OPACITY = { min: 5, max: 100, step: 5 } as const;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Pulls a value onto the nearest multiple of `step` when within `tol` of it (a soft snap: keep sliding to break free). */
export function softSnap(v: number, step: number, tol = step * 0.2, origin = 0): number {
  const k = Math.round((v - origin) / step) * step + origin;
  return Math.abs(v - k) <= tol ? k : v;
}

/** The nearest of a set of levels. */
export const nearest = (v: number, levels: readonly number[]) => levels.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/** Two touch points → distance and angle (degrees). */
export function span(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { d: Math.hypot(b.x - a.x, b.y - a.y), a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

/** The turn between two angles, in (-180, 180]. */
export function turnBetween(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Angles in 0..360. */
export const wrap360 = (a: number) => ((a % 360) + 360) % 360;

/** A pinch / twist applied to a spiral: letter size and coil turn. */
export function spiralGesture(base: { size: number; rotationOffset: number }, scale: number, twist: number) {
  const size = clamp(softSnap(base.size * scale, SPIRAL_SIZE.step, 1.5), SPIRAL_SIZE.min, SPIRAL_SIZE.max);
  return { size: Math.round(size * 10) / 10, rotationOffset: Math.round(softSnap(wrap360(base.rotationOffset + twist), TURN.step, 4)) % 360 };
}

/** A pinch / twist applied to text: its size (to the nearest offered size on release) and the box's turn. */
export function textGesture(base: { size: number; rotation: number }, scale: number, twist: number, final: boolean) {
  const raw = clamp(base.size * scale, TEXT_SIZES[0], TEXT_SIZES[TEXT_SIZES.length - 1]);
  const turn = softSnap(base.rotation + twist, 90, 4);
  return { size: final ? nearest(raw, TEXT_SIZES) : Math.round(raw), rotation: Math.round(((turn + 540) % 360) - 180) };
}
