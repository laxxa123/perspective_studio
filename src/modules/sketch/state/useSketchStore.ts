// SKETCH UI state (zustand). The artwork lives in the engine; this mirrors
// only what the UI shows (document, history flags) plus brush choices.
import { create } from 'zustand';
import { defaultFive, OPACITY_LEVELS, SIZE_LEVELS } from '../core/presets';
import type { BrushPreset, GridType, SketchDocument } from '../core/types';
import type { InputMode } from '../input/PointerInput';
import { loadSettings, saveSettings, type SketchSettings } from './settings';

export type SketchPage = 'gallery' | 'editor' | 'settings';
export type Panel = 'none' | 'brush' | 'color' | 'layers' | 'grid' | 'more' | 'reference';

interface SketchState {
  page: SketchPage;
  /** Where Settings returns to. */
  back: SketchPage;
  projectId: string | null;
  /** Mirror of the engine's document. */
  doc: SketchDocument | null;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  floating: boolean;
  panel: Panel;
  mode: InputMode;
  /** A stroke is in progress (the controls stay put). */
  drawing: boolean;
  /** The eyedropper is waiting for a touch on the canvas. */
  picking: boolean;
  toast: string | null;
  saving: boolean;
  presetId: string;
  sizeLevel: number;
  opacityLevel: number;
  color: string;
  recent: string[];
  /** The one-tap eraser returns to this brush and its size; it keeps its own size. */
  lastBrush: string;
  brushSize: number;
  eraserSize: number;
  /** Soft snap to the grid's dots (SKETCH §13). */
  snap: boolean;
  /** The grid the grid button turns on. */
  lastGrid: Exclude<GridType, 'none'>;
  settings: SketchSettings;
  set: (p: Partial<SketchState>) => void;
  showToast: (t: string) => void;
  setSettings: (p: Partial<SketchSettings>) => void;
  pickColor: (c: string) => void;
  toggleEraser: () => void;
  chooseBrush: (id: string) => void;
  /** Tap on "Colour": the five colours go back to the defaults (the current colour stays). */
  defaultColours: () => void;
}

export const ERASER = 'eraser';

/** The tools remembered between sessions (the brush, not the eraser, comes back). */
interface Tools {
  presetId: string;
  sizeLevel: number;
  opacityLevel: number;
  color: string;
  recent: string[];
  eraserSize: number;
  snap: boolean;
  lastGrid: Exclude<GridType, 'none'>;
}
const TOOLS_KEY = 'creative.sketch.tools.v1';
const level = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < SIZE_LEVELS.length ? v : d);
const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const GRIDS = ['cube', 'thirds', '1pt', '2pt', '3pt'];

/** Saved tools, checked; anything unusable falls back to the settings' defaults. */
export function readTools(raw: unknown, settings: SketchSettings): Tools {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Tools, unknown>>;
  const ids = settings.presets.map((p) => p.id).filter((id) => id !== ERASER);
  const fallback = ids.includes(settings.defaultPreset) ? settings.defaultPreset : 'pen';
  const color = hex(o.color) ? (o.color as string) : settings.defaultColor;
  const recent = Array.isArray(o.recent) ? o.recent.filter(hex).slice(0, 8) : [];
  return {
    presetId: typeof o.presetId === 'string' && ids.includes(o.presetId) ? o.presetId : fallback,
    sizeLevel: level(o.sizeLevel, settings.defaultSize),
    opacityLevel: level(o.opacityLevel, settings.defaultOpacity),
    color,
    recent: recent.length ? recent : defaultFive(color),
    eraserSize: level(o.eraserSize, 3),
    snap: typeof o.snap === 'boolean' ? o.snap : true,
    lastGrid: typeof o.lastGrid === 'string' && GRIDS.includes(o.lastGrid) ? (o.lastGrid as Tools['lastGrid']) : 'cube',
  };
}

