// Drawings of question items and the whole question sheet (OBJECTS §A.6,
// §57, §58): one pure renderer for the Studio, the preview, the Question
// Bank thumbnails and every export. Line style: black on white, no shading.
import { questionRef } from '../../../shared/ids/questionId';
import { key } from './blocks';
import type { Figure } from './figure';
import { regions, type FoldSpec, type Hole } from './fold';
import { isoSvg } from './iso';
import type { Grid } from './space';
import { RULES, stemItems, type Item, type Question } from './questions';

const INK = '#111';
const FAINT = '#ced4da';
const TINT = '#adb5bd';
const r2 = (v: number) => Math.round(v * 100) / 100;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Places a drawing (a whole <svg>) at x, y in a box of w × h. */
function place(inner: string, x: number, y: number, w: number, h: number): string {
  const vb = /viewBox="([^"]+)"/.exec(inner)?.[1] ?? `0 0 ${w} ${h}`;
  return inner.replace(/^<svg[^>]*>/, `<svg x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" viewBox="${vb}">`);
}

function squares(cols: number, rows: number, size: number, filled: (c: number, r: number) => string | null, extra = ''): string {
  const cell = (size * 0.84) / Math.max(cols, rows, 1);
  const ox = (size - cols * cell) / 2;
  const oy = (size - rows * cell) / 2;
  let body = `<rect width="${size}" height="${size}" fill="#fff"/>`;
  for (let c = 0; c <= cols; c++) body += `<line x1="${r2(ox + c * cell)}" y1="${r2(oy)}" x2="${r2(ox + c * cell)}" y2="${r2(oy + rows * cell)}" stroke="${FAINT}" stroke-width="1"/>`;
  for (let r = 0; r <= rows; r++) body += `<line x1="${r2(ox)}" y1="${r2(oy + r * cell)}" x2="${r2(ox + cols * cell)}" y2="${r2(oy + r * cell)}" stroke="${FAINT}" stroke-width="1"/>`;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const f = filled(c, r);
      if (f) body += `<rect x="${r2(ox + c * cell)}" y="${r2(oy + r * cell)}" width="${r2(cell)}" height="${r2(cell)}" fill="${f}" stroke="${INK}" stroke-width="1.4"/>`;
    }
  return body + extra.replaceAll('{cell}', String(cell)).replaceAll('{ox}', String(ox)).replaceAll('{oy}', String(oy));
}

/** A view / cut: covered squares outlined, light fill. */
export function gridSvg(g: Grid, size = 120): string {
  const on = new Set(g.cells.map((c) => c.join(',')));
  return svg(size, size, squares(g.w, g.h, size, (c, r) => (on.has(`${c},${r}`) ? '#e9ecef' : null)) + holeMarks(g.holes ?? [], g.w, g.h, size, '#495057'));
}

/** A 2D figure: filled squares dark, marks white on dark or dark on white. */
export function figureSvg(f: Figure, size = 120): string {
  const on = new Set(f.cells.map((c) => c.join(',')));
  const cell = (size * 0.84) / f.n;
  const ox = (size - f.n * cell) / 2;
  let marks = '';
  for (const m of f.marks) {
    const cx = ox + (m.c + 0.5) * cell;
    const cy = ox + (m.r + 0.5) * cell;
    const col = on.has(`${m.c},${m.r}`) ? '#fff' : INK;
    if (m.kind === 'dot') marks += `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(cell * 0.2)}" fill="${col}"/>`;
    else {
      const a = (m.dir * Math.PI) / 2;
      const p = (dx: number, dy: number) => `${r2(cx + dx * Math.cos(a) - dy * Math.sin(a))},${r2(cy + dx * Math.sin(a) + dy * Math.cos(a))}`;
      const s = cell * 0.32;
      marks += `<polygon points="${p(0, -s)} ${p(s * 0.8, s * 0.7)} ${p(-s * 0.8, s * 0.7)}" fill="${col}"/>`;
    }
  }
  return svg(size, size, squares(f.n, f.n, size, (c, r) => (on.has(`${c},${r}`) ? '#343a40' : null)) + marks);
}

/** An opened sheet with its holes. */
export function holesSvg(n: number, holes: readonly Hole[], size = 120): string {
  const cell = (size * 0.84) / n;
  const o = (size - n * cell) / 2;
  const dots = holes.map(([c, r]) => `<circle cx="${r2(o + (c + 0.5) * cell)}" cy="${r2(o + (r + 0.5) * cell)}" r="${r2(cell * 0.28)}" fill="${INK}"/>`).join('');
  return svg(size, size, `<rect width="${size}" height="${size}" fill="#fff"/><rect x="${r2(o)}" y="${r2(o)}" width="${r2(n * cell)}" height="${r2(n * cell)}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>${dots}`);
}

