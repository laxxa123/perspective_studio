// The Net Canvas (CUBE §10, §13, §18, §21; v1.2): Konva renders and edits
// the unfolded net on a fixed 4 × 4 board; every change goes back to the
// CubeModel through pure edits. World units = board cells; faces are drawn in
// their own face-local frame. Drawings may start anywhere on the board and are
// trimmed to the faces; faces move only with the Net tool.
import { useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Group, Image as KImage, Layer, Line, Path, Rect, Shape, Stage, Text, Transformer } from 'react-konva';
import type { ArtworkElement, CubeModel, FaceId, NetCell, Transform2 } from '../model/CubeModel';
import { place, moveCell, setFace, updateElement, removeElement, type Ref } from '../model/edit';
import { validateNet } from '../geometry/NetValidator';
import { applyAffine, faceToNet, invert } from '../geometry/Orientation';
import { overlappingFaces } from '../geometry/PatternContinuity';
import { anchorCell, boardSize, clampCell, SNAP_STEPS, snapToPoint } from '../geometry/Board';
import { penElement, shapeElement, stampElement, textElement } from '../canvas/Interaction';
import { useCubeStore, type ElementRef, type Skin } from '../state/useCubeStore';

type P = { x: number; y: number };

const ORIGIN: Record<number, P> = { 0: { x: 0, y: 0 }, 1: { x: 1, y: 0 }, 2: { x: 1, y: 1 }, 3: { x: 0, y: 1 } };
const ACCENT = '#1c7ed6';
const DRAW_TOOLS = new Set(['pen', 'shape']);
/** Tools that show the faces' snap points. */
const SNAP_TOOLS = new Set(['select', 'shape', 'text', 'stamp']);

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

/** The image being placed: the whole picture faint, the part over the faces solid, with handles. */
function SkinNode({ skin, src, cells, trRef }: { skin: Skin; src?: string; cells: readonly NetCell[]; trRef: React.RefObject<Konva.Transformer | null> }) {
  const img = useImage(src);
  const node = useRef<Konva.Group>(null);
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(node.current ? [node.current] : []);
    tr.getLayer()?.batchDraw();
  });
  if (!img) return null;
  const pic = <KImage image={img} x={-skin.w / 2} y={-skin.h / 2} width={skin.w} height={skin.h} />;
  const save = (n: Konva.Node) => {
    const w = skin.w * n.scaleX();
    const h = skin.h * n.scaleY();
    n.scale({ x: 1, y: 1 });
    useCubeStore.getState().set({ skin: { ...skin, x: n.x(), y: n.y(), w, h, rotation: n.rotation() } });
  };
  return (
    <>
      <Group x={skin.x} y={skin.y} rotation={skin.rotation} opacity={0.35} listening={false}>
        {pic}
      </Group>
      <Group listening={false} clipFunc={(ctx) => cells.forEach((c) => ctx.rect(c.col, c.row, 1, 1))}>
        <Group x={skin.x} y={skin.y} rotation={skin.rotation}>
          {pic}
        </Group>
      </Group>
      <Group
        ref={node}
        x={skin.x}
        y={skin.y}
        rotation={skin.rotation}
        draggable
        onPointerDown={(e) => (e.cancelBubble = true)}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          save(e.target);
        }}
        onTransformEnd={(e) => save(e.target)}
      >
        <Rect x={-skin.w / 2} y={-skin.h / 2} width={skin.w} height={skin.h} fill="transparent" />
      </Group>
    </>
  );
}

