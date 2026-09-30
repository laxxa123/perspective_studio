// Commands & undo/redo (§8.5): every document mutation is a named command,
// applied with Immer patches; a drag is one transaction = one history entry.
import { applyPatches, enablePatches, produce, produceWithPatches, type Draft, type Patch } from 'immer';
import type { SceneDocument } from '../document/types';

enablePatches();

export type Recipe = (draft: Draft<SceneDocument>) => void;

export interface Command {
  label: string;
  recipe: Recipe;
}

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const HISTORY_LIMIT = 200;
export const emptyHistory = (): History => ({ past: [], future: [] });

function record(h: History, e: HistoryEntry): History {
  if (e.patches.length === 0) return h;
  return { past: [...h.past, e].slice(-HISTORY_LIMIT), future: [] };
}

/** Applies a command: new document plus a history entry. */
export function execute(doc: SceneDocument, h: History, cmd: Command): { doc: SceneDocument; history: History } {
  const [next, patches, inversePatches] = produceWithPatches(doc, cmd.recipe);
  return { doc: next, history: record(h, { label: cmd.label, patches, inversePatches }) };
}

export function undo(doc: SceneDocument, h: History): { doc: SceneDocument; history: History } | null {
  const e = h.past[h.past.length - 1];
  if (!e) return null;
  return { doc: applyPatches(doc, e.inversePatches), history: { past: h.past.slice(0, -1), future: [e, ...h.future] } };
}

export function redo(doc: SceneDocument, h: History): { doc: SceneDocument; history: History } | null {
  const e = h.future[0];
  if (!e) return null;
  return { doc: applyPatches(doc, e.patches), history: { past: [...h.past, e], future: h.future.slice(1) } };
}

/**
 * A continuous change (a drag): `preview` re-applies the latest recipe to the
 * document as it was when the transaction began; `commit` records one entry.
 */
export interface Transaction {
  base: SceneDocument;
  label: string;
  recipe: Recipe | null;
}

export const begin = (doc: SceneDocument, label: string): Transaction => ({ base: doc, label, recipe: null });

export function preview(t: Transaction, recipe: Recipe): SceneDocument {
  t.recipe = recipe;
  return produce(t.base, recipe);
}

export function commit(t: Transaction, h: History): { doc: SceneDocument; history: History } {
  if (!t.recipe) return { doc: t.base, history: h };
  return execute(t.base, h, { label: t.label, recipe: t.recipe });
}
