// Small statistics helpers for the M0 spike (ADR-0002).

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

export const fmt = (v: number, digits = 1): string => (Number.isFinite(v) ? v.toFixed(digits) : '—');

/** Frames per second and frame-time percentiles from rAF timestamps. */
export function frameStats(times: readonly number[]) {
  const deltas = times.slice(1).map((t, i) => t - times[i]);
  const total = times.length > 1 ? times[times.length - 1] - times[0] : 0;
  return {
    fps: total > 0 ? (deltas.length * 1000) / total : NaN,
    p50: percentile(deltas, 50),
    p95: percentile(deltas, 95),
    worst: deltas.length ? Math.max(...deltas) : NaN,
  };
}