export function NetCanvas({ model, assets }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 300 });
  const [view, setView] = useState<{ x: number; y: number; s: number } | null>(null);
  const [draft, setDraft] = useState<{ tool: string; start: P; points: P[] } | null>(null);
  const [dragging, setDragging] = useState<FaceId | null>(null);
  const tool = useCubeStore((s) => s.tool);
  const style = useCubeStore((s) => s.style);
  const selected = useCubeStore((s) => s.selected);
  const selectedFace = useCubeStore((s) => s.selectedFace);
  const skin = useCubeStore((s) => s.skin);
  const st = useCubeStore.getState;
  const trRef = useRef<Konva.Transformer>(null);
  const skinTr = useRef<Konva.Transformer>(null);
  const selNode = useRef<Konva.Group | null>(null);
  const gesture = useRef<{ pan?: { x: number; y: number }; pinch?: { d: number; c: P } } | null>(null);

  // ----- size and fit (the whole board) -----
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const cells = model.net.cells;
  const board = boardSize(cells);
  const fit = useMemo(() => {
    const m = 0.2;
    const s = Math.min(size.w / (board.cols + 2 * m), (size.h - 44) / (board.rows + 2 * m));
    return { x: (size.w - board.cols * s) / 2, y: (size.h - 44 - board.rows * s) / 2, s };
  }, [size.w, size.h, board.cols, board.rows]);
  const v = view ?? fit;

  const validation = useMemo(() => validateNet(cells), [cells]);
  const badCells = new Set(validation.issues.flatMap((i) => i.cells ?? []).map((i) => cells[i]?.face));

  // ----- transformer follows the selected element -----
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selected ? selNode.current : null;
    tr.nodes(node && tool === 'select' && !skin && node.getStage() ? [node] : []);
    tr.getLayer()?.batchDraw();
  });

  // ----- coordinates -----
  const toWorld = (p: P): P => ({ x: (p.x - v.x) / v.s, y: (p.y - v.y) / v.s });
  const cellAt = (w: P) => cells.find((c) => w.x >= c.col && w.x < c.col + 1 && w.y >= c.row && w.y < c.row + 1);
  const onBoard = (w: P) => w.x >= 0 && w.y >= 0 && w.x <= board.cols && w.y <= board.rows;
  const local = (c: NetCell, w: P) => applyAffine(invert(faceToNet(c)), w);
  /** A board point pulled onto the nearest snap point of the face under it. */
  const snapWorld = (w: P): P => {
    const c = cellAt(w);
    return c ? applyAffine(faceToNet(c), snapToPoint(local(c, w))) : w;
  };
  const stageRef = useRef<Konva.Stage>(null);
  const pointer = () => toWorld(stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 });

  const commit = (m: CubeModel, ref?: Ref) => {
    st().apply(m);
    if (ref) st().set({ selected: ref, selectedFace: ref.face });
  };

  // ----- drawing / placing -----
  const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const touches = (e.evt as unknown as TouchEvent).touches;
    if (touches && touches.length > 1) return;
    const w = pointer();
    const c = cellAt(w);
    if (DRAW_TOOLS.has(tool) && !skin && onBoard(w)) {
      const p = tool === 'pen' ? w : snapWorld(w);
      setDraft({ tool, start: p, points: [p] });
      return;
    }
    if (!c) {
      if (e.target === e.target.getStage() || e.target.name() === 'bg' || e.target.name() === 'board') {
        st().set({ selected: null, selectedFace: null });
        gesture.current = { pan: { x: e.evt.clientX - v.x, y: e.evt.clientY - v.y } };
      }
      return;
    }
    const p = snapToPoint(local(c, w));
    if (tool === 'text') {
      const text = window.prompt('Text, letter or number', 'A')?.trim();
      if (text) {
        const r = place(model, c.face, textElement(text, p, style, style.size));
        commit(r.model, r.ref);
      }
    } else if (tool === 'stamp') {
      const el = stampElement(style.stamp, p, style, style.size);
      if (el) {
        const r = place(model, c.face, el);
        commit(r.model, r.ref);
      }
    } else if (tool === 'fill') {
      st().apply(setFace(model, c.face, { background: style.faceFill, backgroundOpacity: 1 }));
      st().set({ selectedFace: c.face });
    } else if (tool === 'select' || tool === 'net' || tool === 'eraser') {
      if (e.target.name() === 'face-bg' || e.target.name() === 'bg') st().set({ selectedFace: c.face, selected: null });
    }
  };

  const onMove = () => {
    if (!draft) return;
    const w = pointer();
    setDraft({ ...draft, points: draft.tool === 'pen' ? [...draft.points, w] : [draft.start, snapWorld(w)] });
  };

  const onUp = () => {
    gesture.current = null;
    if (!draft) return;
    const pts = draft.points;
    setDraft(null);
    // The drawing belongs to the face under its middle; off-face parts are trimmed by the faces' clips.
    const anchor = anchorCell(cells, pts);
    const lp = pts.map((p) => local(anchor, p));
    const el = draft.tool === 'pen' ? penElement(lp, style) : shapeElement(style.shape, lp[0], lp[lp.length - 1], style);
    if (!el) return;
    if (!overlappingFaces(el, el.transform, anchor.face, model.net).length) {
      st().showToast('Draw over the faces — the bare board is trimmed away.');
      return;
    }
    const r = place(model, anchor.face, el);
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
        draggable={tool === 'select' && !skin}
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
        // Element drags must never reach the face below (it would move the face).
        onDragStart={(ev) => {
          ev.cancelBubble = true;
          setDragging(ref.face);
        }}
        onDragMove={(ev) => {
          ev.cancelBubble = true;
          const n = ev.target;
          n.position(snapToPoint(n.position()));
        }}
        onDragEnd={(ev) => {
          ev.cancelBubble = true;
          setDragging(null);
          const n = ev.target;
          const r = updateElement(model, ref, { transform: { ...t, x: n.x(), y: n.y() } });
          commit(r.model, r.ref);
        }}
        onTransformEnd={(ev) => {
          ev.cancelBubble = true;
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
          if (ev.target !== ev.currentTarget) return;
          const n = ev.target;
          const at = clampCell(Math.round(n.x() - o.x), Math.round(n.y() - o.y), board);
          n.position({ x: c.col + o.x, y: c.row + o.y });
          commit(moveCell(model, c.face, at.col, at.row));
          st().set({ selectedFace: c.face });
        }}
      >
        <Rect name="face-bg" x={0} y={0} width={1} height={1} fill={f.background} opacity={f.backgroundOpacity} />
        {/* Clipped to the face (trims what runs off it), except while an element is dragged across a fold. */}
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

  const preview = (() => {
    if (!draft || draft.tool === 'pen') return null;
    const el = shapeElement(style.shape, draft.start, draft.points[draft.points.length - 1], style);
    if (!el) return null;
    return (
      <Group x={el.transform.x} y={el.transform.y} listening={false} opacity={0.8}>
        <ElementShape e={el} />
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
            {/* The 4 × 4 board: a hairline grid. */}
            <Rect name="board" x={0} y={0} width={board.cols} height={board.rows} fill="transparent" />
            <Shape
              listening={false}
              stroke="#ced4da"
              strokeWidth={1}
              strokeScaleEnabled={false}
              sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                for (let x = 0; x <= board.cols; x++) {
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, board.rows);
                }
                for (let y = 0; y <= board.rows; y++) {
                  ctx.moveTo(0, y);
                  ctx.lineTo(board.cols, y);
                }
                ctx.strokeShape(shape);
              }}
            />
            {cells.map(faceGroup)}
            {/* Soft snap points inside each face. */}
            {SNAP_TOOLS.has(tool) && !skin && (
              <Shape
                listening={false}
                fill="#adb5bd"
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath();
                  for (const c of cells) {
                    const m = faceToNet(c);
                    for (const sx of SNAP_STEPS) {
                      for (const sy of SNAP_STEPS) {
                        const p = applyAffine(m, { x: sx, y: sy });
                        ctx.moveTo(p.x + 0.014, p.y);
                        ctx.arc(p.x, p.y, 0.014, 0, Math.PI * 2);
                      }
                    }
                  }
                  ctx.fillShape(shape);
                }}
              />
            )}
            {skin && <SkinNode skin={skin} src={assets[skin.assetId]} cells={cells} trRef={skinTr} />}
            {preview}
            {draft?.tool === 'pen' && draft.points.length > 1 && (
              <Line points={draft.points.flatMap((p) => [p.x, p.y])} stroke={style.stroke} strokeWidth={style.width} lineCap="round" lineJoin="round" listening={false} />
            )}
          </Group>
          <Transformer
            ref={trRef}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={6}
            anchorSize={16}
            padding={8}
            borderStroke={ACCENT}
            anchorStroke={ACCENT}
            ignoreStroke
            boundBoxFunc={(o, n) => (Math.abs(n.width) < 8 || Math.abs(n.height) < 8 ? o : n)}
          />
          <Transformer ref={skinTr} keepRatio rotationSnaps={[0, 90, 180, 270]} rotationSnapTolerance={6} anchorSize={20} borderStroke={ACCENT} anchorStroke={ACCENT} />
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
