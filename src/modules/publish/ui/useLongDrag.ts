// Hold-and-drag (PUBLISH §9.3): a tile lifts after a short hold (a quick
// swipe still scrolls the page), follows the finger as a ghost, the list
// scrolls when the finger nears an edge, and letting go drops it. The caller
// turns the finger position into a drop target and paints the indicator.
import { useEffect, useRef, useState } from 'react';
import { haptics } from '../../../platform/haptics';

const HOLD_MS = 320;
const SLOP = 10;
const EDGE = 64;

export interface DragState {
  id: string;
  x: number;
  y: number;
}

export function useLongDrag<T>(opts: {
  /** The scrolling container (auto-scroll while dragging). */
  scroller: () => HTMLElement | null;
  /** Drop target under the finger (null = nowhere). */
  target: (x: number, y: number, id: string) => T | null;
  drop: (id: string, target: T) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<T | null>(null);
  const o = useRef(opts);
  useEffect(() => {
    o.current = opts;
  });
  const live = useRef<{ drag: DragState | null; over: T | null; raf: number; vy: number }>({ drag: null, over: null, raf: 0, vy: 0 });

  useEffect(() => {
    if (!drag) return;
    // While a tile is lifted the page must not scroll under the finger.
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    const move = (e: PointerEvent) => {
      const d = live.current.drag;
      if (!d) return;
      const next = { ...d, x: e.clientX, y: e.clientY };
      live.current.drag = next;
      setDrag(next);
      const t = o.current.target(e.clientX, e.clientY, d.id);
      live.current.over = t;
      setOver(t);
      const box = o.current.scroller()?.getBoundingClientRect();
      live.current.vy = box ? (e.clientY < box.top + EDGE ? -1 : e.clientY > box.bottom - EDGE ? 1 : 0) : 0;
    };
    const end = (e: PointerEvent) => {
      const d = live.current.drag;
      const t = e.type === 'pointerup' ? live.current.over : null;
      live.current = { drag: null, over: null, raf: live.current.raf, vy: 0 };
      setDrag(null);
      setOver(null);
      if (d && t !== null) o.current.drop(d.id, t);
    };
    const tick = () => {
      const el = o.current.scroller();
      const { vy, drag: d } = live.current;
      if (el && vy && d) {
        el.scrollTop += vy * 12;
        const t = o.current.target(d.x, d.y, d.id);
        live.current.over = t;
        setOver(t);
      }
      live.current.raf = requestAnimationFrame(tick);
    };
    live.current.raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      document.removeEventListener('touchmove', block);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      cancelAnimationFrame(live.current.raf);
    };
    // Re-arm only when a drag starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  /** Spread onto the element that can be lifted. */
  const handle = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let lx = x0;
      let ly = y0;
      const cancel = () => {
        clearTimeout(timer);
        window.removeEventListener('pointermove', track);
        window.removeEventListener('pointerup', cancel);
        window.removeEventListener('pointercancel', cancel);
      };
      const track = (ev: PointerEvent) => {
        lx = ev.clientX;
        ly = ev.clientY;
        if (Math.hypot(lx - x0, ly - y0) > SLOP) cancel();
      };
      const timer = setTimeout(() => {
        cancel();
        haptics.tick();
        window.getSelection()?.removeAllRanges();
        const d = { id, x: lx, y: ly };
        live.current.drag = d;
        setDrag(d);
        // The click that follows the hold must not open the tile.
        const swallow = (ev: Event) => (ev.stopPropagation(), ev.preventDefault());
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 600);
      }, HOLD_MS);
      window.addEventListener('pointermove', track);
      window.addEventListener('pointerup', cancel);
      window.addEventListener('pointercancel', cancel);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return { drag, over, handle };
}
