// SVG rendering of the CubeModel (pure strings, no DOM): face textures for the
// 3D cube, question figures (corner views, nets), and export (CUBE §47).
import type { ArtworkElement, CubeModel, FaceId, NetCell } from '../model/CubeModel';
import type { Figure } from '../model/QuestionModel';
import type { V3 } from '../geometry/CubeGeometry';
import { VIEW_SLOTS, type CubeView } from '../geometry/FoldingEngine';
import { compose, faceToCell, transformAffine, type Affine } from '../geometry/Orientation';

export type AssetData = Record<string, string>;

const n = (x: number) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 10000) / 10000));
const mat = (m: Affine) => `matrix(${m.map(n).join(' ')})`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let clipSeq = 0;

/** One element in element-local units (its transform applied by the caller). */
function elementBody(e: ArtworkElement, assets: AssetData): string {
  if (e.kind === 'text') {
    // Set at 100× and scaled down: tiny font sizes render poorly in some engines.
    return `<g transform="scale(0.01)"><text x="0" y="0" font-size="${n((e.fontSize ?? 0.5) * 100)}" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${esc(e.fill ?? '#212529')}">${esc(e.text ?? '')}</text></g>`;
  }
  if (e.kind === 'image') {
    const href = e.assetId ? assets[e.assetId] : undefined;
    if (!href) return `<rect x="${n(-e.w / 2)}" y="${n(-e.h / 2)}" width="${n(e.w)}" height="${n(e.h)}" fill="#dee2e6"/>`;
    const c = e.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const iw = e.w / c.w;
    const ih = e.h / c.h;
    const id = `ic${++clipSeq}`;
    return `<clipPath id="${id}"><rect x="${n(-e.w / 2)}" y="${n(-e.h / 2)}" width="${n(e.w)}" height="${n(e.h)}"/></clipPath><image clip-path="url(#${id})" href="${esc(href)}" x="${n(-e.w / 2 - c.x * iw)}" y="${n(-e.h / 2 - c.y * ih)}" width="${n(iw)}" height="${n(ih)}" preserveAspectRatio="none"/>`;
  }
  const fill = e.fill === undefined ? 'none' : (e.fill ?? 'none');
  const stroke = e.stroke ?? 'none';
  return `<path d="${esc(e.path ?? '')}" fill="${esc(fill)}" stroke="${esc(stroke)}" stroke-width="${n(e.strokeWidth ?? 0)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const placed = (e: ArtworkElement, t = e.transform, assets: AssetData) =>
  `<g transform="${mat(transformAffine(t))}" opacity="${n(e.opacity)}">${elementBody(e, assets)}</g>`;

/** A face's content in face-local units (unit square), clipped to the face. */
export function faceContent(m: CubeModel, f: FaceId, assets: AssetData, opts: { label?: boolean } = {}): string {
  const face = m.faces[f];
  const id = `fc${++clipSeq}`;
  const parts = [`<clipPath id="${id}"><rect x="0" y="0" width="1" height="1"/></clipPath><g clip-path="url(#${id})">`];
  parts.push(`<rect x="0" y="0" width="1" height="1" fill="${esc(face.background)}" fill-opacity="${n(face.backgroundOpacity)}"/>`);
  if (opts.label) parts.push(`<g transform="scale(0.01)"><text x="6" y="12" font-size="10" font-family="system-ui, sans-serif" fill="#adb5bd">${f}</text></g>`);
  for (const e of face.elements) parts.push(placed(e, e.transform, assets));
  for (const p of m.patterns) for (const fr of p.fragments) if (fr.face === f) parts.push(placed(p.element, fr.transform, assets));
  parts.push('</g>');
  return parts.join('');
}

/** A standalone face image (texture source), `px` pixels square. */
export function faceSvg(m: CubeModel, f: FaceId, assets: AssetData, px = 512, opts: { label?: boolean } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 1 1">${faceContent(m, f, assets, opts)}<rect x="0" y="0" width="1" height="1" fill="none" stroke="#343a40" stroke-width="0.012"/></svg>`;
}

// ----- figures -----

/** Isometric projection of the unit cube seen from (1, −1, 1). */
const proj = (p: V3) => ({ x: (p[0] + p[1]) / Math.SQRT2, y: (p[0] - p[1] - 2 * p[2]) / Math.sqrt(6) });
const SHADE: Record<string, number> = { top: 0, front: 0.06, right: 0.16 };

