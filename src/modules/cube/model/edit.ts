// Pure edits of the CubeModel. Every UI change goes through one of these and
// produces a new model (undo / redo keeps the old one).
import { compose, faceToNet, invert, mapTransform } from '../geometry/Orientation';
import { coveredFaces, fragmentsFor } from '../geometry/PatternContinuity';
import { PRESETS } from '../geometry/NetShapes';
import { FACE_IDS, type ArtworkElement, type CubeModel, type FaceId, type FaceModel, type NetCell, type Transform2, type Turns } from './CubeModel';

export interface Ref {
  face: FaceId;
  id: string;
  pattern?: boolean;
}

const withFace = (m: CubeModel, f: FaceId, patch: Partial<FaceModel>): CubeModel => ({ ...m, faces: { ...m.faces, [f]: { ...m.faces[f], ...patch } } });

export const setFace = withFace;

/** The element and its transform as seen on face `ref.face`. */
export function elementAt(m: CubeModel, ref: Ref): { element: ArtworkElement; transform: Transform2 } | null {
  if (ref.pattern) {
    const p = m.patterns.find((x) => x.id === ref.id);
    const fr = p?.fragments.find((x) => x.face === ref.face) ?? p?.fragments[0];
    return p && fr ? { element: p.element, transform: fr.transform } : null;
  }
  const e = m.faces[ref.face].elements.find((x) => x.id === ref.id);
  return e ? { element: e, transform: e.transform } : null;
}

const removeRef = (m: CubeModel, ref: Ref): CubeModel =>
  ref.pattern
    ? { ...m, patterns: m.patterns.filter((p) => p.id !== ref.id) }
    : withFace(m, ref.face, { elements: m.faces[ref.face].elements.filter((e) => e.id !== ref.id) });

/** Moves a transform from face `from`'s frame into face `to`'s, via the net. */
function reframe(m: CubeModel, t: Transform2, from: FaceId, to: FaceId): Transform2 {
  const a = m.net.cells.find((c) => c.face === from);
  const b = m.net.cells.find((c) => c.face === to);
  if (!a || !b || from === to) return t;
  return mapTransform(t, compose(invert(faceToNet(b)), faceToNet(a)));
}

/**
 * Places an element drawn / moved on face `face` (transform in that face's
 * frame). It becomes a surface pattern when it crosses a fold (CUBE §16),
 * otherwise an element of the one face it lies on. Returns the new model and
 * a reference to the placed element.
 */
export function place(m: CubeModel, face: FaceId, el: ArtworkElement, replacing?: Ref, index?: number): { model: CubeModel; ref: Ref } {
  let base = replacing ? removeRef(m, replacing) : m;
  const covered = coveredFaces(el, el.transform, face, base.net);
  if (covered.length > 1) {
    const pattern = { id: el.id, element: el, anchor: face, fragments: fragmentsFor(el, face, base.net), continuityMode: 'fold' as const };
    const patterns = [...base.patterns];
    patterns.splice(index ?? patterns.length, 0, pattern);
    base = { ...base, patterns };
    return { model: base, ref: { face, id: el.id, pattern: true } };
  }
  const target = covered[0];
  const placed = { ...el, transform: reframe(base, el.transform, face, target) };
  const elements = [...base.faces[target].elements];
  elements.splice(index ?? elements.length, 0, placed);
  return { model: withFace(base, target, { elements }), ref: { face: target, id: el.id } };
}

export function updateElement(m: CubeModel, ref: Ref, patch: Partial<ArtworkElement>): { model: CubeModel; ref: Ref } {
  const at = elementAt(m, ref);
  if (!at) return { model: m, ref };
  const el = { ...at.element, transform: at.transform, ...patch };
  const index = ref.pattern ? m.patterns.findIndex((p) => p.id === ref.id) : m.faces[ref.face].elements.findIndex((e) => e.id === ref.id);
  return place(m, ref.face, el, ref, index);
}

export const removeElement = removeRef;

/** Changes an element's stacking order on its face (+1 = up). */
export function reorder(m: CubeModel, ref: Ref, delta: 1 | -1): CubeModel {
  if (ref.pattern) {
    const i = m.patterns.findIndex((p) => p.id === ref.id);
    const j = Math.max(0, Math.min(m.patterns.length - 1, i + delta));
    const ps = [...m.patterns];
    const [p] = ps.splice(i, 1);
    ps.splice(j, 0, p);
    return { ...m, patterns: ps };
  }
  const els = [...m.faces[ref.face].elements];
  const i = els.findIndex((e) => e.id === ref.id);
  const j = Math.max(0, Math.min(els.length - 1, i + delta));
  const [e] = els.splice(i, 1);
  els.splice(j, 0, e);
  return withFace(m, ref.face, { elements: els });
}

// ----- the net -----

const setCells = (m: CubeModel, cells: NetCell[]): CubeModel => ({ ...m, net: { cells } });

/** Moves a face to a grid cell; a face already there swaps places with it. */
export function moveCell(m: CubeModel, face: FaceId, col: number, row: number): CubeModel {
  const cur = m.net.cells.find((c) => c.face === face);
  if (!cur || (cur.col === col && cur.row === row)) return m;
  return setCells(
    m,
    m.net.cells.map((c) => (c.face === face ? { ...c, col, row } : c.col === col && c.row === row ? { ...c, col: cur.col, row: cur.row } : c)),
  );
}

export function rotateCell(m: CubeModel, face: FaceId, by: 1 | -1): CubeModel {
  return setCells(m, m.net.cells.map((c) => (c.face === face ? { ...c, turns: ((((c.turns + by) % 4) + 4) % 4) as Turns } : c)));
}

/** Lays the faces out as a preset; faces keep their artwork (A…F in reading order). */
export function applyPreset(m: CubeModel, presetId: string): CubeModel {
  const p = PRESETS.find((x) => x.id === presetId);
  if (!p) return m;
  return setCells(m, p.shape.map((c, i) => ({ face: FACE_IDS[i], col: c.col, row: c.row, turns: 0 })));
}

/** Clears a face's artwork (and drops patterns that only touched it). */
export function clearFace(m: CubeModel, f: FaceId): CubeModel {
  const cleared = withFace(m, f, { elements: [] });
  return { ...cleared, patterns: cleared.patterns.filter((p) => !p.fragments.some((fr) => fr.face === f)) };
}