/** The folding steps: the sheet before each fold (fold line dashed), then folded and punched. */
export function foldsSvg(spec: FoldSpec, panel = 110): string {
  const rs = regions(spec);
  const steps = spec.folds.length + 1;
  const w = steps * panel;
  let body = `<rect width="${w}" height="${panel}" fill="#fff"/>`;
  const cell = (panel * 0.8) / spec.n;
  for (let i = 0; i < steps; i++) {
    const g = rs[i];
    const x0 = i * panel + (panel - spec.n * cell) / 2;
    const y0 = (panel - spec.n * cell) / 2;
    const W = g.w * cell;
    const H = g.h * cell;
    body += g.tri
      ? `<polygon points="${r2(x0)},${r2(y0)} ${r2(x0 + W)},${r2(y0)} ${r2(x0 + W)},${r2(y0 + H)}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`
      : `<rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(W)}" height="${r2(H)}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
    const f = spec.folds[i];
    if (f) {
      const dash = `stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 3"`;
      if (f === 'v') body += `<line x1="${r2(x0 + W / 2)}" y1="${r2(y0)}" x2="${r2(x0 + W / 2)}" y2="${r2(y0 + H)}" ${dash}/><path d="M${r2(x0 + W * 0.85)} ${r2(y0 + H * 0.5)} q ${r2(-W * 0.2)} ${r2(-H * 0.25)} ${r2(-W * 0.45)} 0" fill="none" stroke="${INK}" stroke-width="1.2" marker-end="url(#ah)"/>`;
      if (f === 'h') body += `<line x1="${r2(x0)}" y1="${r2(y0 + H / 2)}" x2="${r2(x0 + W)}" y2="${r2(y0 + H / 2)}" ${dash}/><path d="M${r2(x0 + W * 0.5)} ${r2(y0 + H * 0.85)} q ${r2(W * 0.25)} ${r2(-H * 0.2)} 0 ${r2(-H * 0.45)}" fill="none" stroke="${INK}" stroke-width="1.2" marker-end="url(#ah)"/>`;
      if (f === 'd') body += `<line x1="${r2(x0)}" y1="${r2(y0)}" x2="${r2(x0 + W)}" y2="${r2(y0 + H)}" ${dash}/><path d="M${r2(x0 + W * 0.2)} ${r2(y0 + H * 0.8)} q ${r2(W * 0.05)} ${r2(-H * 0.4)} ${r2(W * 0.45)} ${r2(-H * 0.45)}" fill="none" stroke="${INK}" stroke-width="1.2" marker-end="url(#ah)"/>`;
    } else {
      body += spec.holes.map(([c, r]) => `<circle cx="${r2(x0 + (c + 0.5) * cell)}" cy="${r2(y0 + (r + 0.5) * cell)}" r="${r2(cell * 0.28)}" fill="${INK}"/>`).join('');
    }
  }
  const defs = `<defs><marker id="ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${INK}"/></marker></defs>`;
  return svg(w, panel, defs + body);
}

export function numberSvg(v: number, size = 120): string {
  return svg(size, size, `<rect width="${size}" height="${size}" fill="#fff"/><text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${r2(size * 0.38)}" fill="${INK}">${v}</text>`);
}

export function pairSvg(a: Item & { kind: 'pair' }, size = 120): string {
  const half = size * 0.48;
  return svg(
    size,
    size,
    `<rect width="${size}" height="${size}" fill="#fff"/>${place(isoSvg(a.a, { size: 120, stroke: 1.6, holes: a.ha ?? [] }), 0, (size - half) / 2, half, half)}<text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${r2(size * 0.14)}" fill="${INK}">+</text>${place(isoSvg(a.b, { size: 120, stroke: 1.6, holes: a.hb ?? [] }), size - half, (size - half) / 2, half, half)}`,
  );
}

/** Any item, as a drawing about `size` px (the fold steps are wider). */
export function itemSvg(i: Item, size = 120): string {
  switch (i.kind) {
    case 'blocks':
      return isoSvg(i.blocks, { size, stroke: size < 90 ? 1.1 : 1.5, fills: new Map((i.tint ?? []).map((c) => [key(c), TINT])), holes: i.holes ?? [] });
    case 'grid':
      return gridSvg(i.grid, size);
    case 'figure':
      return figureSvg(i.figure, size);
    case 'holes':
      return holesSvg(i.n, i.holes, size);
    case 'number':
      return numberSvg(i.value, size);
    case 'pair':
      return pairSvg(i, size);
    case 'folds':
      return foldsSvg(i.spec, size);
  }
}

