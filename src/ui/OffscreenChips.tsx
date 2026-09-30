// Off-screen VP indicators (PS-05, §10.5): an arrow chip at the viewport edge
// for each VP outside it. Tap pans to the VP; in the Perspective tool,
// dragging the chip drags the VP.
import { useRef } from 'react';
import { pointHandles, type PerspectiveHandleId, type PerspectiveSystem } from '../core/perspective';
import { centreOn, edgeIndicator, toPicture, toScreen, type Viewport } from '../core/viewport/viewport';
import { FAMILY_COLOR } from '../render/konva/theme';
import { useUiStore } from '../state/uiStore';
import type { PerspectiveTool } from '../tools/perspectiveTool';

interface Props {
  perspective: PerspectiveSystem;
  viewport: Viewport;
  width: number;
  height: number;
  canDrag: boolean;
  onDragStart: (id: PerspectiveHandleId, pointerPp: { x: number; y: number }) => void;
  tool: PerspectiveTool;
}

/** Distance of the chips from the screen edge, px (clear of the bars). */
const INSET_X = 40;
const INSET_TOP = 84;
const INSET_BOTTOM = 104;
const DRAG_SLOP_PX = 6;

export function OffscreenChips({ perspective, viewport, width, height, canDrag, onDragStart, tool }: Props) {
  const press = useRef<{ id: PerspectiveHandleId; x: number; y: number; dragging: boolean } | null>(null);
  const vps = pointHandles(perspective).filter((h) => h.id !== 'anchor');

  return (
    <>
      {vps.map((h) => {
        const s = toScreen(viewport, h.point);
        // Only VPs outside the screen get a chip; it sits on a rectangle
        // inset from the edges and clear of the bars.
        if (!edgeIndicator(s, width, height, 0)) return null;
        const ind = edgeIndicator(
          { x: s.x - INSET_X, y: s.y - INSET_TOP },
          width - 2 * INSET_X,
          height - INSET_TOP - INSET_BOTTOM,
          0,
        );
        if (!ind) return null;
        const color = h.family ? FAMILY_COLOR[h.family] : '#343a40';
        const deg = (ind.angle * 180) / Math.PI;
        const local = (e: React.PointerEvent) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        return (
          <button
            key={h.id}
            className="vp-chip"
            style={{ left: ind.x + INSET_X, top: ind.y + INSET_TOP, borderColor: color, color }}
            aria-label={`${h.label} (off screen)`}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              press.current = { id: h.id, x: e.clientX, y: e.clientY, dragging: false };
            }}
            onPointerMove={(e) => {
              const p = press.current;
              if (!p || !canDrag) return;
              const vp = useUiStore.getState().viewport!;
              if (!p.dragging) {
                if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_SLOP_PX) return;
                p.dragging = true;
                onDragStart(p.id, toPicture(vp, local(e)));
              }
              const screen = local(e);
              tool.move({ pp: toPicture(vp, screen), screen, pointerType: 'touch', pressure: 0.5, buttons: 1 });
            }}
            onPointerUp={(e) => {
              const p = press.current;
              press.current = null;
              if (!p) return;
              if (p.dragging) {
                const screen = local(e);
                tool.up({ pp: toPicture(useUiStore.getState().viewport!, screen), screen, pointerType: 'touch', pressure: 0.5, buttons: 0 });
              } else {
                useUiStore.getState().setViewport(centreOn(viewport, h.point, width, height));
              }
            }}
            onPointerCancel={() => {
              if (press.current?.dragging) tool.cancel();
              press.current = null;
            }}
          >
            <span className="arrow" style={{ transform: `rotate(${deg}deg)` }}>➜</span>
            {h.label}
          </button>
        );
      })}
    </>
  );
}
