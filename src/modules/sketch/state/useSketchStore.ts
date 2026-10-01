// SKETCH UI state (zustand). The artwork lives in the engine; this mirrors
// only what the UI shows (document, history flags) plus brush choices.
import { create } from 'zustand';
import { OPACITY_LEVELS, SIZE_LEVELS } from '../core/presets';
import type { BrushPreset, SketchDocument } from '../core/types';
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
  /** A stroke is in progress: the UI fades away. */
  drawing: boolean;
  toast: string | null;
  saving: boolean;
  presetId: string;
  sizeLevel: number;
  opacityLevel: number;
  color: string;
  recent: string[];
  settings: SketchSettings;
  set: (p: Partial<SketchState>) => void;
  showToast: (t: string) => void;
  setSettings: (p: Partial<SketchSettings>) => void;
  pickColor: (c: string) => void;
}

const initial = loadSettings();
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
  toast: null,
  saving: false,
  presetId: initial.defaultPreset,
  sizeLevel: initial.defaultSize,
  opacityLevel: initial.defaultOpacity,
  color: initial.defaultColor,
  recent: [],
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
  },
  pickColor: (c) => {
    const recent = [c, ...get().recent.filter((x) => x !== c)].slice(0, 8);
    set({ color: c, recent });
  },
}));

/** The preset the brush uses now. */
export function currentPreset(s = useSketchStore.getState()): BrushPreset {
  return s.settings.presets.find((p) => p.id === s.presetId) ?? s.settings.presets[0];
}

export const sizeScale = (level: number) => SIZE_LEVELS[Math.max(0, Math.min(SIZE_LEVELS.length - 1, level))];
export const opacityValue = (level: number) => OPACITY_LEVELS[Math.max(0, Math.min(OPACITY_LEVELS.length - 1, level))];
