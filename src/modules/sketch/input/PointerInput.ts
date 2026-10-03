// Pointer input (SKETCH §4, §7, §22): one finger / the pen draws, two fingers
// pan and pinch, a two-finger tap undoes and a three-finger tap redoes.
// Coalesced events feed the engine directly; React never sees a move.
import { moveGuide, pinch, zoomAt, type GuideHandle, type Pt, type SelTransform, type View } from '../core/geometry';
import type { InputPoint, ReferenceModel } from '../core/types';
import type { RasterEngine, Refusal } from '../engine/RasterEngine';

export type InputMode = 'draw' | 'rect' | 'lasso' | 'transform' | 'reference';
/** Finger drawing: always, only until a stylus is seen, or never (fingers navigate). */
export type FingerDraw = 'always' | 'auto' | 'never';

export interface InputHooks {
  mode(): InputMode;
  fingerDraw(): FingerDraw;
  tapUndo(): boolean;
  tapRedo(): boolean;
  /** A stroke started / ended (the UI fades while drawing). */
  onStroke(active: boolean): void;
  onRefused(why: Exclude<Refusal, null>): void;
  onUndo(): void;
  onRedo(): void;
  /** A reference image was moved / scaled (while editing references). */
  onReference(r: ReferenceModel): void;
  /** A single short tap on the canvas (no stroke made). */
  onTap?(): void;
  /** A stroke's start or end was pulled onto a snap point. */
  onSnap?(): void;
}

interface Ptr {
  id: number;
  type: string;
  x: number;
  y: number;
  x0: number;
  y0: number;
}

type State =
  | { kind: 'idle' }
  | { kind: 'stroke'; id: number; t0: number }
  | { kind: 'pan'; id: number; view: View }
  | { kind: 'gesture'; fingers: number; t0: number; moved: boolean; view: View; a: Pt; b: Pt; sel?: SelTransform; ref?: ReferenceModel }
  | { kind: 'handle'; id: number; handle: GuideHandle }
  | { kind: 'select'; id: number; start: Pt; poly: Pt[] }
  | { kind: 'move'; id: number; start: Pt; sel?: SelTransform; ref?: ReferenceModel }
  | { kind: 'wait' };

/** A second finger arriving this soon after the first means "gesture", not "stroke". */
const GESTURE_GRACE_MS = 150;
const TAP_MS = 280;
const TAP_SLOP = 14;

export class PointerInput {
  private ptrs = new Map<number, Ptr>();
  private state: State = { kind: 'idle' };
  private penSeen = false;
  private maxFingers = 0;
  private tapStart = 0;

