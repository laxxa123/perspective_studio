// OBJECTS UI state (zustand): the object being built (blocks or a 2D
// figure), the question being made, and where the author is. The question
// engine stays in core/; this only holds and changes state, with undo.
import { create } from 'zustand';
import { STARTER, readBlocks, readHoles, type Blocks, type Cell, type Hole } from '../core/blocks';
import { readFigure, STARTER_FIGURE, type Figure } from '../core/figure';
import { STARTER_FOLD, type FoldSpec } from '../core/fold';
import { buildQuestion, defaultParams, kindOf, refresh, type Family, type Kind, type Params, type Question } from '../core/questions';
import { newSeed } from '../core/random';
import { parseQuestion } from '../core/schema';

export type Page = 'studio' | 'bank' | 'test' | 'analysis';
export type Step = 'build' | 'question';
export type BlockTool = 'add' | 'remove' | 'mark' | 'hole';
export type FigureTool = 'fill' | 'dot' | 'arrow' | 'erase';

interface Snapshot {
  blocks: Blocks;
  holes: readonly Hole[];
  marked: Cell | null;
  figure: Figure;
  fold: FoldSpec;
  question: Question | null;
}

export interface Draft {
  kind: Kind;
  step: Step;
  blocks: Blocks;
  holes: readonly Hole[];
  marked: Cell | null;
  figure: Figure;
  fold: FoldSpec;
  family: Family;
  params: Params;
  seed: number;
  question: Question | null;
  editing: { id: string; version: number } | null;
}

interface State extends Draft {
  page: Page;
  blockTool: BlockTool;
  figureTool: FigureTool;
  past: Snapshot[];
  future: Snapshot[];
  saveStatus: 'idle' | 'saving' | 'saved';
  toast: string | null;
  /** Bumped to re-frame the 3D view. */
  frame: number;
  set: (p: Partial<State>) => void;
  showToast: (t: string) => void;
  /** Changes the object / figure / fold / question with an undo step. */
  edit: (p: Partial<Snapshot>) => void;
  undo: () => void;
  redo: () => void;
  /** Rebuilds the question from the current source, type and settings (new options with `reseed`). */
  generate: (reseed?: boolean) => void;
  setQuestion: (q: Question) => void;
  load: (d: Partial<Draft>) => void;
  newObject: () => void;
}

const snap = (s: State): Snapshot => ({ blocks: s.blocks, holes: s.holes, marked: s.marked, figure: s.figure, fold: s.fold, question: s.question });
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useObjects = create<State>((set, get) => ({
  page: 'studio',
  step: 'build',
  kind: 'blocks',
  blocks: STARTER,
  holes: [],
  marked: null,
  figure: STARTER_FIGURE,
  fold: STARTER_FOLD,
  family: 'same',
  params: defaultParams(),
  seed: 1,
  question: null,
  editing: null,
  blockTool: 'add',
  figureTool: 'fill',
  past: [],
  future: [],
  saveStatus: 'idle',
  toast: null,
  frame: 0,
  set: (p) => set(p),
  showToast: (t) => {
    clearTimeout(toastTimer);
    set({ toast: t });
    toastTimer = setTimeout(() => set({ toast: null }), 2400);
  },
  edit: (p) => {
    const s = get();
    set({ ...p, past: [...s.past, snap(s)].slice(-100), future: [] });
  },
  undo: () => {
    const s = get();
    const prev = s.past.at(-1);
    if (!prev) return;
    set({ ...prev, past: s.past.slice(0, -1), future: [snap(s), ...s.future] });
  },
  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    set({ ...next, past: [...s.past, snap(s)], future: s.future.slice(1) });
  },
  generate: (reseed = false) => {
    const s = get();
    const seed = reseed ? newSeed() : s.seed;
    const q = buildQuestion(s.family, { blocks: s.blocks, holes: s.holes, marked: s.marked, figure: s.figure, fold: s.fold }, s.params, seed);
    // Editing a committed question keeps its id and version until it is committed again.
    const kept = s.editing ? { ...q, questionId: s.editing.id, version: s.editing.version } : q;
    get().edit({ question: kept });
    set({ seed });
  },
  setQuestion: (q) => get().edit({ question: refresh(q) }),
  load: (d) => set({ ...d, past: [], future: [] }),
  newObject: () => {
    const s = get();
    get().edit(s.kind === 'blocks' ? { blocks: STARTER, holes: [], marked: null, question: null } : { figure: STARTER_FIGURE, fold: STARTER_FOLD, question: null });
    set({ editing: null, step: 'build', frame: s.frame + 1 });
  },
}));

/** Opens a committed question in the Studio (Edit: a new version on commit; Variant: a new question with new options). */
export function openInStudio(q: Question, as: 'edit' | 'variant') {
  const s = useObjects.getState();
  const kind = kindOf(q.family);
  s.load({
    page: 'studio',
    step: 'question',
    kind,
    blocks: q.source.blocks.length ? q.source.blocks : STARTER,
    holes: q.source.blocks.length ? q.source.holes : [],
    marked: q.source.marked,
    figure: q.source.figure,
    fold: q.source.fold,
    family: q.family,
    params: q.params,
    seed: as === 'variant' ? newSeed() : q.seed,
    question: as === 'edit' ? q : null,
    editing: as === 'edit' && q.questionId ? { id: q.questionId, version: q.version } : null,
  } as Partial<Draft>);
  if (as === 'variant') useObjects.getState().generate();
}

/** Reads a saved draft; anything unusable falls back to a fresh start. */
export function readDraft(raw: unknown): Partial<Draft> {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Draft> = {};
  if (o.kind === 'blocks' || o.kind === 'figure') out.kind = o.kind;
  if (o.step === 'build' || o.step === 'question') out.step = o.step;
  const b = readBlocks(o.blocks);
  if (b) out.blocks = b;
  out.holes = readHoles(o.holes);
  const f = readFigure(o.figure);
  if (f) out.figure = f;
  if (Array.isArray(o.marked) && o.marked.length === 3) out.marked = o.marked as unknown as Cell;
  try {
    if (o.question) {
      const q = parseQuestion(o.question);
      out.question = q;
      out.family = q.family;
      out.params = q.params;
      out.seed = q.seed;
      out.fold = q.source.fold;
    }
  } catch {
    // A draft question that no longer reads is dropped; the object stays.
  }
  if (o.fold && typeof o.fold === 'object' && !out.fold) out.fold = o.fold as FoldSpec;
  if (typeof o.family === 'string' && !out.family) out.family = o.family as Family;
  if (o.params && typeof o.params === 'object' && !out.params) out.params = { ...defaultParams(), ...(o.params as Params) };
  if (o.editing && typeof o.editing === 'object') out.editing = o.editing as Draft['editing'];
  return out;
}

export const draftOf = (s: State): Draft => ({ kind: s.kind, step: s.step, blocks: s.blocks, holes: s.holes, marked: s.marked, figure: s.figure, fold: s.fold, family: s.family, params: s.params, seed: s.seed, question: s.question, editing: s.editing });
