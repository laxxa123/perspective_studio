// Undo / redo (SKETCH §16): tile-level snapshots for pixel changes and
// before / after documents for layer operations, in one command history with
// a GPU memory budget. Only the tiles a change touched are ever copied.
import { History, type Command } from '../core/history';
import type { SketchDocument } from '../core/types';
import type { Target } from './gl';
import { TILE_BYTES, type Surface, type TilePool } from './TileManager';

export const UNDO_BUDGET = 96 * 1024 * 1024;

export interface UndoHost {
  surface(layerId: string): Surface | undefined;
  /** Pixels of these tiles changed (recompose + autosave). */
  tilesChanged(layerId: string, tiles: Iterable<number>): void;
  /** Applies a document state (layer stack, selection…) without recording. */
  applyDoc(doc: SketchDocument): void;
  applySelection(poly: { x: number; y: number }[] | null): void;
}

/** Pixel change on one layer: tiles before, and after (captured on first undo). */
class TileCommand implements Command {
  private after: Map<number, Target | null> | null = null;
  constructor(
    readonly label: string,
    readonly layerId: string,
    private before: Map<number, Target | null>,
    private host: UndoHost,
    private pool: TilePool,
  ) {}
  bytes() {
    let n = 0;
    for (const t of this.before.values()) if (t) n++;
    if (this.after) for (const t of this.after.values()) if (t) n++;
    return n * TILE_BYTES;
  }
  undo() {
    const s = this.host.surface(this.layerId);
    if (!s) return;
    if (!this.after) {
      this.after = new Map();
      for (const i of this.before.keys()) this.after.set(i, s.snapshot(i));
    }
    for (const [i, t] of this.before) s.restore(i, t);
    this.host.tilesChanged(this.layerId, this.before.keys());
  }
  redo() {
    const s = this.host.surface(this.layerId);
    if (!s || !this.after) return;
    for (const [i, t] of this.after) s.restore(i, t);
    this.host.tilesChanged(this.layerId, this.after.keys());
  }
  dispose() {
    for (const m of [this.before, this.after]) if (m) for (const t of m.values()) if (t) this.pool.release(t);
    this.before.clear();
    this.after?.clear();
  }
}

/** A layer-stack change: whole documents before / after (layers, active layer). */
class DocCommand implements Command {
  constructor(
    readonly label: string,
    readonly before: SketchDocument,
    readonly after: SketchDocument,
    private host: UndoHost,
  ) {}
  bytes() {
    return 0;
  }
  undo() {
    this.host.applyDoc(this.before);
  }
  redo() {
    this.host.applyDoc(this.after);
  }
  dispose() {}
}

type Poly = { x: number; y: number }[] | null;

class SelectionCommand implements Command {
  constructor(
    readonly label: string,
    private before: Poly,
    private after: Poly,
    private host: UndoHost,
  ) {}
  bytes() {
    return 0;
  }
  undo() {
    this.host.applySelection(this.before);
  }
  redo() {
    this.host.applySelection(this.after);
  }
  dispose() {}
}

/** Several commands as one step (e.g. a transform: pixels + selection). */
class Group implements Command {
  constructor(
    readonly label: string,
    readonly parts: Command[],
  ) {}
  bytes() {
    return this.parts.reduce((n, c) => n + c.bytes(), 0);
  }
  undo() {
    for (let i = this.parts.length - 1; i >= 0; i--) this.parts[i].undo();
  }
  redo() {
    for (const c of this.parts) c.redo();
  }
  dispose() {
    for (const c of this.parts) c.dispose();
  }
}

export class UndoEngine {
  readonly history: History;

  constructor(
    private host: UndoHost,
    private pool: TilePool,
    onChange: () => void,
    budget = UNDO_BUDGET,
  ) {
    this.history = new History(budget, onChange);
  }

  tiles(label: string, layerId: string, before: Map<number, Target | null>): Command {
    return new TileCommand(label, layerId, before, this.host, this.pool);
  }
  doc(label: string, before: SketchDocument, after: SketchDocument): Command {
    return new DocCommand(label, before, after, this.host);
  }
  selection(label: string, before: Poly, after: Poly): Command {
    return new SelectionCommand(label, before, after, this.host);
  }
  group(label: string, parts: Command[]): Command {
    return parts.length === 1 ? parts[0] : new Group(label, parts);
  }

  push(c: Command) {
    this.history.push(c);
  }

  /** Layer ids any held command may bring back (their surfaces must stay alive). */
  referencedLayers(): Set<string> {
    const ids = new Set<string>();
    const visit = (c: Command) => {
      if (c instanceof TileCommand) ids.add(c.layerId);
      else if (c instanceof DocCommand) for (const d of [c.before, c.after]) for (const l of d.layers) ids.add(l.id);
      else if (c instanceof Group) c.parts.forEach(visit);
    };
    this.history.all().forEach(visit);
    return ids;
  }
}
