// SVG export (EXP-02): serializes the RenderModel directly, so vectors are
// exact; cropped to the paper; styled from the theme.
import type { RenderItem, RenderModel } from '../core/derive/renderModel';
import type { Rect } from '../core/viewport/viewport';
import { WEIGHTS, withAlpha, type Theme } from '../theme/theme';

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pts(p: number[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < p.length; i += 2) out.push(`${n(p[i])},${n(p[i + 1])}`);
  return out.join(' ');
}

function itemSvg(it: RenderItem, theme: Theme, px: number): string {
  const fam = it.family ? theme.family[it.family] : theme.edge;
  const op = Number(it.data?.layerOpacity ?? 1);
  switch (it.role) {
    case 'paper':
      return `<polygon points="${pts(it.points)}" fill="${theme.paper}" stroke="${theme.paperBorder}" stroke-width="${n(px)}"/>`;
    case 'horizon':
      return `<polyline points="${pts(it.points)}" fill="none" stroke="${theme.horizon}" stroke-width="${n(WEIGHTS.guide * px)}"/>`;
    case 'vp':
      return `<circle cx="${n(it.points[0])}" cy="${n(it.points[1])}" r="${n(WEIGHTS.vpRadius * px)}" fill="${fam}"/>`;
    case 'anchor':
      return `<polyline points="${pts(it.points)}" fill="none" stroke="${fam}" stroke-width="${n(2 * px)}"/>`;
    case 'ray': {
      const fan = it.key.startsWith('fan:');
      const dash = it.data?.dashed ? ` stroke-dasharray="${n(6 * px)} ${n(6 * px)}"` : '';
      return `<polyline points="${pts(it.points)}" fill="none" stroke="${withAlpha(fam, fan ? theme.fanAlpha : theme.rayAlpha)}" stroke-width="${n((fan ? WEIGHTS.fan : WEIGHTS.ray) * px)}"${dash}/>`;
    }
    case 'grid':
      return `<polyline points="${pts(it.points)}" fill="none" stroke="${it.data?.working ? withAlpha(theme.selection, 0.35) : withAlpha(fam, it.data?.major ? 0.35 : 0.14)}" stroke-width="${n((it.data?.major ? 1 : 0.6) * px)}"/>`;
    case 'cone':
      return `<polygon points="${pts(it.points)}" fill="none" stroke="${theme.muted}" stroke-width="${n(px)}" stroke-dasharray="${n(8 * px)} ${n(6 * px)}"/>`;
    case 'face':
      return it.data?.filled ? `<polygon points="${pts(it.points)}" fill="${withAlpha(fam, theme.faceAlpha)}" opacity="${op}"/>` : '';
    case 'edge':
      return `<polyline points="${pts(it.points)}" fill="none" stroke="${theme.edge}" stroke-width="${n(WEIGHTS.edge * px)}" stroke-linecap="round" opacity="${op}"/>`;
    case 'hiddenEdge':
      return `<polyline points="${pts(it.points)}" fill="none" stroke="${theme.hiddenEdge}" stroke-width="${n(WEIGHTS.hiddenEdge * px)}" stroke-dasharray="${n(6 * px)} ${n(5 * px)}" opacity="${op}"/>`;
    case 'stroke':
      return `<polygon points="${pts(it.points)}" fill="${esc(String(it.data?.color ?? theme.ink))}" opacity="${Number(it.data?.opacity ?? 1) * op}"/>`;
    default:
      return '';
  }
}

/**
 * The model as an SVG document of `frame` (pp). Screen-px weights are
 * converted with `pxPerPp` (how many pp one screen px of line weight is).
 */
export function renderModelToSvg(model: RenderModel, theme: Theme, frame: Rect, opts: { title: string; pxPerPp?: number }): string {
  const px = opts.pxPerPp ?? 1;
  const body = model.items.map((it) => itemSvg(it, theme, px)).filter(Boolean);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(frame.width)}" height="${n(frame.height)}" viewBox="${n(frame.x)} ${n(frame.y)} ${n(frame.width)} ${n(frame.height)}">`,
    `<title>${esc(opts.title)}</title>`,
    `<rect x="${n(frame.x)}" y="${n(frame.y)}" width="${n(frame.width)}" height="${n(frame.height)}" fill="${theme.paper}"/>`,
    ...body,
    '</svg>',
  ].join('\n');
}