  constructor(
    private el: HTMLElement,
    private engine: RasterEngine,
    private hooks: InputHooks,
  ) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', prevent);
  }

  dispose() {
    const el = this.el;
    el.removeEventListener('pointerdown', this.down);
    el.removeEventListener('pointermove', this.move);
    el.removeEventListener('pointerup', this.up);
    el.removeEventListener('pointercancel', this.cancel);
    el.removeEventListener('wheel', this.wheel);
    el.removeEventListener('contextmenu', prevent);
  }

  private local(e: PointerEvent | WheelEvent): Pt {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private sample(e: PointerEvent): InputPoint {
    const p = this.engine.toDoc(this.local(e));
    const pen = e.pointerType === 'pen';
    let tilt = 0;
    let azimuth = 0;
    if (pen) {
      const alt = (e as PointerEvent & { altitudeAngle?: number }).altitudeAngle;
      const az = (e as PointerEvent & { azimuthAngle?: number }).azimuthAngle;
      if (alt !== undefined && az !== undefined) {
        tilt = Math.max(0, Math.min(1, 1 - alt / (Math.PI / 2)));
        azimuth = az;
      } else if (e.tiltX || e.tiltY) {
        tilt = Math.min(1, Math.hypot(e.tiltX, e.tiltY) / 90);
        azimuth = Math.atan2(e.tiltY, e.tiltX);
      }
    }
    return { x: p.x, y: p.y, pressure: pen ? (e.pressure > 0 ? e.pressure : 0.5) : 1, tilt, azimuth, t: e.timeStamp };
  }

  /** Soft snap: a stroke starting near a snap point starts on it. */
  private snapped(p: InputPoint): InputPoint {
    const s = this.engine.snapTo(p);
    if (!s) return p;
    this.hooks.onSnap?.();
    return { ...p, x: s.x, y: s.y };
  }

  private fingers() {
    let n = 0;
    for (const p of this.ptrs.values()) if (p.type === 'touch') n++;
    return n;
  }

  private canDraw(type: string) {
    if (type !== 'touch') return true;
    const f = this.hooks.fingerDraw();
    return f === 'always' || (f === 'auto' && !this.penSeen);
  }

  private down = (e: PointerEvent) => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    this.el.setPointerCapture?.(e.pointerId);
    const at = this.local(e);
    this.ptrs.set(e.pointerId, { id: e.pointerId, type: e.pointerType, x: at.x, y: at.y, x0: at.x, y0: at.y });
    if (e.pointerType === 'pen') this.penSeen = true;
    const fingers = this.fingers();
    this.maxFingers = Math.max(this.maxFingers, fingers);
    const st = this.state;

    if (fingers >= 2 && e.pointerType === 'touch') {
      // A gesture: a stroke that has only just begun was its first finger.
      if (st.kind === 'stroke') {
        if (e.timeStamp - st.t0 < GESTURE_GRACE_MS) this.engine.strokeCancel();
        else this.engine.strokeEnd();
        this.hooks.onStroke(false);
      }
      if (st.kind === 'select') this.engine.setDraft(null);
      this.startGesture(fingers, e.timeStamp, st.kind === 'stroke' && e.timeStamp - st.t0 < GESTURE_GRACE_MS ? this.tapStart : e.timeStamp);
      return;
    }
    if (st.kind !== 'idle') return;
    this.tapStart = e.timeStamp;
    const mode = this.hooks.mode();
    const doc = this.engine.toDoc(at);
    if (e.pointerType === 'mouse' && e.button === 1) {
      this.state = { kind: 'pan', id: e.pointerId, view: this.engine.view };
      return;
    }
    const handle = this.engine.handleAt(at);
    if (handle && mode === 'draw') {
      this.state = { kind: 'handle', id: e.pointerId, handle };
      return;
    }
    if (mode === 'rect' || mode === 'lasso') {
      this.state = { kind: 'select', id: e.pointerId, start: doc, poly: [doc] };
      return;
    }
    if (mode === 'transform' && this.engine.floating) {
      this.state = { kind: 'move', id: e.pointerId, start: doc, sel: { ...this.engine.floating.t } };
      return;
    }
    if (mode === 'reference') {
      const ref = this.engine.referenceAt(doc);
      if (ref && !ref.locked) this.state = { kind: 'move', id: e.pointerId, start: doc, ref: { ...ref } };
      else this.state = { kind: 'pan', id: e.pointerId, view: this.engine.view };
      return;
    }
    if (mode === 'draw' && this.canDraw(e.pointerType)) {
      const why = this.engine.strokeBegin(this.snapped(this.sample(e)));
      if (why) {
        this.hooks.onRefused(why);
        this.state = { kind: 'wait' };
        return;
      }
      this.state = { kind: 'stroke', id: e.pointerId, t0: e.timeStamp };
      this.hooks.onStroke(true);
      return;
    }
    this.state = { kind: 'pan', id: e.pointerId, view: this.engine.view };
  };

  private startGesture(fingers: number, now: number, t0: number) {
    const [a, b] = [...this.ptrs.values()].filter((p) => p.type === 'touch');
    const mode = this.hooks.mode();
    const ref = mode === 'reference' && this.engine.editingRef ? this.engine.doc.references.find((r) => r.id === this.engine.editingRef && !r.locked) : undefined;
    this.state = {
      kind: 'gesture',
      fingers,
      t0: Math.min(t0, now),
      moved: false,
      view: this.engine.view,
      a: { x: a.x, y: a.y },
      b: { x: b.x, y: b.y },
      sel: mode === 'transform' && this.engine.floating ? { ...this.engine.floating.t } : undefined,
      ref: ref ? { ...ref } : undefined,
    };
  }

  private move = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const at = this.local(e);
    p.x = at.x;
    p.y = at.y;
    const st = this.state;
    switch (st.kind) {
      case 'stroke': {
        if (st.id !== e.pointerId) return;
        const evs = e.getCoalescedEvents?.() ?? [];
        this.engine.strokeMove((evs.length ? evs : [e]).map((c) => this.sample(c)));
        return;
      }
      case 'pan': {
        if (st.id !== e.pointerId) return;
        this.engine.setView({ ...st.view, x: st.view.x + p.x - p.x0, y: st.view.y + p.y - p.y0 });
        return;
      }
      case 'handle': {
        if (st.id !== e.pointerId) return;
        this.engine.setGuides(moveGuide(this.engine.doc.guides, st.handle, this.engine.toDoc(at)));
        return;
      }
      case 'select': {
        if (st.id !== e.pointerId) return;
        const d = this.engine.toDoc(at);
        if (this.hooks.mode() === 'rect') {
          const s = st.start;
          st.poly = [s, { x: d.x, y: s.y }, d, { x: s.x, y: d.y }];
        } else {
          const last = st.poly[st.poly.length - 1];
          if (Math.hypot(d.x - last.x, d.y - last.y) * this.engine.view.scale > 3) st.poly.push(d);
        }
        this.engine.setDraft(st.poly);
        return;
      }
      case 'move': {
        if (st.id !== e.pointerId) return;
        const d = this.engine.toDoc(at);
        const dx = d.x - st.start.x;
        const dy = d.y - st.start.y;
        if (st.sel) this.engine.transformFloating({ ...st.sel, dx: st.sel.dx + dx, dy: st.sel.dy + dy });
        if (st.ref) this.hooks.onReference({ ...st.ref, x: st.ref.x + dx, y: st.ref.y + dy });
        return;
      }
      case 'gesture': {
        const touches = [...this.ptrs.values()].filter((q) => q.type === 'touch');
        if (touches.length < 2) return;
        const [a, b] = touches;
        if (touches.some((q) => Math.hypot(q.x - q.x0, q.y - q.y0) > TAP_SLOP)) st.moved = true;
        if (!st.moved) return;
        const d0 = Math.hypot(st.a.x - st.b.x, st.a.y - st.b.y) || 1;
        const d1 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const rot = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(st.b.y - st.a.y, st.b.x - st.a.x);
        const m0 = { x: (st.a.x + st.b.x) / 2, y: (st.a.y + st.b.y) / 2 };
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const k = this.engine.view.scale;
        if (st.sel) {
          this.engine.transformFloating({ scale: Math.max(0.05, st.sel.scale * (d1 / d0)), rotation: st.sel.rotation + rot, dx: st.sel.dx + (m1.x - m0.x) / k, dy: st.sel.dy + (m1.y - m0.y) / k });
          return;
        }
        if (st.ref) {
          this.hooks.onReference({ ...st.ref, width: Math.max(40, st.ref.width * (d1 / d0)), rotation: st.ref.rotation + rot, x: st.ref.x + (m1.x - m0.x) / k, y: st.ref.y + (m1.y - m0.y) / k });
          return;
        }
        this.engine.setView(pinch(st.view, st.a, st.b, a, b));
        return;
      }
    }
  };

  private up = (e: PointerEvent) => this.finish(e, false);
  private cancel = (e: PointerEvent) => this.finish(e, true);

  private finish(e: PointerEvent, cancelled: boolean) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    const st = this.state;
    switch (st.kind) {
      case 'stroke':
        if (st.id === e.pointerId) {
          const evs = e.getCoalescedEvents?.() ?? [];
          if (!cancelled) {
            const pts = (evs.length ? evs : [e]).map((c) => this.sample(c));
            // Soft snap: a stroke ending near a snap point ends on it.
            const last = pts[pts.length - 1];
            const end = this.engine.snapTo(last);
            if (end) {
              pts.push({ ...last, x: end.x, y: end.y });
              this.hooks.onSnap?.();
            }
            this.engine.strokeMove(pts);
          }
          this.engine.strokeEnd();
          this.hooks.onStroke(false);
          this.state = { kind: 'idle' };
        }
        break;
      case 'select':
        if (st.id === e.pointerId) {
          this.engine.setDraft(null);
          this.engine.setSelection(cancelled ? null : st.poly);
          this.state = { kind: 'idle' };
        }
        break;
      case 'pan':
      case 'handle':
      case 'move':
        if (st.id === e.pointerId) {
          const tap = e.timeStamp - this.tapStart < TAP_MS && Math.hypot(p.x - p.x0, p.y - p.y0) < TAP_SLOP;
          this.state = { kind: 'idle' };
          if (tap && st.kind === 'pan') this.hooks.onTap?.();
        }
        break;
      case 'gesture':
        if (this.fingers() === 0) {
          if (!st.moved && !cancelled && e.timeStamp - st.t0 < TAP_MS + 120) {
            if (this.maxFingers === 2 && this.hooks.tapUndo()) this.hooks.onUndo();
            else if (this.maxFingers >= 3 && this.hooks.tapRedo()) this.hooks.onRedo();
          }
          this.state = { kind: 'idle' };
        }
        // Fingers lift one by one: the gesture lasts until the last one is up (a lone finger left behind does nothing).
        break;
      case 'wait':
        break;
    }
    if (this.ptrs.size === 0) {
      if (this.state.kind === 'wait') this.state = { kind: 'idle' };
      this.maxFingers = 0;
    }
  }

  /** Mouse wheel / trackpad: zoom about the pointer (desktop development). */
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.engine.setView(zoomAt(this.engine.view, this.local(e), Math.exp(-e.deltaY * 0.0015)));
  };
}

const prevent = (e: Event) => e.preventDefault();
