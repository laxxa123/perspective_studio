// Colour conversions for the colour picker (PUBLISH §6.6). Pure.

export interface Hsv {
  /** 0..360 */
  h: number;
  /** 0..1 */
  s: number;
  /** 0..1 */
  v: number;
}

/** `#rgb` / `#rrggbb` (any case) → `#rrggbb`, or null. */
export function normHex(v: string): string | null {
  const m = v.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

export function hexToHsv(hex: string): Hsv {
  const n = normHex(hex) ?? '#000000';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Adds a colour to the front of a recent list (no repeats, at most `keep`). */
export const pushRecent = (list: string[], c: string, keep = 6) => [c, ...list.filter((x) => x !== c)].slice(0, keep);

/** `rgba()` for a hex colour at an alpha (0..1). */
export function withAlpha(hex: string, a: number): string {
  const n = normHex(hex) ?? '#000000';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}