function loadTools(settings: SketchSettings): Tools {
  try {
    return readTools(JSON.parse(localStorage.getItem(TOOLS_KEY) ?? 'null'), settings);
  } catch {
    return readTools(null, settings);
  }
}

const initial = loadSettings();
const tools = loadTools(initial);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useSketchStore = create<SketchState>((set, get) => ({
  page: 'gallery',
  back: 'gallery',
  projectId: null,
  doc: null,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  floating: false,
  panel: 'none',
  mode: 'draw',
  drawing: false,
  picking: false,
  toast: null,
  saving: false,
  presetId: tools.presetId,
  sizeLevel: tools.sizeLevel,
  opacityLevel: tools.opacityLevel,
  color: tools.color,
  recent: tools.recent,
  lastBrush: tools.presetId,
  brushSize: tools.sizeLevel,
  eraserSize: tools.eraserSize,
  snap: tools.snap,
  lastGrid: tools.lastGrid,
  settings: initial,
  set: (p) => set(p),
  showToast: (t) => {
    clearTimeout(toastTimer);
    set({ toast: t });
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },
  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    saveSettings(settings);
    set({ settings });
    // The tools are remembered, so a changed drawing default applies now.
    if (p.defaultPreset && p.defaultPreset !== ERASER) get().chooseBrush(p.defaultPreset);
    if (p.defaultSize !== undefined && get().presetId !== ERASER) set({ sizeLevel: p.defaultSize });
    if (p.defaultOpacity !== undefined) set({ opacityLevel: p.defaultOpacity });
    if (p.defaultColor) get().pickColor(p.defaultColor);
  },
  pickColor: (c) => {
    // Choosing a colour means drawing with it: the eraser is left.
    if (get().presetId === ERASER) get().toggleEraser();
    const recent = [c, ...get().recent.filter((x) => x !== c)].slice(0, 8);
    set({ color: c, recent, mode: 'draw' });
  },
  toggleEraser: () => {
    const s = get();
    if (s.presetId === ERASER) set({ presetId: s.lastBrush, eraserSize: s.sizeLevel, sizeLevel: s.brushSize, mode: 'draw' });
    else set({ lastBrush: s.presetId, brushSize: s.sizeLevel, presetId: ERASER, sizeLevel: s.eraserSize, mode: 'draw' });
  },
  chooseBrush: (id) => {
    if (get().presetId === ERASER) get().toggleEraser();
    set({ presetId: id, lastBrush: id, mode: 'draw' });
  },
  defaultColours: () => set({ recent: defaultFive(get().color) }),
}));

// Remember the tools as they change (while erasing, the brush it returns to).
useSketchStore.subscribe((s, p) => {
  if (s.presetId === p.presetId && s.sizeLevel === p.sizeLevel && s.opacityLevel === p.opacityLevel && s.color === p.color && s.recent === p.recent && s.eraserSize === p.eraserSize && s.snap === p.snap && s.lastGrid === p.lastGrid) return;
  const erasing = s.presetId === ERASER;
  const t: Tools = {
    presetId: erasing ? s.lastBrush : s.presetId,
    sizeLevel: erasing ? s.brushSize : s.sizeLevel,
    opacityLevel: s.opacityLevel,
    color: s.color,
    recent: s.recent,
    eraserSize: erasing ? s.sizeLevel : s.eraserSize,
    snap: s.snap,
    lastGrid: s.lastGrid,
  };
  try {
    localStorage.setItem(TOOLS_KEY, JSON.stringify(t));
  } catch {
    // Storage full or blocked: the tools stay for this session.
  }
});

/** The preset the brush uses now. */
export function currentPreset(s = useSketchStore.getState()): BrushPreset {
  return s.settings.presets.find((p) => p.id === s.presetId) ?? s.settings.presets[0];
}

export const sizeScale = (level: number) => SIZE_LEVELS[Math.max(0, Math.min(SIZE_LEVELS.length - 1, level))];
export const opacityValue = (level: number) => OPACITY_LEVELS[Math.max(0, Math.min(OPACITY_LEVELS.length - 1, level))];
