// Session / UI state (§7.1): never in history.
import { create } from 'zustand';
import { DEFAULT_DISPLAY, type DisplayOptions } from '../core/derive/display';
import type { RenderItem } from '../core/derive/renderModel';
import type { Id, StrokeEntity } from '../core/document/types';
import type { PerspectiveHandleId } from '../core/perspective';
import type { Family } from '../core/perspective/types';
import type { Viewport } from '../core/viewport/viewport';

export type ToolId = 'select' | 'shape' | 'sketch' | 'perspective';
/** home = the suite (CREATIVE.md §2); gallery / editor = the Perspective module. */
export type Screen = 'home' | 'gallery' | 'editor' | 'settings';
export type SnapMode = 'off' | 'soft' | 'locked';

export interface SketchSettings {
  tool: StrokeEntity['tool'];
  color: string;
  width: number;
  opacity: number;
  snap: SnapMode;
  /** Locked mode: a fixed family, or the nearest one. */
  family: Family | 'auto';
  eraser: boolean;
}

interface UiState {
  screen: Screen;
  /** Where Settings returns to. */
  back: Screen;
  viewport: Viewport | null;
  display: DisplayOptions;
  tool: ToolId;
  selection: Id[];
  perspectiveLocked: boolean;
  dragging: PerspectiveHandleId | null;
  /** Layer new entities go to, per role. */
  activeLayer: { objects: Id | null; sketch: Id | null };
  /** The shape the Shapes tool places (UI-01). */
  shape: { kind: string; option: string };
  /** Working plane height (PL-01), per document; null = off. */
  workingPlane: number | null;
  /** Plan view open (CV-05). */
  planOpen: boolean;
  /** Touch multi-select mode (UI-04). */
  multi: boolean;
  /** Tool palette expanded (UI-02); collapsed to a chip on phones by default. */
  paletteOpen: boolean;
  /** The View sliders are open (PS-13): an orbit preview until Apply / Revert. */
  viewOpen: boolean;
  /** Perspective drag options (PS-09, PS-10). */
  scaleLock: boolean;
  pinSelection: boolean;
  sketch: SketchSettings;
  panel: 'none' | 'inspector' | 'layers' | 'display' | 'shapes';
  contextMenu: { id: Id; x: number; y: number } | null;
  toast: string | null;
  /** In-progress items (live stroke), pp. */
  live: RenderItem[];
  marquee: { x: number; y: number; width: number; height: number } | null;
  /** SK-06: the strokes-stay-put warning was shown for this document. */
  strokeWarningShown: boolean;
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
  setViewport: (v: Viewport) => void;
  setTool: (t: ToolId) => void;
  select: (ids: Id[]) => void;
  setDragging: (h: PerspectiveHandleId | null) => void;
  showToast: (msg: string) => void;
}

export const DEFAULT_SKETCH: SketchSettings = {
  tool: 'pen',
  color: '#212529',
  width: 2,
  opacity: 1,
  snap: 'off',
  family: 'auto',
  eraser: false,
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>((set) => ({
  screen: 'home',
  back: 'home',
  viewport: null,
  display: DEFAULT_DISPLAY,
  tool: 'select',
  selection: [],
  perspectiveLocked: false,
  dragging: null,
  activeLayer: { objects: null, sketch: null },
  shape: { kind: 'box', option: 'box' },
  workingPlane: null,
  planOpen: false,
  viewOpen: false,
  multi: false,
  paletteOpen: typeof window !== 'undefined' ? window.innerWidth >= 820 : true,
  scaleLock: false,
  pinSelection: false,
  sketch: DEFAULT_SKETCH,
  panel: 'none',
  contextMenu: null,
  toast: null,
  live: [],
  marquee: null,
  strokeWarningShown: false,
  set: (patch) => set(patch),
  setViewport: (viewport) => set({ viewport }),
  setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' || tool === 'perspective' ? s.selection : [], contextMenu: null, multi: tool === 'select' ? s.multi : false })),
  select: (selection) => set({ selection, contextMenu: null }),
  setDragging: (dragging) => set({ dragging }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },
}));
