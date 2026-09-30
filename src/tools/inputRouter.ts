// The single input router (CV-02, §8.6, §10.3): normalizes pointer events,
// handles gestures itself (two-finger pan / pinch, two-finger tap = undo,
// three-finger tap = redo, wheel), and hands everything else to the active
// tool, one call per coalesced sample (SK-02). Tools never see raw events.
import { dist2, type Vec2 } from '../core/math/vec';
import { panBy, toPicture, zoomAt, type Viewport } from '../core/viewport/viewport';
import type { Tool, ToolInput } from './types';

interface RouterDeps {
  getViewport: () => Viewport;
  setViewport: (v: Viewport) => void;
  getTool: () => Tool;
  undo: () => void;
  redo: () => void;
  /** A pen has been seen (palm rejection). */
  onPen?: () => void;
}

type PointerKind = ToolInput['pointerType'];
const kindOf = (e: PointerEvent): PointerKind => (e.pointerType === 'pen' ? 'pen' : e.pointerType === 'touch' ? 'touch' : 'mouse');

const WHEEL_ZOOM = 0.0015;
const PINCH_ZOOM = 0.01;
/** Multi-finger taps: max duration and movement. */
const TAP_MS = 300;
const TAP_MOVE_PX = 12;

export function attachInputRouter(el: HTMLElement, deps: RouterDeps): () => void {
  const touches = new Map<number, Vec2>();
  let toolPointer: number | null = null;
  let gesture: { center: Vec2; d: number } | null = null;
  let tap: { start: number; fingers: number; moved: number } | null = null;
  let pan: Vec2 | null = null;

  const local = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const input = (e: PointerEvent): ToolInput => {
    const screen = local(e);
    const v = deps.getViewport();
    return {
      screen,
      pp: toPicture(v, screen),
      pointerType: kindOf(e),
      pressure: e.pressure,
      buttons: e.buttons,
      shift: e.shiftKey,
      pxToPp: 1 / v.zoom,
    };
  };
  const pinchState = () => {
    const [a, b] = [...touches.values()];
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.max(dist2(a, b), 1) };
  };

  const down = (e: PointerEvent) => {
    const kind = kindOf(e);
    if (kind === 'pen') deps.onPen?.();
    if (kind === 'touch') {
      touches.set(e.pointerId, local(e));
      if (!tap || touches.size === 1) tap = { start: e.timeStamp, fingers: touches.size, moved: 0 };
      else tap.fingers = Math.max(tap.fingers, touches.size);
    }
    if (touches.size >= 2) {
      if (toolPointer !== null) {
        deps.getTool().cancel();
        toolPointer = null;
      }
      pan = null;
      gesture = pinchState();
      return;
    }
    if (gesture) return;
    const tool = deps.getTool();
    // Middle mouse button pans; so does a finger when the tool asks (palm rejection).
    if ((kind === 'mouse' && e.button === 1) || (kind === 'touch' && tool.touchPans?.())) {
      pan = local(e);
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (kind === 'mouse' && e.button !== 0) return;
    toolPointer = e.pointerId;
    el.setPointerCapture(e.pointerId);
    tool.down(input(e));
  };

  const move = (e: PointerEvent) => {
    if (kindOf(e) === 'touch' && touches.has(e.pointerId)) {
      const prev = touches.get(e.pointerId)!;
      const now = local(e);
      if (tap) tap.moved = Math.max(tap.moved, dist2(prev, now));
      touches.set(e.pointerId, now);
    }
    if (gesture && touches.size >= 2) {
      const next = pinchState();
      let v = panBy(deps.getViewport(), next.center.x - gesture.center.x, next.center.y - gesture.center.y);
      v = zoomAt(v, next.center, next.d / gesture.d);
      gesture = next;
      deps.setViewport(v);
      return;
    }
    if (pan) {
      const p = local(e);
      deps.setViewport(panBy(deps.getViewport(), p.x - pan.x, p.y - pan.y));
      pan = p;
      return;
    }
    if (e.pointerId !== toolPointer) return;
    const tool = deps.getTool();
    const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const s of samples.length ? samples : [e]) tool.move(input(s));
  };

  const end = (e: PointerEvent, cancelled: boolean) => {
    const wasTouch = touches.delete(e.pointerId);
    if (wasTouch && touches.size === 0 && tap) {
      if (!cancelled && e.timeStamp - tap.start < TAP_MS && tap.moved < TAP_MOVE_PX) {
        if (tap.fingers === 2) deps.undo();
        else if (tap.fingers === 3) deps.redo();
      }
      tap = null;
    }
    if (gesture) {
      if (touches.size === 0) gesture = null;
      else if (touches.size >= 2) gesture = pinchState();
      return;
    }
    if (pan) {
      pan = null;
      return;
    }
    if (e.pointerId === toolPointer) {
      toolPointer = null;
      if (cancelled) deps.getTool().cancel();
      else deps.getTool().up(input(e));
    }
  };
  const up = (e: PointerEvent) => end(e, false);
  const cancel = (e: PointerEvent) => end(e, true);

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey && !e.ctrlKey) {
      deps.setViewport(panBy(deps.getViewport(), -e.deltaY, 0));
      return;
    }
    const k = e.ctrlKey || e.metaKey ? PINCH_ZOOM : WHEEL_ZOOM;
    deps.setViewport(zoomAt(deps.getViewport(), local(e), Math.exp(-e.deltaY * k)));
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('wheel', wheel);
  };
}
