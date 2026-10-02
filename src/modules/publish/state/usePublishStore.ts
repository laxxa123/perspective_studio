// PUBLISH UI state: the tab, the tile being edited with undo / redo, the
// selection and which sheet is open. The tile JSON is the only truth.
import { create } from 'zustand';
import type { TileDocument } from '../core/types';

export type Tab = 'tiles' | 'publish' | 'posts' | 'settings';
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
  /** A short message at the bottom with one action (Undo, View). */
  snack: Snack | null;
  saving: boolean;
  /** A WordPress job in progress (its current step), shown over everything. */
  busy: string | null;
  /** The Style bar's last chip (opens again next time). */
  styleChip: string | null;
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
  showSnack: (text: string, action?: Snack['action']) => void;
}

export interface Snack {
  text: string;
  action?: { label: string; run?: () => void; href?: string };
  /** Changes on every message, so a repeated message restarts its timer. */
  key: number;
}

let snackTimer: ReturnType<typeof setTimeout> | undefined;

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
  snack: null,
  saving: false,
  busy: null,
  styleChip: null,
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
  // One message channel, at the bottom (the top belongs to the post's name and Publish).
  showToast: (t) => get().showSnack(t),
  showSnack: (text, action) => {
    clearTimeout(snackTimer);
    const key = Date.now();
    set({ snack: { text, action, key } });
    snackTimer = setTimeout(() => get().snack?.key === key && set({ snack: null }), action ? 6000 : 3000);
  },
}));
