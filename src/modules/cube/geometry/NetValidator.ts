// Net validation (CUBE §12): six squares are not enough — they must fold into
// six distinct faces without collision.
import { FACE_IDS, type NetCell } from '../model/CubeModel';
import { foldCells } from './FoldingEngine';

export type NetIssueCode =
  | 'too_few'
  | 'too_many'
  | 'duplicate_face'
  | 'off_grid'
  | 'overlap'
  | 'disconnected'
  | 'collision';

export interface NetIssue {
  code: NetIssueCode;
  message: string;
  cells?: number[];
}

export interface NetValidation {
  valid: boolean;
  issues: NetIssue[];
}

const key = (c: NetCell) => `${c.col},${c.row}`;

export function validateNet(cells: readonly NetCell[]): NetValidation {
  const issues: NetIssue[] = [];
  if (cells.length < 6) issues.push({ code: 'too_few', message: `Only ${cells.length} faces; a cube needs six.` });
  if (cells.length > 6) issues.push({ code: 'too_many', message: `${cells.length} faces; a cube has six.` });
  const faces = cells.map((c) => c.face);
  const dup = faces.filter((f, i) => faces.indexOf(f) !== i);
  if (dup.length) issues.push({ code: 'duplicate_face', message: `Face ${dup[0]} appears twice.` });
  const missing = FACE_IDS.filter((f) => !faces.includes(f));
  if (cells.length === 6 && missing.length) issues.push({ code: 'duplicate_face', message: `Face ${missing[0]} is missing.` });
  const offGrid = cells.map((c, i) => (Number.isInteger(c.col) && Number.isInteger(c.row) ? -1 : i)).filter((i) => i >= 0);
  if (offGrid.length) issues.push({ code: 'off_grid', message: 'A face is not aligned to the grid.', cells: offGrid });

  const seen = new Map<string, number>();
  cells.forEach((c, i) => {
    const k = key(c);
    if (seen.has(k)) issues.push({ code: 'overlap', message: `Faces ${cells[seen.get(k)!].face} and ${c.face} overlap.`, cells: [seen.get(k)!, i] });
    else seen.set(k, i);
  });

  if (!issues.length && cells.length) {
    const placed = foldCells(cells);
    if (placed.length < cells.length) {
      const reached = new Set(placed.map((p) => p.cell));
      const lost = cells.map((c, i) => (reached.has(c) ? -1 : i)).filter((i) => i >= 0);
      issues.push({ code: 'disconnected', message: `Face ${cells[lost[0]].face} is not joined edge-to-edge to the others.`, cells: lost });
    } else {
      const bySide = new Map<string, number>();
      placed.forEach((p) => {
        const i = cells.indexOf(p.cell);
        if (bySide.has(p.side)) {
          const j = bySide.get(p.side)!;
          issues.push({ code: 'collision', message: `Faces ${cells[j].face} and ${p.cell.face} fold onto the same side.`, cells: [j, i] });
        } else bySide.set(p.side, i);
      });
    }
  }
  return { valid: issues.length === 0, issues };
}
