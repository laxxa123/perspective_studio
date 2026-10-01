// Drawing gestures → semantic artwork elements (CUBE §13, §14, §18). Points
// are face-local (they may run past the face; crossing a fold makes a pattern).
import type { ArtworkElement } from '../model/CubeModel';
import { stampById } from '../model/Stamps';
import { uid } from '../model/ids';
import type { ShapeKind, Style } from '../state/useCubeStore';

type P = { x: number; y: number };

/** Snaps a direction to multiples of 45° when close (lines, arrows). */
export function snapAngle(a: P, b: P): P {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  if (Math.abs(snapped - ang) > (6 * Math.PI) / 180) return b;
  return { x: a.x + len * Math.cos(snapped), y: a.y + len * Math.sin(snapped) };
}

const f = (n: number) => String(Math.round(n * 10000) / 10000);
const base = (style: Style, w: number, h: number, c: P): Omit<ArtworkElement, 'kind'> => ({
  id: uid('el'),
  transform: { x: c.x, y: c.y, rotation: 0, scaleX: 1, scaleY: 1 },
  w: Math.max(w, 0.02),
  h: Math.max(h, 0.02),
  opacity: 1,
  stroke: style.stroke,
  strokeWidth: style.width,
});

/** A freehand stroke from face-local points. */
export function penElement(points: P[], style: Style): ArtworkElement | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${f(p.x - c.x)} ${f(p.y - c.y)}`).join(' ');
  return { ...base(style, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), c), kind: 'path', origin: 'pen', path: d, fill: null };
}

/** A drag-drawn shape (line, arrow, rectangle, ellipse, regular polygon). */
export function shapeElement(tool: ShapeKind, a: P, b0: P, style: Style): ArtworkElement | null {
  const b = tool === 'line' || tool === 'arrow' ? snapAngle(a, b0) : b0;
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  if (Math.hypot(w, h) < 0.03) return null;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const hw = w / 2;
  const hh = h / 2;
  switch (tool) {
    case 'line':
      return { ...base(style, w, h, c), kind: 'path', origin: 'line', path: `M ${f(a.x - c.x)} ${f(a.y - c.y)} L ${f(b.x - c.x)} ${f(b.y - c.y)}`, fill: null };
    case 'arrow': {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = Math.min(0.15, Math.hypot(w, h) * 0.35);
      const l = { x: b.x - head * Math.cos(ang - 0.45), y: b.y - head * Math.sin(ang - 0.45) };
      const r = { x: b.x - head * Math.cos(ang + 0.45), y: b.y - head * Math.sin(ang + 0.45) };
      const d = `M ${f(a.x - c.x)} ${f(a.y - c.y)} L ${f(b.x - c.x)} ${f(b.y - c.y)} M ${f(l.x - c.x)} ${f(l.y - c.y)} L ${f(b.x - c.x)} ${f(b.y - c.y)} L ${f(r.x - c.x)} ${f(r.y - c.y)}`;
      return { ...base(style, w, h, c), kind: 'path', origin: 'arrow', path: d, fill: null };
    }
    case 'rect':
      return { ...base(style, w, h, c), kind: 'path', origin: 'rect', path: `M ${f(-hw)} ${f(-hh)} L ${f(hw)} ${f(-hh)} L ${f(hw)} ${f(hh)} L ${f(-hw)} ${f(hh)} Z`, fill: style.fill };
    case 'ellipse':
      return { ...base(style, w, h, c), kind: 'path', origin: 'ellipse', path: `M ${f(-hw)} 0 A ${f(hw)} ${f(hh)} 0 1 0 ${f(hw)} 0 A ${f(hw)} ${f(hh)} 0 1 0 ${f(-hw)} 0 Z`, fill: style.fill };
    case 'polygon': {
      const n = Math.max(3, Math.min(8, style.sides));
      const pts = Array.from({ length: n }, (_, i) => {
        const t = (2 * Math.PI * i) / n - Math.PI / 2;
        return `${f(hw * Math.cos(t))} ${f(hh * Math.sin(t))}`;
      });
      return { ...base(style, w, h, c), kind: 'path', origin: 'polygon', path: `M ${pts.join(' L ')} Z`, fill: style.fill };
    }
  }
}

/** A stamp from the library, centred on a face point. */
export function stampElement(stampId: string, at: P, style: Style, size = 0.4): ArtworkElement | null {
  const s = stampById(stampId);
  if (!s) return null;
  // Stamp paths are in a unit box; scale them to `size`.
  return {
    id: uid('el'),
    kind: 'stamp',
    stamp: s.id,
    origin: 'stamp',
    path: s.path,
    transform: { x: at.x, y: at.y, rotation: 0, scaleX: size, scaleY: size },
    w: 1,
    h: 1,
    opacity: 1,
    fill: s.filled ? style.fill : null,
    stroke: s.filled ? null : style.stroke,
    strokeWidth: style.width / size,
  };
}

export function textElement(text: string, at: P, style: Style, size = 0.45): ArtworkElement {
  return {
    id: uid('el'),
    kind: 'text',
    text,
    fontSize: size,
    transform: { x: at.x, y: at.y, rotation: 0, scaleX: 1, scaleY: 1 },
    w: Math.max(size * 0.7 * Math.max(1, text.length), 0.1),
    h: size,
    opacity: 1,
    fill: style.fill,
  };
}

export function imageElement(assetId: string, aspect: number, at: P = { x: 0.5, y: 0.5 }, size = 0.8): ArtworkElement {
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  return { id: uid('el'), kind: 'image', assetId, transform: { x: at.x, y: at.y, rotation: 0, scaleX: 1, scaleY: 1 }, w, h, opacity: 1 };
}
