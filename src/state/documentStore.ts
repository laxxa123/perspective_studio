// The document (§7.1). M2 holds only the perspective system and the paper;
// commands, history and persistence arrive in M3 / M4.
import { create } from 'zustand';
import { DEFAULT_PAPER } from '../core/document/paper';
import { DEFAULT_PERSPECTIVE, type PerspectiveSystem } from '../core/perspective';

/** The single working document until the gallery exists (M4). */
export const WORKING_DOCUMENT_ID = 'working';

interface DocumentState {
  id: string;
  paper: { width: number; height: number };
  perspective: PerspectiveSystem;
  setPerspective: (ps: PerspectiveSystem) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  id: WORKING_DOCUMENT_ID,
  paper: DEFAULT_PAPER,
  perspective: DEFAULT_PERSPECTIVE,
  setPerspective: (perspective) => set({ perspective }),
}));
