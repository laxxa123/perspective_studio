// Perspective tool (PS-03, §10.4, §10.5): drags VP-L, VP-R, VP-V, the horizon
// and the anchor, clamped to valid systems, with a haptic tick on clamp.
import { dist2, sub2, add2, type Vec2 } from '../core/math/vec';
import {
  dragHandle,
  pointHandles,
  type PerspectiveHandleId,
  type PerspectiveSystem,
} from '../core/perspective';
import { toScreen, type Viewport } from '../core/viewport/viewport';
import type { HapticsPort } from '../platform/haptics';
import type { Tool } from './types';

/** Touch radius of a handle, screen px (≥ 44 px targets, §10.5). */
export const HANDLE_HIT_PX = 26;
/** Touch half-width of the horizon line, screen px. */
export const HORIZON_HIT_PX = 20;

interface Deps {
  getPerspective: () => PerspectiveSystem;
  setPerspective: (ps: PerspectiveSystem) => void;
  getViewport: () => Viewport;
  setDragging: (h: PerspectiveHandleId | null) => void;
  haptics: HapticsPort;
  /** Called once per finished drag (M3: becomes a SetPerspective command). */
  commit?: (before: PerspectiveSystem, after: PerspectiveSystem) => void;
}

/** The handle under a screen point: point handles first, then the horizon. */
export function hitHandle(ps: PerspectiveSystem, v: Viewport, screen: Vec2): PerspectiveHandleId | null {
  let best: PerspectiveHandleId | null = null;
  let bestD = HANDLE_HIT_PX;
  for (const h of pointHandles(ps)) {
    const d = dist2(toScreen(v, h.point), screen);
    if (d <= bestD) {
      bestD = d;
      best = h.id;
    }
  }
  if (best) return best;
  const horizonScreenY = toScreen(v, { x: 0, y: ps.horizonY }).y;
  return Math.abs(horizonScreenY - screen.y) <= HORIZON_HIT_PX ? 'horizon' : null;
}

function handlePosition(ps: PerspectiveSystem, id: PerspectiveHandleId, pointer: Vec2): Vec2 {
  if (id === 'horizon') return { x: pointer.x, y: ps.horizonY };
  return pointHandles(ps).find((h) => h.id === id)?.point ?? pointer;
}

export interface PerspectiveTool extends Tool {
  /** Starts dragging a handle directly (off-screen chips, §10.5). */
  startDrag(id: PerspectiveHandleId, pointerPp: Vec2): void;
}

export function createPerspectiveTool(deps: Deps): PerspectiveTool {
  let drag: { id: PerspectiveHandleId; grab: Vec2; before: PerspectiveSystem; clamped: boolean } | null = null;

  const startDrag = (id: PerspectiveHandleId, pointerPp: Vec2) => {
    const ps = deps.getPerspective();
    drag = { id, grab: sub2(handlePosition(ps, id, pointerPp), pointerPp), before: ps, clamped: false };
    deps.setDragging(id);
  };

  return {
    startDrag,
    down(i) {
      const id = hitHandle(deps.getPerspective(), deps.getViewport(), i.screen);
      if (id) startDrag(id, i.pp);
    },
    move(i) {
      if (!drag) return;
      const r = dragHandle(deps.getPerspective(), drag.id, add2(i.pp, drag.grab));
      if (r.clamped && !drag.clamped) deps.haptics.tick();
      drag.clamped = r.clamped;
      deps.setPerspective(r.ps);
    },
    up() {
      if (!drag) return;
      deps.commit?.(drag.before, deps.getPerspective());
      drag = null;
      deps.setDragging(null);
    },
    cancel() {
      if (!drag) return;
      deps.setPerspective(drag.before);
      drag = null;
      deps.setDragging(null);
    },
  };
}
