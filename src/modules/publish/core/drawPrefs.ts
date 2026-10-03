// Drawing settings (PUBLISH §6.5): brush, size, opacity, colour, the five
// recent colours and the one-tap eraser, which keeps its own size and
// returns to the last brush. Remembered between drawings. Pure.
import { defaultFive } from '../../sketch/core/presets';
import { normHex, pushRecent } from './colour';

export interface DrawPrefs {
  preset: string;
  /** Size level 0..4 of the current tool. */
  size: number;
  /** Opacity level 0..4. */
  opacity: number;
  color: string;
  /** The five colours in the brush sheet, most recent first. */
  recent: string[];
  /** The brush to go back to from the eraser, and its size. */
  lastBrush: string;
  brushSize: number;
  eraserSize: number;
  /** The tile's text and pictures shown faintly under the drawing. */
  showTile: boolean;
  grid: boolean;
}

export const ERASER = 'eraser';
export const RECENT = 5;
/** The default colours (as SKETCH's) with the starting ink. */
const STARTER = defaultFive('#111111');

export const defaultPrefs = (): DrawPrefs => ({ preset: 'pen', size: 2, opacity: 4, color: '#111111', recent: [...STARTER], lastBrush: 'pen', brushSize: 2, eraserSize: 3, showTile: true, grid: false });

const level = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4 ? v : d);

/** Saved settings, checked; anything unusable falls back to the default. */
export function readPrefs(raw: unknown, presets: readonly string[]): DrawPrefs {
  const d = defaultPrefs();
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof DrawPrefs, unknown>>;
  const preset = typeof o.preset === 'string' && presets.includes(o.preset) ? o.preset : d.preset;
  const lastBrush = typeof o.lastBrush === 'string' && presets.includes(o.lastBrush) && o.lastBrush !== ERASER ? o.lastBrush : d.lastBrush;
  const recent = Array.isArray(o.recent) ? o.recent.flatMap((c) => (typeof c === 'string' && normHex(c) ? [normHex(c)!] : [])).slice(0, RECENT) : [];
  return {
    preset,
    size: level(o.size, d.size),
    opacity: level(o.opacity, d.opacity),
    color: (typeof o.color === 'string' && normHex(o.color)) || d.color,
    recent: recent.length ? [...recent, ...STARTER.filter((c) => !recent.includes(c))].slice(0, RECENT) : d.recent,
    lastBrush,
    brushSize: level(o.brushSize, d.brushSize),
    eraserSize: level(o.eraserSize, d.eraserSize),
    showTile: typeof o.showTile === 'boolean' ? o.showTile : d.showTile,
    grid: typeof o.grid === 'boolean' ? o.grid : d.grid,
  };
}

export const erasing = (p: DrawPrefs) => p.preset === ERASER;

/** The eraser button: on → eraser with its own size; off → back to the last brush and its size. */
export function toggleEraser(p: DrawPrefs): DrawPrefs {
  return erasing(p) ? { ...p, preset: p.lastBrush, eraserSize: p.size, size: p.brushSize } : { ...p, lastBrush: p.preset, brushSize: p.size, preset: ERASER, size: p.eraserSize };
}

/** Choosing a brush leaves the eraser (keeping the eraser's size). */
export function chooseBrush(p: DrawPrefs, id: string): DrawPrefs {
  const base = erasing(p) ? toggleEraser(p) : p;
  return { ...base, preset: id, lastBrush: id };
}

/** Choosing a colour means drawing with it: it joins the recent five and leaves the eraser. */
/** Tap on "Colour": the five colours go back to the defaults (the current colour stays). */
export function defaultColours(p: DrawPrefs): DrawPrefs {
  return { ...p, recent: defaultFive(p.color) };
}

export function chooseColour(p: DrawPrefs, c: string): DrawPrefs {
  const color = normHex(c) ?? p.color;
  const base = erasing(p) ? toggleEraser(p) : p;
  return { ...base, color, recent: pushRecent(base.recent, color, RECENT) };
}