/** Wraps text to lines of about `n` characters. */
function wrap(t: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of t.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > n && line) {
      out.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

/** The question sheet: stem, its figures, five numbered options; in author mode the answer and each option's rule. */
export function questionSheet(q: Question, o: { author?: boolean } = {}): string {
  const W = 720;
  const pad = 24;
  const lines = wrap(q.stem, 62);
  let y = pad;
  let body = '';
  if (q.questionId) {
    body += `<text x="${pad}" y="${y + 12}" font-family="system-ui, sans-serif" font-size="12" fill="#868e96">${esc(questionRef(q.questionId, q.version))}</text>`;
    y += 22;
  }
  for (const l of lines) {
    body += `<text x="${pad}" y="${y + 18}" font-family="system-ui, sans-serif" font-size="18" fill="${INK}">${esc(l)}</text>`;
    y += 26;
  }
  y += 8;
  const stem = stemItems(q.family, q.source, q.params);
  const sh = 200;
  const widths = stem.map((i) => (i.kind === 'folds' ? (i.spec.folds.length + 1) * 130 : sh));
  let x = (W - widths.reduce((a, b) => a + b + 16, -16)) / 2;
  stem.forEach((it, k) => {
    const d = it.kind === 'folds' ? foldsSvg(it.spec, 130) : itemSvg(it, sh);
    body += place(d, x, y, widths[k], it.kind === 'folds' ? 130 : sh);
    if (it.kind === 'grid' && it.label) body += `<text x="${r2(x + widths[k] / 2)}" y="${y + sh + 14}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#495057">${esc(it.label)}</text>`;
    x += widths[k] + 16;
  });
  y += (stem.some((i) => i.kind === 'folds') ? 130 : sh) + (stem.some((i) => i.kind === 'grid') ? 24 : 12);
  const os = 124;
  const gap = (W - 2 * pad - 5 * os) / 4;
  q.options.forEach((opt, k) => {
    const ox = pad + k * (os + gap);
    const right = o.author && k === q.correct;
    body += `<rect x="${r2(ox - 2)}" y="${y - 2}" width="${os + 4}" height="${os + 4}" rx="8" fill="none" stroke="${right ? '#2f9e44' : '#dee2e6'}" stroke-width="${right ? 2.5 : 1}"/>`;
    body += place(itemSvg(opt.item, os), ox, y, os, os);
    body += `<text x="${r2(ox + os / 2)}" y="${y + os + 20}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="${INK}">${k + 1}${right ? ' ✓' : ''}</text>`;
    if (o.author) body += `<text x="${r2(ox + os / 2)}" y="${y + os + 36}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="#868e96">${esc(opt.rule === 'correct' ? 'Correct' : `${opt.rule} ${RULES[opt.rule] ?? ''}`)}</text>`;
  });
  y += os + (o.author ? 48 : 32);
  if (o.author && q.explanation.length) {
    for (const l of q.explanation.flatMap((e) => wrap(e, 84))) {
      body += `<text x="${pad}" y="${y + 12}" font-family="system-ui, sans-serif" font-size="12" fill="#495057">${esc(l)}</text>`;
      y += 18;
    }
    y += 8;
  }
  return svg(W, y + pad - 8, `<rect width="${W}" height="${y + pad}" fill="#fff"/>${body}`);
}

/** The folded sheet, for punching: its cells (outside a diagonal fold greyed) and the holes. */
export function foldedSvg(spec: FoldSpec, size = 240): string {
  const last = regions(spec).at(-1)!;
  return svg(size, size, squares(last.w, last.h, size, (c, r) => (last.tri && c < r ? '#dee2e6' : '#fff')) + holeMarks(spec.holes, last.w, last.h, size));
}

function holeMarks(holes: readonly (readonly [number, number])[], cols: number, rows: number, size: number, fill = INK): string {
  const cell = (size * 0.84) / Math.max(cols, rows, 1);
  const ox = (size - cols * cell) / 2;
  const oy = (size - rows * cell) / 2;
  return holes.map(([c, r]) => `<circle cx="${r2(ox + (c + 0.5) * cell)}" cy="${r2(oy + (r + 0.5) * cell)}" r="${r2(cell * 0.28)}" fill="${fill}" stroke="${INK}" stroke-width="1"/>`).join('');
}
