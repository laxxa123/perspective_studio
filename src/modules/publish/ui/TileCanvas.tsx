// The tile canvas (PUBLISH §6): every element is drawn by the shared renderer
// inside a Konva shape; drag anywhere to move (with soft snapping and guide
// lines), thumb-sized handles to resize and turn. Paint layers are not hit
// targets (they cover the tile); they are picked from Layers. On a selected
// text or spiral, two fingers pinch (size) and twist (text: turn the box;
// spiral: turn the coil); a spiral's centre knob drags its centre size. With
// the Style bar open, the tile lifts so the selected element stays in view.
import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Transformer } from 'react-konva';
import { bounds, snapEdges, snapMove, snapTargets } from '../core/layout';
import { updateElement } from '../core/tile';
import { CENTRE, clamp, softSnap, span, spiralGesture, textGesture, turnBetween } from '../core/styleScale';
import type { TileDocument, TileElement } from '../core/types';
import { MARGIN, TILE_H, TILE_W } from '../core/types';
import { drawElement, fittedTextHeight } from '../render/draw';
import { imageCache, onImagesLoaded } from '../render/images';
import { usePublishStore } from '../state/usePublishStore';

const ACCENT = '#1c7ed6';
/** Snap distance in screen px (soft: drag a little further to break free). */
const SNAP_PX = 8;
/** Height of the Style bar over the canvas (px): the selected element is lifted above it. */
const STYLE_BAR = 104;
type Native = { _context: CanvasRenderingContext2D };

