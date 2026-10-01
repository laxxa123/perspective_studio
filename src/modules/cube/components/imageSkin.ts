// Image placement as a board-wide skin (CUBE §13, v1.2): the picture first
// covers the whole board; the author moves / scales / turns it, then Done
// trims it to the faces (one pattern across every face it covers).
import { pickFile } from '../../../platform/files';
import { boardSize, anchorCell } from '../geometry/Board';
import { faceToNet, invert, mapTransform } from '../geometry/Orientation';
import { overlappingFaces } from '../geometry/PatternContinuity';
import type { ArtworkElement } from '../model/CubeModel';
import { place } from '../model/edit';
import { uid } from '../model/ids';
import { importImage } from '../services/CubeService';
import { useCubeStore, type Skin } from '../state/useCubeStore';

const st = useCubeStore.getState;

/** Picks a picture and lays it over the whole board, ready to adjust. */
export async function startImageSkin() {
  const before = st().tool;
  st().set({ tool: 'image', selected: null });
  const file = await pickFile('image/*');
  if (!file) {
    st().set({ tool: before === 'image' ? 'select' : before });
    return;
  }
  try {
    const a = await importImage(file);
    st().addAsset(a.id, a.data);
    const size = boardSize(st().model!.net.cells);
    let w = size.cols;
    let h = w / a.aspect;
    if (h > size.rows) {
      h = size.rows;
      w = h * a.aspect;
    }
    st().set({ skin: { assetId: a.id, x: size.cols / 2, y: size.rows / 2, w, h, rotation: 0 } });
  } catch (e) {
    st().set({ tool: 'select' });
    st().showToast(e instanceof Error ? e.message : String(e));
  }
}

/** The skin as an image element in a face's frame, trimmed to the faces by placing it. */
export function finishImageSkin() {
  const s = st();
  const skin = s.skin;
  const m = s.model;
  if (!skin || !m) return;
  const cells = m.net.cells;
  const corners = skinCorners(skin);
  const anchor = anchorCell(cells, corners);
  const local = mapTransform({ x: skin.x, y: skin.y, rotation: skin.rotation, scaleX: 1, scaleY: 1 }, invert(faceToNet(anchor)));
  const el: ArtworkElement = { id: uid('el'), kind: 'image', assetId: skin.assetId, transform: local, w: skin.w, h: skin.h, opacity: 1 };
  if (!overlappingFaces(el, el.transform, anchor.face, m.net).length) {
    s.showToast('Move the picture over the faces first.');
    return;
  }
  const r = place(m, anchor.face, el);
  s.apply(r.model);
  s.set({ skin: null, tool: 'select', selected: r.ref, selectedFace: r.ref.face });
}

export function cancelImageSkin() {
  st().set({ skin: null, tool: 'select' });
}

function skinCorners(k: Skin) {
  const r = (k.rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const x = (sx * k.w) / 2;
    const y = (sy * k.h) / 2;
    return { x: k.x + x * c - y * s, y: k.y + x * s + y * c };
  });
}
