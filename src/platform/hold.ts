// Tap and hold on one button (SKETCH §5, PUBLISH §6.5): a tap does the
// button's everyday thing; holding it (half a second, with a haptic tick)
// does its second thing, and the tap that would follow is dropped.
import { useRef } from 'react';
import { haptics } from './haptics';

export const HOLD_MS = 500;

export function useHold(tap: () => void, hold: () => void, ms = HOLD_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: () => {
      held.current = false;
      cancel();
      timer.current = setTimeout(() => {
        held.current = true;
        haptics.tick();
        hold();
      }, ms);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
    onClick: () => {
      if (held.current) held.current = false;
      else tap();
    },
  };
}

/** A one-line hint shown the first few times only (per device). */
export function firstTimes(key: string, times = 3): boolean {
  try {
    const k = `creative.hint.${key}`;
    const n = Number(localStorage.getItem(k) ?? 0);
    if (n >= times) return false;
    localStorage.setItem(k, String(n + 1));
    return true;
  } catch {
    return false;
  }
}
