// SKETCH settings (SKETCH §22) and the editable brush presets, kept on the
// device (localStorage). Normal use never needs to open them.
import { DEFAULT_PRESETS } from '../core/presets';
import type { Background, BrushPreset, GridType } from '../core/types';
import type { FingerDraw } from '../input/PointerInput';

export interface SketchSettings {
  // Drawing defaults
  defaultPreset: string;
  /** Index into SIZE_LEVELS / OPACITY_LEVELS. */
  defaultSize: number;
  defaultOpacity: number;
  defaultColor: string;
  // Canvas
  background: Background;
  defaultZoom: 'fit' | 'actual';
  defaultGrid: GridType;
  // Gestures
  tapUndo: boolean;
  tapRedo: boolean;
  fingerDraw: FingerDraw;
  // Export
  exportTransparent: boolean;
  exportScale: 1 | 0.5;
  // Brush
  presets: BrushPreset[];
}

export const DEFAULT_SETTINGS: SketchSettings = {
  defaultPreset: 'pencil',
  defaultSize: 2,
  defaultOpacity: 4,
  defaultColor: '#212529',
  background: 'white',
  defaultZoom: 'fit',
  defaultGrid: 'none',
  tapUndo: true,
  tapRedo: true,
  fingerDraw: 'auto',
  exportTransparent: false,
  exportScale: 1,
  presets: DEFAULT_PRESETS.map((p) => ({ ...p })),
};

const KEY = 'creative.sketch.settings.v1';

/** Reads settings; unknown or missing fields fall back to the defaults, missing presets are restored. */
export function loadSettings(): SketchSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SketchSettings> | null;
    if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS);
    const saved = Array.isArray(raw.presets) ? raw.presets : [];
    const presets = DEFAULT_PRESETS.map((d) => ({ ...d, ...(saved.find((p) => p?.id === d.id) ?? {}), id: d.id, engine: d.engine }));
    return { ...structuredClone(DEFAULT_SETTINGS), ...raw, presets };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: SketchSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: settings stay for this session.
  }
}