export function TileCanvas({ tile }: { tile: TileDocument }) {
  const box = useRef<HTMLDivElement>(null);
  const tr = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Shape>());
  const [size, setSize] = useState({ w: 300, h: 500 });
  const [, redraw] = useState(0);
  const selected = usePublishStore((s) => s.selected);
  const guides = usePublishStore((s) => s.guides);
  const sheet = usePublishStore((s) => s.sheet);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<null | { base: TileElement; d0: number; a0: number }>(null);
  const st = usePublishStore.getState;

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const off = onImagesLoaded(() => redraw((n) => n + 1));
    void document.fonts?.ready.then(() => redraw((n) => n + 1));
    return () => {
      ro.disconnect();
      off();
    };
  }, []);

  // Edge to edge: the tile takes the full width (or the full height on a short screen).
  const s = Math.min(size.w / TILE_W, size.h / TILE_H);
  const ox = (size.w - TILE_W * s) / 2;
  const sel = tile.elements.find((e) => e.id === selected) ?? null;
  // Keep the selected element above the Style bar.
  let lift = 0;
  const oy0 = (size.h - TILE_H * s) / 2;
  if (sheet === 'style' && sel) {
    const b = bounds(sel);
    const room = size.h - STYLE_BAR - 8;
    const bottom = oy0 + b.y1 * s;
    if (bottom > room) lift = Math.max(0, Math.min(bottom - room, oy0 + b.y0 * s - 8));
  }
  const oy = oy0 - lift;

  // The transformer follows the selected element.
  useEffect(() => {
    const t = tr.current;
    if (!t) return;
    const n = sel && sel.kind !== 'paint' && !sel.locked ? nodes.current.get(sel.id) : undefined;
    t.nodes(n ? [n] : []);
    t.getLayer()?.batchDraw();
  });

  const others = (id: string) => tile.elements.filter((e) => e.id !== id && e.kind !== 'paint');
  const fromNode = (n: Konva.Node): Partial<TileElement> => {
    const w = (n.width() * n.scaleX()) / TILE_W;
    const h = (n.height() * n.scaleY()) / TILE_H;
    return { x: n.x() / TILE_W - w / 2, y: n.y() / TILE_H - h / 2, w, h, rotation: Math.round(n.rotation() * 100) / 100 };
  };

  const edit = (e: TileElement) => {
    if (e.kind === 'text') st().set({ selected: e.id, overlay: 'text' });
    else if (e.kind === 'image') st().set({ selected: e.id, overlay: 'trim' });
    else if (e.kind === 'spiral') st().set({ selected: e.id, overlay: 'spiral' });
  };

  const element = (e: TileElement) => {
    const w = e.w * TILE_W;
    const h = e.h * TILE_H;
    const live = e.kind !== 'paint';
    return (
      <Shape
        key={e.id}
        ref={(n) => {
          if (n) nodes.current.set(e.id, n);
          else nodes.current.delete(e.id);
        }}
        x={e.x * TILE_W + w / 2}
        y={e.y * TILE_H + h / 2}
        width={w}
        height={h}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={e.rotation}
        listening={live}
        draggable={live && !e.locked}
        sceneFunc={(ctx) => drawElement((ctx as unknown as Native)._context, e, imageCache, w, h)}
        hitFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        onPointerDown={(ev) => {
          ev.cancelBubble = true;
          if (selected !== e.id) st().set({ selected: e.id, sheet: 'none' });
        }}
        onDblClick={() => edit(e)}
        onDblTap={() => edit(e)}
        onDragMove={(ev) => {
          const n = ev.target;
          const b = bounds({ ...e, ...fromNode(n) });
          const snap = snapMove(b, snapTargets(others(e.id)), SNAP_PX / s);
          n.position({ x: n.x() + snap.dx, y: n.y() + snap.dy });
          const g = st().guides;
          if (g.x !== snap.gx || g.y !== snap.gy) st().set({ guides: { x: snap.gx, y: snap.gy } });
        }}
        onDragEnd={(ev) => {
          st().set({ guides: { x: null, y: null } });
          st().apply(updateElement(tile, e.id, fromNode(ev.target)));
        }}
        onTransformEnd={(ev) => {
          const n = ev.target;
          const patch = fromNode(n);
          n.scale({ x: 1, y: 1 });
          st().set({ guides: { x: null, y: null } });
          if (e.kind === 'text') {
            // Text boxes change width; the height follows the wrapped lines.
            const cy = (patch.y ?? e.y) + (patch.h ?? e.h) / 2;
            const h2 = fittedTextHeight({ ...e, w: patch.w ?? e.w });
            st().apply(updateElement(tile, e.id, { ...patch, h: h2, y: cy - h2 / 2 }));
          } else st().apply(updateElement(tile, e.id, patch));
        }}
      />
    );
  };

  const keepRatio = sel?.kind === 'image' || sel?.kind === 'spiral';

  // ----- two-finger pinch / twist on a selected text or spiral -----
  const at = (ev: React.PointerEvent) => ({ x: ev.clientX, y: ev.clientY });
  const pair = () => {
    const [a, b] = [...touches.current.values()];
    return span(a, b);
  };
  const down = (ev: React.PointerEvent) => {
    touches.current.set(ev.pointerId, at(ev));
    const cur = st().tile?.elements.find((e) => e.id === st().selected);
    if (touches.current.size === 2 && cur && (cur.kind === 'text' || cur.kind === 'spiral') && !cur.locked) {
      nodes.current.get(cur.id)?.stopDrag();
      const p = pair();
      gesture.current = { base: cur, d0: Math.max(1, p.d), a0: p.a };
    }
  };
  const move = (ev: React.PointerEvent) => {
    if (!touches.current.has(ev.pointerId)) return;
    touches.current.set(ev.pointerId, at(ev));
    const g = gesture.current;
    if (!g || touches.current.size < 2) return;
    const p = pair();
    st().preview(updateElement(st().tile!, g.base.id, gestured(g.base, p.d / g.d0, turnBetween(g.a0, p.a), false) as never));
  };
  const up = (ev: React.PointerEvent) => {
    const g = gesture.current;
    if (g && touches.current.size === 2) {
      const p = pair();
      gesture.current = null;
      st().apply(updateElement(st().tile!, g.base.id, gestured(g.base, p.d / g.d0, turnBetween(g.a0, p.a), true) as never));
    }
    touches.current.delete(ev.pointerId);
  };

  return (
    <div className="pb-canvas" ref={box} onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={up} onPointerCancelCapture={up}>
      <Stage
        width={size.w}
        height={size.h}
        onPointerDown={(ev) => {
          if (gesture.current || touches.current.size > 1) return;
          if (ev.target === ev.target.getStage() || ev.target.name() === 'bg') st().set({ selected: null, sheet: 'none' });
        }}
      >
        <Layer>
          <Group x={ox} y={oy} scaleX={s} scaleY={s}>
            <Rect name="bg" width={TILE_W} height={TILE_H} fill={tile.canvas.background} shadowColor="#000" shadowOpacity={0.18} shadowBlur={24 / s} shadowOffsetY={6 / s} />
            {tile.elements.map(element)}
            {/* Safe margins: editing only, never published. */}
            <Rect x={MARGIN} y={MARGIN} width={TILE_W - 2 * MARGIN} height={TILE_H - 2 * MARGIN} stroke="#00000022" strokeWidth={1} strokeScaleEnabled={false} dash={[6, 6]} listening={false} />
            {guides.x !== null && <Line points={[guides.x, 0, guides.x, TILE_H]} stroke={ACCENT} strokeWidth={1} strokeScaleEnabled={false} listening={false} />}
            {guides.y !== null && <Line points={[0, guides.y, TILE_W, guides.y]} stroke={ACCENT} strokeWidth={1} strokeScaleEnabled={false} listening={false} />}
            {sel?.kind === 'spiral' && !sel.locked && <CentreKnob e={sel} s={s} />}
          </Group>
          <Transformer
            ref={tr}
            keepRatio={keepRatio}
            enabledAnchors={sel?.kind === 'text' ? ['middle-left', 'middle-right'] : ['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            anchorSize={22}
            anchorCornerRadius={11}
            anchorStroke={ACCENT}
            anchorFill="#fff"
            borderStroke={ACCENT}
            rotateAnchorOffset={34}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={4}
            ignoreStroke
            boundBoxFunc={(ob, nb) => {
              if (Math.abs(nb.width) < 24 || Math.abs(nb.height) < 24) return ob;
              if (Math.abs(nb.rotation) > 0.001 || !sel) return nb;
              // Snap the dragged edges (document px), keeping the picture's aspect.
              const toDoc = (b: typeof nb) => ({ x0: (b.x - ox) / s, y0: (b.y - oy) / s, x1: (b.x + b.width - ox) / s, y1: (b.y + b.height - oy) / s });
              const o = toDoc(ob);
              const n = toDoc(nb);
              const moved = { left: Math.abs(n.x0 - o.x0) > 0.01, right: Math.abs(n.x1 - o.x1) > 0.01, top: Math.abs(n.y0 - o.y0) > 0.01, bottom: Math.abs(n.y1 - o.y1) > 0.01 };
              const r = snapEdges(n, snapTargets(others(sel.id)), SNAP_PX / s, moved);
              if (keepRatio) {
                const ratio = (o.x1 - o.x0) / Math.max(1e-6, o.y1 - o.y0);
                if (r.gx !== null) {
                  const hh = (r.x1 - r.x0) / ratio;
                  if (moved.top) r.y0 = r.y1 - hh;
                  else r.y1 = r.y0 + hh;
                } else if (r.gy !== null) {
                  const ww = (r.y1 - r.y0) * ratio;
                  if (moved.left) r.x0 = r.x1 - ww;
                  else r.x1 = r.x0 + ww;
                }
              }
              const g = st().guides;
              if (g.x !== r.gx || g.y !== r.gy) st().set({ guides: { x: r.gx, y: r.gy } });
              return { ...nb, x: r.x0 * s + ox, y: r.y0 * s + oy, width: (r.x1 - r.x0) * s, height: (r.y1 - r.y0) * s };
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}

/** A pinch (scale) and twist (degrees) applied to a text or spiral. */
function gestured(e: TileElement, scale: number, twist: number, final: boolean): Partial<TileElement> {
  if (e.kind === 'spiral') return spiralGesture(e, scale, twist);
  if (e.kind !== 'text') return {};
  const g = textGesture(e, scale, twist, final);
  const h = fittedTextHeight({ ...e, size: g.size });
  return { ...g, h, y: e.y + e.h / 2 - h / 2 };
}

/** The spiral's centre knob: drag left / right to change the centre size (50–100 %). */
function CentreKnob({ e, s }: { e: Extract<TileElement, { kind: 'spiral' }>; s: number }) {
  const cx = (e.x + e.w / 2) * TILE_W;
  const cy = (e.y + e.h / 2) * TILE_H;
  const reach = (e.w * TILE_W) / 2;
  const st = usePublishStore.getState;
  // The centre size when the drag began (previews change `e` while dragging).
  const base = useRef(e.innerScale);
  const value = (dx: number) => clamp(Math.round(softSnap(base.current * 100 + (dx / reach) * 100, CENTRE.step, 2)), CENTRE.min, CENTRE.max) / 100;
  return (
    <Circle
      x={cx}
      y={cy}
      radius={14 / s}
      fill="#fff"
      stroke={ACCENT}
      strokeWidth={3 / s}
      shadowColor="#000"
      shadowOpacity={0.25}
      shadowBlur={6 / s}
      draggable
      onPointerDown={(ev) => {
        ev.cancelBubble = true;
      }}
      onDragStart={() => {
        base.current = e.innerScale;
      }}
      onDragMove={(ev) => {
        const n = ev.target;
        n.y(cy);
        st().preview(updateElement(st().tile!, e.id, { innerScale: value(n.x() - cx) } as never));
      }}
      onDragEnd={(ev) => {
        const n = ev.target;
        const v = value(n.x() - cx);
        n.position({ x: cx, y: cy });
        st().apply(updateElement(st().tile!, e.id, { innerScale: v } as never));
      }}
    />
  );
}

