// Session / UI state (§7.1): never in history.
import { create } from 'zustand';
import type { PerspectiveHandleId } from '../core/perspective';
import type { Viewport } from '../core/viewport/viewport';

export type ToolId = 'select' | 'perspective';

interface UiState {
  viewport: Viewport | null;
  tool: ToolId;
  /** PS-06: when locked, the Perspective tool is disabled. */
  perspectiveLocked: boolean;
  /** Handle being dragged in the Perspective tool, for feedback. */
  dragging: PerspectiveHandleId | null;
  setViewport: (v: Viewport) => void;
  setTool: (t: ToolId) => void;
  setPerspectiveLocked: (locked: boolean) => void;
  setDragging: (h: PerspectiveHandleId | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  viewport: null,
  tool: 'select',
  perspectiveLocked: false,
  dragging: null,
  setViewport: (viewport) => set({ viewport }),
  setTool: (tool) => set({ tool }),
  setPerspectiveLocked: (perspectiveLocked) =>
    set((s) => ({ perspectiveLocked, tool: perspectiveLocked && s.tool === 'perspective' ? 'select' : s.tool })),
  setDragging: (dragging) => set({ dragging }),
}));
