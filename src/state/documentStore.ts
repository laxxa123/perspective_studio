// documentStore (§7.1): the immutable document plus patch-based undo/redo.
// Every change goes through a command (§8.5); a drag is one transaction.
import { create } from 'zustand';
import {
  begin as beginTxn,
  commit as commitTxn,
  emptyHistory,
  execute,
  preview as previewTxn,
  redo as redoHistory,
  undo as undoHistory,
  type Command,
  type History,
  type Recipe,
  type Transaction,
} from '../core/commands/history';
import type { SceneDocument } from '../core/document/types';

interface DocumentState {
  doc: SceneDocument | null;
  history: History;
  txn: Transaction | null;
  /** Bumped on every change to the document (autosave watches it). */
  revision: number;
  load: (doc: SceneDocument) => void;
  close: () => void;
  run: (cmd: Command) => void;
  begin: (label: string) => void;
  preview: (recipe: Recipe) => void;
  commit: () => void;
  cancel: () => void;
  undo: () => void;
  redo: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  doc: null,
  history: emptyHistory(),
  txn: null,
  revision: 0,
  load: (doc) => set({ doc, history: emptyHistory(), txn: null, revision: 0 }),
  close: () => set({ doc: null, history: emptyHistory(), txn: null }),
  run: (cmd) => {
    const { doc, history, txn, revision } = get();
    if (!doc || txn) return;
    const r = execute(doc, history, cmd);
    if (r.doc !== doc) set({ ...r, revision: revision + 1 });
  },
  begin: (label) => {
    const { doc, txn } = get();
    if (doc && !txn) set({ txn: beginTxn(doc, label) });
  },
  preview: (recipe) => {
    const { txn } = get();
    if (txn) set({ doc: previewTxn(txn, recipe) });
  },
  commit: () => {
    const { txn, history, revision } = get();
    if (!txn) return;
    const r = commitTxn(txn, history);
    set({ ...r, txn: null, revision: r.history === history ? revision : revision + 1 });
  },
  cancel: () => {
    const { txn } = get();
    if (txn) set({ doc: txn.base, txn: null });
  },
  undo: () => {
    const { doc, history, txn, revision } = get();
    if (!doc || txn) return;
    const r = undoHistory(doc, history);
    if (r) set({ ...r, revision: revision + 1 });
  },
  redo: () => {
    const { doc, history, txn, revision } = get();
    if (!doc || txn) return;
    const r = redoHistory(doc, history);
    if (r) set({ ...r, revision: revision + 1 });
  },
}));
