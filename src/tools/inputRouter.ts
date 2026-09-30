// The single input router (CV-02, §8.6, §10.3): normalizes pointer events,
// handles pan / zoom gestures itself, and hands everything else to the active
// tool. Tools never see raw DOM events.
import { dist2, type Vec2 } from '../core/math/vec';
import { panBy, toPicture, zoomAt, type Viewport } from '../core/viewport/viewport';
import type { Tool, ToolInput } from './types';

interface RouterDeps {
  getViewport: () => Viewport;
  setViewport: (v: Viewport) => void;
  getTool: () => Tool;
}

type PointerKind = ToolInput['pointerType'];

const kindOf = (e: PointerEvent): PointerKind =>
  e.pointerType === 'pen' ? 'pen' : e.pointerType === 'touch' ? 'touch' : 'mouse';

/** Wheel zoom speed per pixel of wheel delta. */
const WHEEL_ZOOM = 0.0015;
/** Trackpad pinch (ctrl+wheel) is finer-grained, so it zooms faster per delta. */
const PINCH_ZOOM = 0.01;

export function attachInputRouter(el: HTMLElement, deps: RouterDeps): () => void {
  const touches = new Map<number, Vec2>();
  let toolPointer: number | null = null;
  let gesture: { center: Vec2; d: number } | null = null;
  let mousePan: Vec2 | null = null;

  const local = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const input = (e: PointerEvent): ToolInput => {
    const screen = local(e);
    return {
      screen,
      pp: toPicture(deps.getViewport(), screen),
      pointerType: kindOf(e),
      pressure: e.pressure,
      buttons: e.buttons,
    };
  };
  const pinchState = () => {
    const [a, b] = [...touches.values()];
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.max(dist2(a, b), 1) };
  };

  const down = (e: PointerEvent) => {
    if (kindOf(e) === 'touch') touches.set(e.pointerId, local(e));
    // Two fingers: pan / pinch, and the tool's action (if any) is cancelled.
    if (touches.size >= 2) {
      if (toolPointer !== null) {
        deps.getTool().cancel();
        toolPointer = null;
      }
      gesture = pinchState();
      return;
    }
    if (gesture) return;
    // Middle mouse button pans on desktop.
    if (kindOf(e) === 'mouse' && e.button === 1) {
      mousePan = local(e);
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (kindOf(e) === 'mouse' && e.button !== 0) return;
    toolPointer = e.pointerId;
    el.setPointerCapture(e.pointerId);
    deps.getTool().down(input(e));
  };

  const move = (e: PointerEvent) => {
    if (kindOf(e) === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, local(e));
    if (gesture && touches.size >= 2) {
      const next = pinchState();
      let v = panBy(deps.getViewport(), next.center.x - gesture.center.x, next.center.y - gesture.center.y);
      v = zoomAt(v, next.center, next.d / gesture.d);
      gesture = next;
      deps.setViewport(v);
      return;
    }
    if (mousePan) {
      const p = local(e);
      deps.setViewport(panBy(deps.getViewport(), p.x - mousePan.x, p.y - mousePan.y));
      mousePan = p;
      return;
    }
    if (e.pointerId === toolPointer) deps.getTool().move(input(e));
  };

  const end = (e: PointerEvent, cancelled: boolean) => {
    touches.delete(e.pointerId);
    if (gesture) {
      // The gesture ends when fingers lift; the remaining finger does nothing.
      if (touches.size === 0) gesture = null;
      else if (touches.size >= 2) gesture = pinchState();
      return;
    }
    if (mousePan) {
      mousePan = null;
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
    const at = local(e);
    if (e.shiftKey && !e.ctrlKey) {
      deps.setViewport(panBy(deps.getViewport(), -e.deltaY, 0));
      return;
    }
    const k = e.ctrlKey || e.metaKey ? PINCH_ZOOM : WHEEL_ZOOM;
    deps.setViewport(zoomAt(deps.getViewport(), at, Math.exp(-e.deltaY * k)));
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
