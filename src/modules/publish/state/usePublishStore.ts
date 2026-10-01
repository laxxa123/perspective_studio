// PUBLISH UI state: the tab, the tile being edited with undo / redo, the
// selection and which sheet is open. The tile JSON is the only truth.
import { create } from 'zustand';
import type { TileDocument } from '../core/types';

export type Tab = 'tiles' | 'publish' | 'wp' | 'settings';
export type Sheet = 'none' | 'media' | 'style' | 'layers' | 'background' | 'more';
/** Full-screen tools over the editor. */
export type Overlay = 'none' | 'text' | 'trim' | 'paint' | 'spiral';

const LIMIT = 100;

interface PublishState {
  tab: Tab;
  /** The tile open in the editor (null = gallery). */
  tile: TileDocument | null;
  past: TileDocument[];
  future: TileDocument[];
  /** The document before a continuous change (slider, drag) — one undo step. */
  pending: TileDocument | null;
  selected: string | null;
  sheet: Sheet;
  overlay: Overlay;
  /** Snap guides while dragging (document px). */
  guides: { x: number | null; y: number | null };
  toast: string | null;
  saving: boolean;
  /** An element just added (Cancel in its first edit removes it). */
  fresh: string | null;
  set: (p: Partial<Omit<PublishState, 'set'>>) => void;
  open: (t: TileDocument) => void;
  close: () => void;
  /** A finished change: one undo step. */
  apply: (t: TileDocument) => void;
  /** A change in progress (slider); `commit` closes it as one step. */
  preview: (t: TileDocument) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  showToast: (t: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const usePublishStore = create<PublishState>((set, get) => ({
  tab: 'tiles',
  tile: null,
  past: [],
  future: [],
  pending: null,
  selected: null,
  sheet: 'none',
  overlay: 'none',
  guides: { x: null, y: null },
  toast: null,
  saving: false,
  fresh: null,
  set: (p) => set(p),
  open: (t) => set({ tile: t, past: [], future: [], pending: null, selected: null, sheet: 'none', overlay: 'none' }),
  close: () => set({ tile: null, past: [], future: [], pending: null, selected: null, sheet: 'none', overlay: 'none' }),
  apply: (t) => {
    const { tile, past, pending } = get();
    const base = pending ?? tile;
    const next = { ...t, updatedAt: new Date().toISOString() };
    if (!base || base === t) return set({ tile: next, pending: null });
    set({ tile: next, past: [...past, base].slice(-LIMIT), future: [], pending: null });
  },
  preview: (t) => {
    const { tile, pending } = get();
    set({ tile: t, pending: pending ?? tile });
  },
  commit: () => {
    const { tile, pending } = get();
    if (pending && tile && pending !== tile) get().apply(tile);
    else set({ pending: null });
  },
  undo: () => {
    const { tile, past, future } = get();
    if (!tile || !past.length) return;
    const prev = past[past.length - 1];
    set({ tile: prev, past: past.slice(0, -1), future: [tile, ...future], selected: prev.elements.some((e) => e.id === get().selected) ? get().selected : null });
  },
  redo: () => {
    const { tile, past, future } = get();
    if (!tile || !future.length) return;
    set({ tile: future[0], past: [...past, tile], future: future.slice(1) });
  },
  showToast: (t) => {
    clearTimeout(toastTimer);
    set({ toast: t });
    toastTimer = setTimeout(() => set({ toast: null }), 2400);
  },
}));
