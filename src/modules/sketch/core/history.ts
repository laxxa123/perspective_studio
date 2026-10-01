// Command history (SKETCH §16): every entry knows how to undo / redo itself
// and how much memory it holds (tile snapshots); the oldest entries are
// dropped when the history passes its memory budget. Pure.

export interface Command {
  label: string;
  /** Bytes held (GPU snapshots); may grow after the first undo captures the "after" state. */
  bytes(): number;
  undo(): void;
  redo(): void;
  /** Frees what the entry holds; called when it can never be used again. */
  dispose(): void;
}

export class History {
  private done: Command[] = [];
  private undone: Command[] = [];

  constructor(
    private budget: number,
    private onChange: () => void = () => undefined,
  ) {}

  get canUndo() {
    return this.done.length > 0;
  }
  get canRedo() {
    return this.undone.length > 0;
  }
  get size() {
    return this.done.length;
  }

  bytes(): number {
    let n = 0;
    for (const c of this.done) n += c.bytes();
    for (const c of this.undone) n += c.bytes();
    return n;
  }

  /** Records an already-applied command; the redo branch is discarded. */
  push(c: Command) {
    for (const r of this.undone) r.dispose();
    this.undone = [];
    this.done.push(c);
    this.trim();
    this.onChange();
  }

  undo(): Command | null {
    const c = this.done.pop();
    if (!c) return null;
    c.undo();
    this.undone.push(c);
    this.trim();
    this.onChange();
    return c;
  }

  redo(): Command | null {
    const c = this.undone.pop();
    if (!c) return null;
    c.redo();
    this.done.push(c);
    this.onChange();
    return c;
  }

  /** Every command still held (for resource bookkeeping). */
  all(): readonly Command[] {
    return [...this.done, ...this.undone];
  }

  clear() {
    for (const c of this.all()) c.dispose();
    this.done = [];
    this.undone = [];
    this.onChange();
  }

  /** Drops the oldest undo steps (then the furthest redo steps) until under budget; keeps the latest step. */
  private trim() {
    let total = this.bytes();
    while (total > this.budget && this.done.length + this.undone.length > 1) {
      const c = this.done.length > 1 || !this.undone.length ? this.done.shift() : this.undone.shift();
      if (!c) break;
      total -= c.bytes();
      c.dispose();
    }
  }
}
