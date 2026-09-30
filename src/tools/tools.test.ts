import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERSPECTIVE, type PerspectiveSystem } from '../core/perspective';
import { toScreen, type Viewport } from '../core/viewport/viewport';
import { createPerspectiveTool, hitHandle } from './perspectiveTool';
import type { ToolInput } from './types';

const viewport: Viewport = { offsetX: -800, offsetY: 0, zoom: 0.25 };

function setup() {
  let ps: PerspectiveSystem = DEFAULT_PERSPECTIVE;
  const tick = vi.fn();
  const commit = vi.fn();
  const tool = createPerspectiveTool({
    getPerspective: () => ps,
    setPerspective: (p) => (ps = p),
    getViewport: () => viewport,
    setDragging: () => undefined,
    haptics: { tick },
    commit,
  });
  const at = (pp: { x: number; y: number }): ToolInput => ({
    pp,
    screen: toScreen(viewport, pp),
    pointerType: 'touch',
    pressure: 1,
    buttons: 1,
  });
  return { tool, at, get: () => ps, tick, commit };
}

describe('perspective tool (PS-03)', () => {
  it('hits VPs within the touch radius, then the horizon, else nothing', () => {
    const ps = DEFAULT_PERSPECTIVE;
    const vpl = toScreen(viewport, { x: ps.vpLeftX, y: ps.horizonY });
    expect(hitHandle(ps, viewport, { x: vpl.x + 10, y: vpl.y + 10 })).toBe('vpL');
    const mid = toScreen(viewport, { x: 600, y: ps.horizonY });
    expect(hitHandle(ps, viewport, { x: mid.x, y: mid.y + 12 })).toBe('horizon');
    expect(hitHandle(ps, viewport, { x: mid.x, y: mid.y + 200 })).toBeNull();
  });

  it('drags a VP without jumping to the finger, and commits once', () => {
    const t = setup();
    t.tool.down(t.at({ x: -690, y: 285 })); // a little off VP-L
    t.tool.move(t.at({ x: -890, y: 285 }));
    expect(t.get().vpLeftX).toBeCloseTo(-900);
    t.tool.up(t.at({ x: -890, y: 285 }));
    expect(t.commit).toHaveBeenCalledTimes(1);
  });

  it('ticks once when a drag starts clamping', () => {
    const t = setup();
    t.tool.down(t.at({ x: 600, y: 3200 }));
    t.tool.move(t.at({ x: 600, y: 320 }));
    t.tool.move(t.at({ x: 600, y: 310 }));
    expect(t.tick).toHaveBeenCalledTimes(1);
  });

  it('restores the system when cancelled (second finger)', () => {
    const t = setup();
    t.tool.down(t.at({ x: 1900, y: 280 }));
    t.tool.move(t.at({ x: 2500, y: 280 }));
    t.tool.cancel();
    expect(t.get()).toBe(DEFAULT_PERSPECTIVE);
  });

  it('ignores presses away from any handle', () => {
    const t = setup();
    t.tool.down(t.at({ x: 600, y: 1500 }));
    t.tool.move(t.at({ x: 700, y: 1600 }));
    t.tool.up(t.at({ x: 700, y: 1600 }));
    expect(t.get()).toBe(DEFAULT_PERSPECTIVE);
    expect(t.commit).not.toHaveBeenCalled();
  });
});
