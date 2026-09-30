// Session / UI state (§7.1): never in history.
import { create } from 'zustand';
import { DEFAULT_DISPLAY, type DisplayOptions } from '../core/derive/display';
import type { RenderItem } from '../core/derive/renderModel';
import type { Id, RectEntity, StrokeEntity } from '../core/document/types';
import type { PerspectiveHandleId } from '../core/perspective';
import type { Family } from '../core/perspective/types';
import type { Viewport } from '../core/viewport/viewport';

export type ToolId = 'select' | 'box' | 'rect' | 'sketch' | 'perspective';
export type Screen = 'gallery' | 'editor' | 'settings';
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
  viewport: Viewport | null;
  display: DisplayOptions;
  tool: ToolId;
  selection: Id[];
  perspectiveLocked: boolean;
  dragging: PerspectiveHandleId | null;
  /** Layer new entities go to, per role. */
  activeLayer: { objects: Id | null; sketch: Id | null };
  rectPlane: RectEntity['plane'];
  sketch: SketchSettings;
  panel: 'none' | 'inspector' | 'layers' | 'display';
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
  width: 3,
  opacity: 1,
  snap: 'off',
  family: 'auto',
  eraser: false,
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>((set) => ({
  screen: 'gallery',
  viewport: null,
  display: DEFAULT_DISPLAY,
  tool: 'select',
  selection: [],
  perspectiveLocked: false,
  dragging: null,
  activeLayer: { objects: null, sketch: null },
  rectPlane: 'ground',
  sketch: DEFAULT_SKETCH,
  panel: 'none',
  contextMenu: null,
  toast: null,
  live: [],
  marquee: null,
  strokeWarningShown: false,
  set: (patch) => set(patch),
  setViewport: (viewport) => set({ viewport }),
  setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' ? s.selection : [], contextMenu: null })),
  select: (selection) => set({ selection, contextMenu: null }),
  setDragging: (dragging) => set({ dragging }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },
}));
