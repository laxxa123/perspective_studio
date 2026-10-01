// The Net Canvas (CUBE §10, §13, §18, §21): Konva renders and edits the
// unfolded net; every change goes back to the CubeModel through pure edits.
// World units = net cells; faces are drawn in their own face-local frame.
import { useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text, Transformer } from 'react-konva';
import type { ArtworkElement, CubeModel, FaceId, NetCell, Transform2 } from '../model/CubeModel';
import { place, moveCell, updateElement, removeElement, type Ref } from '../model/edit';
import { validateNet } from '../geometry/NetValidator';
import { applyAffine, faceToNet, invert } from '../geometry/Orientation';
import { penElement, shapeElement, snapValue, stampElement, textElement, imageElement } from '../canvas/Interaction';
import { useCubeStore, type ElementRef } from '../state/useCubeStore';
import { importImage } from '../services/CubeService';
import { pickFile } from '../../../platform/files';

type P = { x: number; y: number };

const ORIGIN: Record<number, P> = { 0: { x: 0, y: 0 }, 1: { x: 1, y: 0 }, 2: { x: 1, y: 1 }, 3: { x: 0, y: 1 } };
const ACCENT = '#1c7ed6';
const DRAW_TOOLS = new Set(['pen', 'line', 'arrow', 'rect', 'ellipse', 'polygon']);

/** Image cache: data URL → loaded image. */
const images = new Map<string, HTMLImageElement>();
function useImage(src: string | undefined): HTMLImageElement | undefined {
  const [, bump] = useState(0);
  if (!src) return undefined;
  let img = images.get(src);
  if (!img) {
    img = new window.Image();
    img.onload = () => bump((n) => n + 1);
    img.src = src;
    images.set(src, img);
  }
  return img.complete ? img : undefined;
}

const measured = new Map<string, { w: number; h: number }>();
function measureText(text: string, fs: number) {
  const k = `${fs}:${text}`;
  let m = measured.get(k);
  if (!m) {
    const t = new Konva.Text({ text, fontSize: fs, fontStyle: 'bold', fontFamily: 'system-ui, sans-serif' });
    m = { w: t.width(), h: t.height() };
    measured.set(k, m);
  }
  return m;
}

function ElementShape({ e, src }: { e: ArtworkElement; src?: string }) {
  const img = useImage(e.kind === 'image' ? src : undefined);
  if (e.kind === 'text') {
    // Drawn at 100× and scaled down (canvases handle sub-pixel font sizes poorly),
    // centred on its measured size.
    const fs = (e.fontSize ?? 0.45) * 100;
    const size = measureText(e.text ?? '', fs);
    return (
      <Text
        text={e.text ?? ''}
        fontSize={fs}
        fontStyle="bold"
        fontFamily="system-ui, sans-serif"
        fill={e.fill ?? '#212529'}
        offsetX={size.w / 2}
        offsetY={size.h / 2}
        scaleX={0.01}
        scaleY={0.01}
      />
    );
  }
  if (e.kind === 'image') {
    const c = e.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    if (!img) return <Rect x={-e.w / 2} y={-e.h / 2} width={e.w} height={e.h} fill="#dee2e6" />;
    return (
      <KImage
        image={img}
        x={-e.w / 2}
        y={-e.h / 2}
        width={e.w}
        height={e.h}
        crop={{ x: c.x * img.naturalWidth, y: c.y * img.naturalHeight, width: c.w * img.naturalWidth, height: c.h * img.naturalHeight }}
      />
    );
  }
  return (
    <Path
      data={e.path ?? ''}
      fill={e.fill ?? undefined}
      stroke={e.stroke ?? undefined}
      strokeWidth={e.strokeWidth ?? 0}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={Math.max(e.strokeWidth ?? 0, 0.08 / Math.max(e.transform.scaleX, 0.05))}
    />
  );
}

interface Props {
  model: CubeModel;
  assets: Record<string, string>;
}

