// The post layout (PUBLISH §9.2): tiles in rows; a row is one full-width
// tile, or two halves (either may be empty). Drag-and-drop rules:
// - drop on a row's left / right half → the tile takes that half; a full
//   row splits; an occupied half's tile moves to a new full row just below;
// - drop on a row's centre → the tile takes the whole row; tiles that were
//   there become full rows above (left) and below (right);
// - drop between rows → a new full row there.
// Pure; every operation returns a new layout.

export type Row = { kind: 'full'; id: string } | { kind: 'half'; left: string | null; right: string | null };
export type Layout = Row[];
export type Zone = 'left' | 'right' | 'center' | 'before' | 'after';

/** Tile ids in reading order (row by row, left to right). */
export function order(l: Layout): string[] {
  return l.flatMap((r) => (r.kind === 'full' ? [r.id] : [r.left, r.right].filter((x): x is string => !!x)));
}

/** One full row per tile, in the given order. */
export const fromOrder = (ids: string[]): Layout => ids.map((id) => ({ kind: 'full', id }));

/** Keeps the layout in step with the tiles: drops missing ones, appends new ones as full rows. */
export function reconcile(l: Layout, ids: readonly string[]): Layout {
  const keep = new Set(ids);
  const out: Layout = [];
  for (const r of l) {
    if (r.kind === 'full') {
      if (keep.has(r.id)) out.push(r);
    } else {
      const left = r.left && keep.has(r.left) ? r.left : null;
      const right = r.right && keep.has(r.right) ? r.right : null;
      if (left || right) out.push({ kind: 'half', left, right });
    }
  }
  const have = new Set(order(out));
  for (const id of ids) if (!have.has(id)) out.push({ kind: 'full', id });
  return out;
}

/** Takes a tile out (an emptied half row disappears; a half row keeps its other tile in place). */
export function remove(l: Layout, id: string): Layout {
  const out: Layout = [];
  for (const r of l) {
    if (r.kind === 'full') {
      if (r.id !== id) out.push(r);
      continue;
    }
    const left = r.left === id ? null : r.left;
    const right = r.right === id ? null : r.right;
    if (left || right) out.push({ kind: 'half', left, right });
  }
  return out;
}

/** Where a tile sits: row index and side. */
export function locate(l: Layout, id: string): { row: number; side: 'full' | 'left' | 'right' } | null {
  for (let i = 0; i < l.length; i++) {
    const r = l[i];
    if (r.kind === 'full' && r.id === id) return { row: i, side: 'full' };
    if (r.kind === 'half' && r.left === id) return { row: i, side: 'left' };
    if (r.kind === 'half' && r.right === id) return { row: i, side: 'right' };
  }
  return null;
}

/**
 * Drops tile `id` on row `at` (an index into the layout as it is now) in
 * `zone`. Rows are identified before the tile is lifted out, so dropping a
 * tile on its own row works.
 */
export function drop(l: Layout, id: string, at: number, zone: Zone): Layout {
  if (at < 0 || at >= l.length) return zone === 'before' && at <= 0 ? [{ kind: 'full', id }, ...remove(l, id)] : [...remove(l, id), { kind: 'full', id }];
  const target = l[at];
  // Lift the tile out, remembering where the target row went.
  const lifted: (Row | null)[] = l.map((r) => {
    if (r === target) return r;
    if (r.kind === 'full') return r.id === id ? null : r;
    const left = r.left === id ? null : r.left;
    const right = r.right === id ? null : r.right;
    return left || right ? { kind: 'half', left, right } : null;
  });
  // The target row without the dragged tile.
  let t: Row | null = target;
  if (t.kind === 'full' && t.id === id) t = null;
  else if (t.kind === 'half') {
    const left = t.left === id ? null : t.left;
    const right = t.right === id ? null : t.right;
    t = left || right ? { kind: 'half', left, right } : null;
  }
  const before: Row[] = [];
  const after: Row[] = [];
  let here: Row[];
  const full = (x: string): Row => ({ kind: 'full', id: x });
  switch (zone) {
    case 'before':
      here = [full(id), ...(t ? [t] : [])];
      break;
    case 'after':
      here = [...(t ? [t] : []), full(id)];
      break;
    case 'center':
      // The tile takes the whole row; whoever was there moves out above (left) / below (right).
      if (t?.kind === 'full') after.push(t);
      if (t?.kind === 'half') {
        if (t.left) before.push(full(t.left));
        if (t.right) after.push(full(t.right));
      }
      here = [full(id)];
      break;
    case 'left':
    case 'right': {
      const other = zone === 'left' ? 'right' : 'left';
      if (!t) here = [{ kind: 'half', left: zone === 'left' ? id : null, right: zone === 'right' ? id : null }];
      else if (t.kind === 'full') here = [{ kind: 'half', [zone]: id, [other]: t.id } as Row];
      else {
        const occupant = t[zone];
        here = [{ kind: 'half', [zone]: id, [other]: t[other] } as Row];
        if (occupant) after.push(full(occupant));
      }
      break;
    }
  }
  const out: Layout = [];
  lifted.forEach((r, i) => {
    if (i === at) out.push(...before, ...here, ...after);
    else if (r) out.push(r);
  });
  return out;
}

/** Row cell counts for the theme: a full row has 1 cell, a half row 2. */
export const rowCounts = (l: Layout) => l.map((r) => (r.kind === 'full' ? 1 : 2));
