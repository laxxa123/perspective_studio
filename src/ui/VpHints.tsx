// Off-screen VP hints (PS-05, UI-10): a small arrow with a tiny label where
// the line from the ground point toward an off-screen VP leaves the screen.
// Tap pans to the VP; in the Perspective tool, dragging the hint drags the VP.
import { useRef } from 'react';
import { finiteVps } from '../core/derive/derive';
import type { Family } from '../core/perspective/types';
import type { PerspectiveHandleId } from '../core/perspective';
import { project } from '../core/perspective/camera';
import { v3, type Vec2 } from '../core/math/vec';
import { centreOn, toPicture, toScreen, type Viewport } from '../core/viewport/viewport';
import { cameraOf, perspectiveFor } from '../state/derived';
import type { SceneDocument } from '../core/document/types';
import type { Theme } from '../theme/theme';
import { useUiStore } from '../state/uiStore';
import type { PerspectiveTool } from '../tools/perspectiveTool';

interface Props {
  doc: SceneDocument;
  viewport: Viewport;
  width: number;
  height: number;
  canDrag: boolean;
  tool: PerspectiveTool;
  theme: Theme;
}

/** The rectangle the hints sit on, px from the screen edges (clear of the bars). */
const INSET = { left: 18, right: 18, top: 74, bottom: 176 };
const DRAG_SLOP_PX = 6;
const HANDLE: Record<Family, PerspectiveHandleId> = { L: 'vpL', R: 'vpR', V: 'vpV' };

/** Where the ray from `from` toward `to` leaves the inset rectangle; null if `to` is inside it. */
function exitPoint(from: Vec2, to: Vec2, w: number, h: number): Vec2 | null {
  const minX = INSET.left;
  const maxX = w - INSET.right;
  const minY = INSET.top;
  const maxY = h - INSET.bottom;
  if (to.x >= minX && to.x <= maxX && to.y >= minY && to.y <= maxY) return null;
  const o = { x: Math.min(maxX, Math.max(minX, from.x)), y: Math.min(maxY, Math.max(minY, from.y)) };
  const dx = to.x - o.x;
  const dy = to.y - o.y;
  const tx = dx === 0 ? Infinity : ((dx > 0 ? maxX : minX) - o.x) / dx;
  const ty = dy === 0 ? Infinity : ((dy > 0 ? maxY : minY) - o.y) / dy;
  const t = Math.max(0, Math.min(tx, ty));
  return { x: o.x + dx * t, y: o.y + dy * t };
}

export function VpHints({ doc, viewport, width, height, canDrag, tool, theme }: Props) {
  const press = useRef<{ id: PerspectiveHandleId; x: number; y: number; dragging: boolean } | null>(null);
  const cam = cameraOf(doc.eye);
  const origin = project(cam, v3(0, 0, 0));
  const from = origin ? toScreen(viewport, origin) : { x: width / 2, y: height / 2 };
  const draggable = canDrag && perspectiveFor(doc.eye) !== null;

  return (
    <>
      {finiteVps(cam).map(({ family, point }) => {
        const s = toScreen(viewport, point);
        const at = exitPoint(from, s, width, height);
        if (!at) return null;
        const id = HANDLE[family];
        const color = theme.family[family];
        const deg = (Math.atan2(s.y - at.y, s.x - at.x) * 180) / Math.PI;
        const local = (e: React.PointerEvent) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const input = (screen: Vec2, buttons: number) => {
          const vp = useUiStore.getState().viewport!;
          return { pp: toPicture(vp, screen), screen, pointerType: 'touch' as const, pressure: 0.5, buttons, shift: false, pxToPp: 1 / vp.zoom };
        };
        return (
          <button
            key={family}
            className="vp-hint"
            style={{ left: at.x, top: at.y, color }}
            aria-label={`VP-${family} (off screen)`}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              press.current = { id, x: e.clientX, y: e.clientY, dragging: false };
            }}
            onPointerMove={(e) => {
              const p = press.current;
              if (!p || !draggable) return;
              if (!p.dragging) {
                if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_SLOP_PX) return;
                p.dragging = true;
                tool.startDrag(p.id, input(local(e), 1).pp);
              }
              tool.move(input(local(e), 1));
            }}
            onPointerUp={(e) => {
              const p = press.current;
              press.current = null;
              if (!p) return;
              if (p.dragging) tool.up(input(local(e), 0));
              else useUiStore.getState().setViewport(centreOn(viewport, point, width, height));
            }}
            onPointerCancel={() => {
              if (press.current?.dragging) tool.cancel();
              press.current = null;
            }}
          >
            <svg width="14" height="14" viewBox="-7 -7 14 14" style={{ transform: `rotate(${deg}deg)` }} aria-hidden>
              <path d="M -5 -4 L 5 0 L -5 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>VP-{family}</span>
          </button>
        );
      })}
    </>
  );
}