export function NetCanvas({ model, assets }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 300 });
  const [view, setView] = useState<{ x: number; y: number; s: number } | null>(null);
  const [draft, setDraft] = useState<{ face: FaceId; tool: string; start: P; points: P[] } | null>(null);
  const [dragging, setDragging] = useState<FaceId | null>(null);
  const tool = useCubeStore((s) => s.tool);
  const style = useCubeStore((s) => s.style);
  const selected = useCubeStore((s) => s.selected);
  const selectedFace = useCubeStore((s) => s.selectedFace);
  const st = useCubeStore.getState;
  const trRef = useRef<Konva.Transformer>(null);
  const selNode = useRef<Konva.Group | null>(null);
  const gesture = useRef<{ pan?: { x: number; y: number }; pinch?: { d: number; c: P } } | null>(null);

  // ----- size and fit -----
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const cells = model.net.cells;
  const fit = useMemo(() => {
    const x0 = Math.min(...cells.map((c) => c.col)) - 0.6;
    const y0 = Math.min(...cells.map((c) => c.row)) - 0.6;
    const x1 = Math.max(...cells.map((c) => c.col + 1)) + 0.6;
    const y1 = Math.max(...cells.map((c) => c.row + 1)) + 0.6;
    const s = Math.min(size.w / (x1 - x0), size.h / (y1 - y0));
    return { x: (size.w - (x1 + x0) * s) / 2, y: (size.h - (y1 + y0) * s) / 2, s };
    // Refit only when the canvas size changes or on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);
  const v = view ?? fit;

  const validation = useMemo(() => validateNet(cells), [cells]);
  const badCells = new Set(validation.issues.flatMap((i) => i.cells ?? []).map((i) => cells[i]?.face));

  // ----- transformer follows the selected element -----
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selected ? selNode.current : null;
    tr.nodes(node && tool === 'select' && node.getStage() ? [node] : []);
    tr.getLayer()?.batchDraw();
  });

  // ----- coordinates -----
  const toWorld = (p: P): P => ({ x: (p.x - v.x) / v.s, y: (p.y - v.y) / v.s });
  const cellAt = (w: P) => cells.find((c) => w.x >= c.col && w.x < c.col + 1 && w.y >= c.row && w.y < c.row + 1);
  const local = (c: NetCell, w: P) => applyAffine(invert(faceToNet(c)), w);
  const stageRef = useRef<Konva.Stage>(null);
  const pointer = () => toWorld(stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 });

  const commit = (m: CubeModel, ref?: Ref) => {
    st().apply(m);
    if (ref) st().set({ selected: ref, selectedFace: ref.face });
  };

  // ----- drawing / placing -----
  const onDown = async (e: Konva.KonvaEventObject<PointerEvent>) => {
    const touches = (e.evt as unknown as TouchEvent).touches;
    if (touches && touches.length > 1) return;
    const w = pointer();
    const c = cellAt(w);
    if (DRAW_TOOLS.has(tool)) {
      if (!c) return;
      const p = local(c, w);
      setDraft({ face: c.face, tool, start: p, points: [p] });
      return;
    }
    if (!c) {
      if (e.target === e.target.getStage() || e.target.name() === 'bg') {
        st().set({ selected: null, selectedFace: null });
        gesture.current = { pan: { x: e.evt.clientX - v.x, y: e.evt.clientY - v.y } };
      }
      return;
    }
    const p = local(c, w);
    if (tool === 'text') {
      const text = window.prompt('Text, letter or number', 'A')?.trim();
      if (text) {
        const r = place(model, c.face, textElement(text, p, style));
        commit(r.model, r.ref);
      }
    } else if (tool === 'stamp') {
      const el = stampElement(style.stamp, p, style);
      if (el) {
        const r = place(model, c.face, el);
        commit(r.model, r.ref);
      }
    } else if (tool === 'image') {
      const file = await pickFile('image/*');
      if (!file) return;
      try {
        const a = await importImage(file);
        st().addAsset(a.id, a.data);
        const r = place(st().model!, c.face, imageElement(a.id, a.aspect, p));
        commit(r.model, r.ref);
      } catch (err) {
        st().showToast(err instanceof Error ? err.message : String(err));
      }
    } else if (tool === 'select' || tool === 'net' || tool === 'eraser') {
      if (e.target.name() === 'face-bg' || e.target.name() === 'bg') st().set({ selectedFace: c.face, selected: null });
    }
  };

  const onMove = () => {
    if (draft) {
      const c = cells.find((x) => x.face === draft.face)!;
      const p = local(c, pointer());
      setDraft({ ...draft, points: draft.tool === 'pen' ? [...draft.points, p] : [draft.start, p] });
    }
  };

  const onUp = () => {
    gesture.current = null;
    if (!draft) return;
    const pts = draft.points;
    const el = draft.tool === 'pen' ? penElement(pts, style) : shapeElement(st().tool, draft.start, pts[pts.length - 1], style);
    setDraft(null);
    if (!el) return;
    const r = place(model, draft.face, el);
    commit(r.model, r.ref);
  };

  // ----- pan / zoom (two fingers, wheel, one-finger drag on empty canvas) -----
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    const rect = box.current!.getBoundingClientRect();
    const a = { x: t[0].clientX - rect.left, y: t[0].clientY - rect.top };
    const b = { x: t[1].clientX - rect.left, y: t[1].clientY - rect.top };
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const g = gesture.current?.pinch;
    if (g) {
      const k = d / g.d;
      const s = Math.min(800, Math.max(20, v.s * k));
      const kk = s / v.s;
      setView({ s, x: c.x - (g.c.x - v.x) * kk, y: c.y - (g.c.y - v.y) * kk });
    }
    setDraft(null);
    gesture.current = { pinch: { d, c } };
  };
  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pan = gesture.current?.pan;
    const evt = e.evt as MouseEvent;
    if (pan && evt.clientX !== undefined && (evt.buttons ?? 1)) setView({ ...v, x: evt.clientX - pan.x, y: evt.clientY - pan.y });
    else onMove();
  };
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = stageRef.current!.getPointerPosition()!;
    const s = Math.min(800, Math.max(20, v.s * (e.evt.deltaY > 0 ? 0.9 : 1.1)));
    const k = s / v.s;
    setView({ s, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k });
  };

  // ----- element interaction -----
  const isSel = (ref: ElementRef) => !!selected && selected.id === ref.id && (ref.pattern ? selected.pattern === true && selected.face === ref.face : selected.face === ref.face);
  const elementNode = (e: ArtworkElement, t: Transform2, ref: ElementRef) => {
    const sel = isSel(ref);
    return (
      <Group
        key={`${ref.pattern ? 'p' : 'e'}:${e.id}:${ref.face}`}
        ref={sel ? (n) => void (selNode.current = n) : undefined}
        x={t.x}
        y={t.y}
        rotation={t.rotation}
        scaleX={t.scaleX}
        scaleY={t.scaleY}
        opacity={e.opacity}
        draggable={tool === 'select'}
        onPointerDown={(ev) => {
          if (tool === 'eraser') {
            ev.cancelBubble = true;
            commit(removeElement(model, ref));
            st().set({ selected: null });
          } else if (tool === 'select') {
            ev.cancelBubble = true;
            st().set({ selected: ref, selectedFace: ref.face });
          }
        }}
        onDragStart={() => setDragging(ref.face)}
        onDragMove={(ev) => {
          const n = ev.target;
          n.x(snapValue(n.x()));
          n.y(snapValue(n.y()));
        }}
        onDragEnd={(ev) => {
          setDragging(null);
          const n = ev.target;
          const r = updateElement(model, ref, { transform: { ...t, x: n.x(), y: n.y() } });
          commit(r.model, r.ref);
        }}
        onTransformEnd={(ev) => {
          const n = ev.target;
          const r = updateElement(model, ref, { transform: { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() } });
          commit(r.model, r.ref);
        }}
      >
        <ElementShape e={e} src={e.assetId ? assets[e.assetId] : undefined} />
      </Group>
    );
  };

  const faceGroup = (c: NetCell) => {
    const f = model.faces[c.face];
    const o = ORIGIN[c.turns];
    const isSelFace = selectedFace === c.face;
    return (
      <Group
        key={c.face}
        x={c.col + o.x}
        y={c.row + o.y}
        rotation={c.turns * 90}
        draggable={tool === 'net'}
        onDragEnd={(ev) => {
          const n = ev.target;
          const col = Math.round(n.x() - o.x);
          const row = Math.round(n.y() - o.y);
          n.position({ x: c.col + o.x, y: c.row + o.y });
          commit(moveCell(model, c.face, col, row));
          st().set({ selectedFace: c.face });
        }}
      >
        <Rect name="face-bg" x={0} y={0} width={1} height={1} fill={f.background} opacity={f.backgroundOpacity} />
        {/* Clipped to the face, except while an element is dragged across a fold. */}
        <Group clipFunc={dragging === c.face ? undefined : (ctx) => ctx.rect(0, 0, 1, 1)}>
          {f.elements.map((e) => elementNode(e, e.transform, { face: c.face, id: e.id }))}
          {model.patterns.flatMap((p) => p.fragments.filter((fr) => fr.face === c.face).map((fr) => elementNode(p.element, fr.transform, { face: c.face, id: p.id, pattern: true })))}
        </Group>
        <Text text={c.face} x={0.05} y={0.04} fontSize={11} scaleX={0.01} scaleY={0.01} fill="#868e96" listening={false} />
        <Rect
          x={0}
          y={0}
          width={1}
          height={1}
          stroke={badCells.has(c.face) ? '#e03131' : isSelFace ? ACCENT : '#343a40'}
          strokeWidth={isSelFace || badCells.has(c.face) ? 0.035 : 0.015}
          listening={false}
        />
      </Group>
    );
  };

  // Empty grid cells around the net (where faces can be dropped in Net mode).
  const ghosts: P[] = [];
  if (tool === 'net') {
    const x0 = Math.min(...cells.map((c) => c.col)) - 1;
    const y0 = Math.min(...cells.map((c) => c.row)) - 1;
    const x1 = Math.max(...cells.map((c) => c.col)) + 1;
    const y1 = Math.max(...cells.map((c) => c.row)) + 1;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (!cells.some((c) => c.col === x && c.row === y)) ghosts.push({ x, y });
  }

  const preview = (() => {
    if (!draft) return null;
    const c = cells.find((x) => x.face === draft.face)!;
    const el = draft.tool === 'pen' ? penElement(draft.points, style) : shapeElement(draft.tool as never, draft.start, draft.points[draft.points.length - 1], style);
    if (!el) return null;
    const o = ORIGIN[c.turns];
    return (
      <Group x={c.col + o.x} y={c.row + o.y} rotation={c.turns * 90} listening={false} opacity={0.8}>
        <Group x={el.transform.x} y={el.transform.y}>
          <ElementShape e={el} />
        </Group>
      </Group>
    );
  })();

  return (
    <div className="net-canvas" ref={box}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        onPointerDown={onDown}
        onPointerMove={onMouseMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onTouchMove={onTouchMove}
        onTouchEnd={() => (gesture.current = null)}
        onWheel={onWheel}
      >
        <Layer>
          <Rect name="bg" x={0} y={0} width={size.w} height={size.h} fill="transparent" />
          <Group x={v.x} y={v.y} scaleX={v.s} scaleY={v.s}>
            {ghosts.map((g) => (
              <Rect key={`${g.x},${g.y}`} x={g.x + 0.04} y={g.y + 0.04} width={0.92} height={0.92} stroke="#ced4da" strokeWidth={0.01} dash={[0.05, 0.05]} listening={false} />
            ))}
            {cells.map(faceGroup)}
            {preview}
            {tool === 'pen' && draft && draft.points.length > 1 && (
              <Line points={draft.points.flatMap((p) => { const w = applyAffine(faceToNet(cells.find((x) => x.face === draft.face)!), p); return [w.x, w.y]; })} stroke={style.stroke} strokeWidth={style.width} lineCap="round" lineJoin="round" listening={false} />
            )}
          </Group>
          <Transformer
            ref={trRef}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={6}
            anchorSize={18}
            borderStroke={ACCENT}
            anchorStroke={ACCENT}
            ignoreStroke
            boundBoxFunc={(o, n) => (Math.abs(n.width) < 8 || Math.abs(n.height) < 8 ? o : n)}
          />
        </Layer>
      </Stage>
      <div className={validation.valid ? 'net-status ok' : 'net-status bad'}>
        {validation.valid ? '✓ Valid cube net' : `⚠ Net cannot form a cube — ${validation.issues[0].message}`}
      </div>
      <button className="seg net-fit" onClick={() => setView(null)}>
        Fit
      </button>
    </div>
  );
}
