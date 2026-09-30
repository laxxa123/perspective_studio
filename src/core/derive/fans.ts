// Guide fans from each VP (the "Guides" backdrop for sketching, SK-05).
import type { Paper } from '../document/types';
import type { PerspectiveSystem } from '../perspective/types';
import type { RenderItem } from './renderModel';

const FAN_LINES = 24;

/** Lines from each VP through evenly spaced points around the paper edge. */
export function guideRays(ps: PerspectiveSystem, paper: Paper): RenderItem[] {
  const out: RenderItem[] = [];
  const reach = Math.max(paper.width, paper.height) * 20;
  const vps: { f: 'L' | 'R' | 'V'; x: number; y: number | null }[] = [
    { f: 'L', x: ps.vpLeftX, y: ps.horizonY },
    { f: 'R', x: ps.vpRightX, y: ps.horizonY },
    { f: 'V', x: ps.verticalX, y: ps.mode === '3pt' ? ps.vpVerticalY : null },
  ];
  for (const vp of vps) {
    for (let i = 0; i <= FAN_LINES; i++) {
      const t = i / FAN_LINES;
      if (vp.y === null) {
        // VP-V at infinity: verticals across the paper.
        const x = t * paper.width;
        out.push({ key: `fan:V:${i}`, role: 'ray', family: 'V', points: [x, -reach, x, reach] });
        continue;
      }
      // Aim at points along the far side of the paper (left/right edge for VP-L/VP-R, bottom/top for VP-V).
      const target =
        vp.f === 'V'
          ? { x: t * paper.width, y: vp.y > ps.horizonY ? 0 : paper.height }
          : { x: vp.f === 'L' ? paper.width : 0, y: -paper.height + t * 3 * paper.height };
      const dx = target.x - vp.x;
      const dy = target.y - vp.y;
      const len = Math.hypot(dx, dy) || 1;
      out.push({ key: `fan:${vp.f}:${i}`, role: 'ray', family: vp.f, points: [vp.x, vp.y, vp.x + (dx / len) * reach, vp.y + (dy / len) * reach] });
    }
  }
  return out;
}
