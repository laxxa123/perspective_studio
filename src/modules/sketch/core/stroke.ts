// Stroke sampling (SKETCH §7): input buffer → smoothing → interpolation →
// brush dynamics → evenly spaced dabs. Pure: no DOM, no GL.
import type { BrushPreset, Dab, InputPoint } from './types';

export interface StrokeOptions {
  /** Quick-size multiplier (SKETCH §8). */
  sizeScale: number;
}

interface Sample extends InputPoint {
  /** Smoothed speed, px / ms. */
  v: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mid = (a: Sample, b: Sample): Sample => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  pressure: (a.pressure + b.pressure) / 2,
  tilt: (a.tilt + b.tilt) / 2,
  azimuth: b.azimuth,
  t: (a.t + b.t) / 2,
  v: (a.v + b.v) / 2,
});

/** Brush dynamics: pressure, velocity and tilt → one dab (SKETCH §7). */
export function dabAt(p: BrushPreset, o: StrokeOptions, s: Sample, direction: number): Dab {
  const pressure = Math.min(1, Math.max(0, s.pressure));
  let size = p.size * o.sizeScale * (1 - p.pressureSize + p.pressureSize * pressure);
  let alpha = p.flow * (1 - p.pressureOpacity + p.pressureOpacity * pressure);
  if (p.velocity) size *= 1 + p.velocity * Math.min(1, s.v / 2.5) * 0.6;
  if (p.tilt && s.tilt > 0) {
    size *= 1 + p.tilt * s.tilt * 1.5;
    alpha *= 1 - p.tilt * s.tilt * 0.4;
  }
  let angle = (p.rotation * Math.PI) / 180;
  if (p.followStroke) angle += direction;
  else if (p.tilt && s.tilt > 0.05) angle = s.azimuth;
  const roundness = p.tilt && s.tilt > 0.05 ? Math.max(0.25, p.roundness * (1 - 0.6 * p.tilt * s.tilt)) : p.roundness;
  return { x: s.x, y: s.y, size: Math.max(0.6, size), alpha: Math.min(1, Math.max(0, alpha)), angle, roundness, hardness: p.hardness };
}

/**
 * Turns pointer samples into dabs. Smoothing pulls a "lazy" point toward the
 * pen (exponential); quadratic curves through the midpoints of the smoothed
 * points give a continuous path; dabs are placed every `spacing × size` along it.
 */
export class StrokeBuilder {
  private raw: InputPoint | null = null;
  private smooth: Sample | null = null;
  private pts: Sample[] = [];
  private residual = 0;
  private lastDab: Dab | null = null;
  private dir = 0;
  readonly bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  dabCount = 0;

  constructor(
    private preset: BrushPreset,
    private opts: StrokeOptions,
  ) {}

  private follow(p: InputPoint): Sample {
    const prev = this.raw;
    const dt = prev ? Math.max(1, p.t - prev.t) : 16;
    const speed = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) / dt : 0;
    this.raw = p;
    const k = 1 - Math.min(0.92, this.preset.smoothing * 0.92);
    const s = this.smooth;
    const next: Sample = s
      ? {
          x: lerp(s.x, p.x, k),
          y: lerp(s.y, p.y, k),
          pressure: lerp(s.pressure, p.pressure, Math.max(k, 0.35)),
          tilt: lerp(s.tilt, p.tilt, 0.5),
          azimuth: p.azimuth,
          t: p.t,
          v: lerp(s.v, speed, 0.3),
        }
      : { ...p, v: 0 };
    this.smooth = next;
    return next;
  }

  private emit(d: Dab, out: Dab[]) {
    out.push(d);
    this.lastDab = d;
    this.dabCount++;
    const r = d.size / 2 + 2;
    const b = this.bounds;
    b.x0 = Math.min(b.x0, d.x - r);
    b.y0 = Math.min(b.y0, d.y - r);
    b.x1 = Math.max(b.x1, d.x + r);
    b.y1 = Math.max(b.y1, d.y + r);
  }

  /** Walks a quadratic segment a → b with control c, placing dabs at even spacing. */
  private walk(a: Sample, c: Sample, b: Sample, out: Dab[]) {
    const est = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
    if (est < 1e-6) return;
    const steps = Math.max(2, Math.ceil(est / 0.5));
    let px = a.x;
    let py = a.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
      const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      let seg = Math.hypot(x - px, y - py);
      if (seg > 1e-9) this.dir = Math.atan2(y - py, x - px);
      let sx = px;
      let sy = py;
      while (seg > 0) {
        const sample: Sample = { x, y, pressure: lerp(a.pressure, b.pressure, t), tilt: lerp(a.tilt, b.tilt, t), azimuth: b.azimuth, t: lerp(a.t, b.t, t), v: lerp(a.v, b.v, t) };
        const size = dabAt(this.preset, this.opts, sample, this.dir).size;
        const step = Math.max(0.5, size * this.preset.spacing);
        const need = step - this.residual;
        if (seg < need) {
          this.residual += seg;
          break;
        }
        const f = need / seg;
        sx += (x - sx) * f;
        sy += (y - sy) * f;
        seg -= need;
        this.residual = 0;
        this.emit(dabAt(this.preset, this.opts, { ...sample, x: sx, y: sy }, this.dir), out);
      }
      px = x;
      py = y;
    }
  }

  /** Adds pointer samples; returns the dabs they produce. */
  add(points: InputPoint[]): Dab[] {
    const out: Dab[] = [];
    for (const p of points) {
      const s = this.follow(p);
      if (!this.pts.length) {
        this.pts.push(s);
        // A tap leaves a mark.
        this.emit(dabAt(this.preset, this.opts, s, 0), out);
        continue;
      }
      const last = this.pts[this.pts.length - 1];
      if (Math.hypot(s.x - last.x, s.y - last.y) < 0.25) continue;
      this.pts.push(s);
      const n = this.pts.length;
      if (n === 2) this.walk(this.pts[0], this.pts[0], mid(this.pts[0], this.pts[1]), out);
      else this.walk(mid(this.pts[n - 3], this.pts[n - 2]), this.pts[n - 2], mid(this.pts[n - 2], this.pts[n - 1]), out);
      if (n > 4) this.pts.splice(0, n - 4);
    }
    return out;
  }

  /** Finishes the stroke: the path catches up with the pen's last position. */
  end(): Dab[] {
    const out: Dab[] = [];
    const n = this.pts.length;
    if (n >= 2) {
      const last = this.pts[n - 1];
      const target: Sample = this.raw ? { ...last, x: this.raw.x, y: this.raw.y } : last;
      this.walk(mid(this.pts[n - 2], last), last, target, out);
    }
    return out;
  }

  /** The last dab placed (airbrush keeps spraying there while the pen rests). */
  get current(): Dab | null {
    return this.lastDab;
  }
}
