// CUBE's UI state: the draft CubeModel with undo / redo (CUBE §43), the
// question being built, selection shared by the net and the 3D cube (CUBE §21),
// tools. The model is replaced immutably; views only read it.
import { create } from 'zustand';
import type { CubeModel, FaceId } from '../model/CubeModel';
import type { Question } from '../model/QuestionModel';
import { normaliseNet } from '../model/edit';

export type Tool = 'select' | 'net' | 'pen' | 'shape' | 'text' | 'stamp' | 'image' | 'fill' | 'eraser';
export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse' | 'polygon';
export type Page = 'studio' | 'bank' | 'test' | 'analysis';
export type Step = 'design' | 'question';

export interface ElementRef {
  face: FaceId;
  /** Element id, or pattern id when `pattern`. */
  id: string;
  pattern?: boolean;
}

export interface Style {
  stroke: string;
  fill: string;
  /** Face units. */
  width: number;
  stamp: string;
  sides: number;
  /** The Shape tool's current shape. */
  shape: ShapeKind;
  /** Stamp / text size in face units (S, M, L). */
  size: number;
  /** The Fill tool's face colour. */
  faceFill: string;
}

/** An image being placed as a board-wide skin (CUBE v1.2): board units, centre + size + rotation. */
export interface Skin {
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

const HISTORY_LIMIT = 100;

interface CubeState {
  page: Page;
  step: Step;
  model: CubeModel | null;
  past: CubeModel[];
  future: CubeModel[];
  /** Model before a continuous change (drag), committed as one history entry. */
  pending: CubeModel | null;
  selectedFace: FaceId | null;
  selected: ElementRef | null;
  tool: Tool;
  style: Style;
  /** An image being placed (before it is trimmed to the faces). */
  skin: Skin | null;
  /** The 3D cube pop-up is open. */
  show3d: boolean;
  question: Question | null;
  /** The bank question being edited (commit adds a version, CUBE §33). */
  editing: { questionId: string; version: number } | null;
  /** Asset id → data URL, for rendering. */
  assets: Record<string, string>;
  saveStatus: 'idle' | 'saving' | 'saved';
  toast: string | null;
  set: (p: Partial<Omit<CubeState, 'set'>>) => void;
  /** A finished change: one undo step. */
  apply: (m: CubeModel) => void;
  /** A continuous change (drag); `end` closes it as one step. */
  preview: (m: CubeModel) => void;
  end: () => void;
  undo: () => void;
  redo: () => void;
  load: (m: CubeModel) => void;
  addAsset: (id: string, data: string) => void;
  showToast: (t: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useCubeStore = create<CubeState>((set, get) => ({
  page: 'studio',
  step: 'design',
  model: null,
  past: [],
  future: [],
  pending: null,
  selectedFace: null,
  selected: null,
  tool: 'select',
  style: { stroke: '#212529', fill: '#1c7ed6', width: 0.04, stamp: 'star', sides: 6, shape: 'rect', size: 0.4, faceFill: '#adb5bd' },
  skin: null,
  show3d: false,
  question: null,
  editing: null,
  assets: {},
  saveStatus: 'idle',
  toast: null,
  set: (p) => set(p),
  apply: (m) => {
    const { model, past, pending } = get();
    const base = pending ?? model;
    if (!base || base === m) return set({ model: m, pending: null });
    set({ model: m, past: [...past, base].slice(-HISTORY_LIMIT), future: [], pending: null });
  },
  preview: (m) => {
    const { model, pending } = get();
    set({ model: m, pending: pending ?? model });
  },
  end: () => {
    const { model, pending } = get();
    if (pending && model && pending !== model) get().apply(model);
    else set({ pending: null });
  },
  undo: () => {
    const { model, past, future } = get();
    if (!model || !past.length) return;
    set({ model: past[past.length - 1], past: past.slice(0, -1), future: [model, ...future], selected: null });
  },
  redo: () => {
    const { model, past, future } = get();
    if (!model || !future.length) return;
    set({ model: future[0], past: [...past, model], future: future.slice(1), selected: null });
  },
  load: (m) => set({ model: normaliseNet(m), past: [], future: [], pending: null, selected: null, selectedFace: null, skin: null }),
  addAsset: (id, data) => set({ assets: { ...get().assets, [id]: data } }),
  showToast: (t) => {
    clearTimeout(toastTimer);
    set({ toast: t });
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },
}));
