// Perspective tool (PS-03, §10.4, §10.5): drags VP-L, VP-R, VP-V, the horizon
// and the anchor, clamped to valid systems, with a haptic tick on clamp.
// A drag is one SetPerspective command (one history entry).
import { add2, dist2, sub2, type Vec2, type Vec3 } from '../core/math/vec';
import {
  deriveCamera,
  dragHandle,
  pinWorldPoint,
  pointHandles,
  project,
  unitLengthAtOrigin,
  withScaleLock,
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

export interface PerspectiveDeps {
  getPerspective: () => PerspectiveSystem;
  getViewport: () => Viewport;
  /** Starts the drag transaction. */
  begin: () => void;
  /** Live change within the transaction. */
  preview: (ps: PerspectiveSystem) => void;
  commit: () => void;
  cancel: () => void;
  setDragging: (h: PerspectiveHandleId | null) => void;
  haptics: HapticsPort;
  /** Called when a drag starts (SK-06 warning). */
  onDragStart?: () => void;
  /** PS-09: keep the unit-cube size during VP drags. */
  scaleLock?: () => boolean;
  /** PS-10: the world point to keep in place during VP drags, if any. */
  pinTarget?: () => Vec3 | null;
}

/** Handles whose drag re-aims the camera (scale lock and pin apply to these). */
const VP_HANDLES: PerspectiveHandleId[] = ['vpL', 'vpR', 'vpV', 'cv'];

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

export function createPerspectiveTool(deps: PerspectiveDeps): PerspectiveTool {
  let drag: {
    id: PerspectiveHandleId;
    grab: Vec2;
    clamped: boolean;
    current: PerspectiveSystem;
    unit: number;
    pin: { P: Vec3; q: Vec2 } | null;
  } | null = null;

  const startDrag = (id: PerspectiveHandleId, pointerPp: Vec2) => {
    const ps = deps.getPerspective();
    const P = VP_HANDLES.includes(id) ? (deps.pinTarget?.() ?? null) : null;
    const q = P ? project(deriveCamera(ps), P) : null;
    drag = {
      id,
      grab: sub2(handlePosition(ps, id, pointerPp), pointerPp),
      clamped: false,
      current: ps,
      unit: unitLengthAtOrigin(ps),
      pin: P && q ? { P, q } : null,
    };
    deps.begin();
    deps.setDragging(id);
    deps.onDragStart?.();
  };

  return {
    startDrag,
    down(i) {
      const id = hitHandle(deps.getPerspective(), deps.getViewport(), i.screen);
      if (id) startDrag(id, i.pp);
    },
    move(i) {
      if (!drag) return;
      const r = dragHandle(drag.current, drag.id, add2(i.pp, drag.grab));
      if (r.clamped && !drag.clamped) deps.haptics.tick();
      drag.clamped = r.clamped;
      let next = r.ps;
      if (VP_HANDLES.includes(drag.id)) {
        if (deps.scaleLock?.()) next = withScaleLock(next, drag.unit);
        if (drag.pin) next = pinWorldPoint(next, drag.pin.P, drag.pin.q);
      }
      drag.current = next;
      deps.preview(next);
    },
    up() {
      if (!drag) return;
      deps.commit();
      drag = null;
      deps.setDragging(null);
    },
    cancel() {
      if (!drag) return;
      deps.cancel();
      drag = null;
      deps.setDragging(null);
    },
  };
}