/** A corner view of the cube (CUBE §23), in a box of `size` units. */
export function cubeViewSvgBody(m: CubeModel, view: CubeView, assets: AssetData): { body: string; box: [number, number, number, number] } {
  const parts: string[] = [];
  VIEW_SLOTS.forEach((slot, i) => {
    const s = view[i];
    const ax = proj(slot.refX);
    const ay = proj(slot.refY);
    const o = proj(slot.origin);
    const toScreen: Affine = [ax.x, ax.y, ay.x, ay.y, o.x, o.y];
    const m2 = compose(toScreen, faceToCell(s.turns, s.mirrored));
    parts.push(`<g transform="${mat(m2)}">${faceContent(m, s.face, assets)}</g>`);
    const shade = SHADE[slot.name];
    parts.push(`<g transform="${mat(toScreen)}"><rect x="0" y="0" width="1" height="1" fill="#000" fill-opacity="${shade}" stroke="#212529" stroke-width="0.018" stroke-linejoin="round"/></g>`);
  });
  const xs = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => proj([x, y, z]))));
  const minX = Math.min(...xs.map((p) => p.x));
  const minY = Math.min(...xs.map((p) => p.y));
  return { body: parts.join(''), box: [minX, minY, Math.max(...xs.map((p) => p.x)) - minX, Math.max(...xs.map((p) => p.y)) - minY] };
}

export function netSvgBody(m: CubeModel, cells: readonly NetCell[], assets: AssetData, opts: { label?: boolean } = {}): { body: string; box: [number, number, number, number] } {
  const parts: string[] = [];
  for (const c of cells) {
    const place = compose([1, 0, 0, 1, c.col, c.row], faceToCell(c.turns, c.mirrored));
    parts.push(`<g transform="${mat(place)}">${faceContent(m, c.face, assets, opts)}</g>`);
    parts.push(`<rect x="${c.col}" y="${c.row}" width="1" height="1" fill="none" stroke="#212529" stroke-width="0.025"/>`);
  }
  const x0 = Math.min(...cells.map((c) => c.col));
  const y0 = Math.min(...cells.map((c) => c.row));
  const x1 = Math.max(...cells.map((c) => c.col + 1));
  const y1 = Math.max(...cells.map((c) => c.row + 1));
  return { body: parts.join(''), box: [x0, y0, x1 - x0, y1 - y0] };
}

export function figureBody(m: CubeModel, f: Figure, assets: AssetData) {
  return f.kind === 'cube' ? cubeViewSvgBody(m, f.view, assets) : netSvgBody(m, f.cells, assets);
}

/** A figure as a standalone SVG document. */
export function figureSvg(m: CubeModel, f: Figure, assets: AssetData, px = 240): string {
  const { body, box } = figureBody(m, f, assets);
  const pad = 0.08 * Math.max(box[2], box[3]);
  const vb = [box[0] - pad, box[1] - pad, box[2] + 2 * pad, box[3] + 2 * pad];
  const h = Math.round((px * vb[3]) / vb[2]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${h}" viewBox="${vb.map(n).join(' ')}">${body}</svg>`;
}

/** A whole question sheet: prompt, stem, five numbered options (export, CUBE §47). */
export function questionSheetSvg(
  q: { questionId: string | null; version: number; presentation: { prompt: string; stem: Figure[] }; options: { figure: Figure }[]; spatialModel: CubeModel },
  assets: AssetData,
): string {
  const W = 1000;
  const cell = 180;
  const parts: string[] = [];
  let y = 40;
  parts.push(`<rect width="${W}" height="100%" fill="#ffffff"/>`);
  parts.push(`<text x="40" y="${y}" font-size="22" font-family="system-ui, sans-serif" fill="#212529">${esc(q.questionId ? `${q.questionId} · v${q.version}` : 'Draft question')}</text>`);
  y += 36;
  parts.push(`<text x="40" y="${y}" font-size="24" font-weight="600" font-family="system-ui, sans-serif" fill="#212529">${esc(q.presentation.prompt)}</text>`);
  y += 24;
  const place = (f: Figure, x: number, top: number, w: number) => {
    const { body, box } = figureBody(q.spatialModel, f, assets);
    const s = Math.min(w / box[2], w / box[3]);
    parts.push(`<g transform="translate(${n(x + (w - box[2] * s) / 2)} ${n(top + (w - box[3] * s) / 2)}) scale(${n(s)}) translate(${n(-box[0])} ${n(-box[1])})">${body}</g>`);
  };
  q.presentation.stem.forEach((f, i) => place(f, 40 + i * 300, y, 260));
  y += 300;
  q.options.forEach((o, i) => {
    const x = 20 + i * (cell + 15);
    parts.push(`<text x="${x + cell / 2}" y="${y}" font-size="20" text-anchor="middle" font-family="system-ui, sans-serif" fill="#212529">(${i + 1})</text>`);
    place(o.figure, x, y + 10, cell);
  });
  const H = y + cell + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}
