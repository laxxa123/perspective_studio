// Live 3D cube (CUBE §20, §21): drag to turn, pinch / wheel to zoom, standard
// views, tap a face to select it — the same selection as the net.
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { FACE_IDS, type CubeModel, type FaceId } from '../model/CubeModel';
import { cubeState } from '../geometry/FoldingEngine';
import { CubeRenderer, type StandardView } from '../cube3d/CubeRenderer';
import { faceSvg } from '../render/Svg';
import { svgToCanvas } from '../render/rasterize';

interface Props {
  model: CubeModel;
  assets: Record<string, string>;
  selected: FaceId | null;
  onSelect: (f: FaceId | null) => void;
}

const VIEWS: [StandardView, string][] = [
  ['front', 'Front'],
  ['top', 'Top'],
  ['right', 'Right'],
];

export function Cube3DViewer({ model, assets, selected, onSelect }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const r = useRef<CubeRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = cubeState(model.net.cells);

  useEffect(() => {
    if (!canvas.current || !box.current) return;
    try {
      r.current = new CubeRenderer(canvas.current);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('3D is not available on this device.');
      return;
    }
    const el = box.current;
    const ro = new ResizeObserver(() => r.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    r.current.resize(el.clientWidth, el.clientHeight);
    return () => {
      ro.disconnect();
      r.current?.dispose();
      r.current = null;
    };
  }, []);

  // Re-texture when the model changes (debounced; textures come from the same SVG as every figure).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const s = cubeState(model.net.cells);
      if (!s) {
        r.current?.setCube(null, {});
        return;
      }
      const tex: Partial<Record<FaceId, HTMLCanvasElement>> = {};
      await Promise.all(FACE_IDS.map(async (f) => (tex[f] = await svgToCanvas(faceSvg(model, f, assets, 256, { label: true }), 256, 256).catch(() => undefined))));
      if (!cancelled) r.current?.setCube(s, tex);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [model, assets]);

  useEffect(() => r.current?.highlight(selected), [selected]);

  // Gestures: one pointer turns, two pinch-zoom; a tap selects.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number; moved: boolean; dist: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    start.current = { x: e.clientX, y: e.clientY, moved: ps.length > 1, dist: ps.length === 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0 };
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !start.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    if (ps.length === 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      if (start.current.dist) r.current?.zoomBy(start.current.dist / d);
      start.current.dist = d;
      start.current.moved = true;
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6) start.current.moved = true;
    if (start.current.moved) r.current?.rotateBy(dx * 0.012, dy * 0.012);
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const s = start.current;
    if (s && !s.moved && pointers.current.size === 0 && box.current) {
      const rect = box.current.getBoundingClientRect();
      onSelect(r.current?.pick(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height) ?? null);
    }
    if (pointers.current.size === 0) start.current = null;
  };

  return (
    <div className="cube3d" ref={box}>
      <canvas
        ref={canvas}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => r.current?.zoomBy(e.deltaY > 0 ? 1.1 : 0.9)}
      />
      {(error || !state) && <div className="cube3d-note">{error ?? '⚠ Net cannot form a cube'}</div>}
      <div className="cube3d-views">
        <button className="seg" aria-label="Reset view" title="Reset" onClick={() => r.current?.show('iso')}>
          <RotateCcw size={15} />
        </button>
        {VIEWS.map(([v, l]) => (
          <button key={v} className="seg" onClick={() => r.current?.show(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
