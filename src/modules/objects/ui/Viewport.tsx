// The 3D block viewport (OBJECTS §A.7): one finger turns the camera, two
// fingers pan and zoom, a tap adds or removes a block. Pinch never changes
// the object.
import { useEffect, useRef, useState } from 'react';
import type { Blocks, Cell, Hole } from '../core/blocks';
import { BlockScene, type Hit } from '../render/BlockScene';

const TAP_SLOP = 8;

export function Viewport({ blocks, marked = null, holes = [], onTap, frameKey }: { blocks: Blocks; marked?: Cell | null; holes?: readonly Hole[]; onTap: (h: Hit | null) => void; frameKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BlockScene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(blocks);
  const markedRef = useRef(marked);
  const holesRef = useRef(holes);
  useEffect(() => {
    latest.current = blocks;
    markedRef.current = marked;
    holesRef.current = holes;
  }, [blocks, marked, holes]);

  useEffect(() => {
    const el = box.current!;
    try {
      scene.current = new BlockScene(canvas.current!);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('3D is not available on this device.');
      return;
    }
    let framed = false;
    const ro = new ResizeObserver(() => {
      scene.current?.resize(el.clientWidth, el.clientHeight);
      // Frame once the real size is known.
      if (!framed && el.clientWidth && el.clientHeight) {
        framed = true;
        scene.current?.frame(latest.current);
      }
    });
    ro.observe(el);
    scene.current.resize(el.clientWidth, el.clientHeight);
    scene.current.setBlocks(latest.current, markedRef.current, holesRef.current);
    return () => {
      ro.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => scene.current?.setBlocks(blocks, marked, holes), [blocks, marked, holes]);
  useEffect(() => {
    if (frameKey) scene.current?.frame(latest.current);
  }, [frameKey]);

  // Gestures.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ x0: number; y0: number; moved: boolean; multi: boolean; mid?: { x: number; y: number }; d?: number } | null>(null);
  const two = () => {
    const [a, b] = [...ptrs.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) g.current = { x0: e.clientX, y0: e.clientY, moved: false, multi: false };
    else if (ptrs.current.size === 2 && g.current) Object.assign(g.current, { multi: true, moved: true }, two());
  };
  const move = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId);
    const s = g.current;
    if (!p || !s) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2) {
      const t = two();
      if (s.mid && s.d) {
        scene.current?.pan(t.mid.x - s.mid.x, t.mid.y - s.mid.y, box.current!.clientHeight);
        scene.current?.zoom(s.d / Math.max(1, t.d));
      }
      Object.assign(s, t);
      return;
    }
    if (s.multi) return;
    if (!s.moved && Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > TAP_SLOP) s.moved = true;
    if (s.moved) scene.current?.orbit(dx * 0.01, dy * 0.01);
  };
  const up = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const s = g.current;
    if (ptrs.current.size === 0) {
      g.current = null;
      if (s && !s.moved && e.type === 'pointerup') {
        const r = box.current!.getBoundingClientRect();
        onTap(scene.current?.hit(e.clientX - r.left, e.clientY - r.top, r.width, r.height) ?? null);
      }
    } else if (s) {
      // One finger left after a two-finger gesture: it does nothing until lifted.
      s.mid = undefined;
      s.d = undefined;
    }
  };

  return (
    <div className="ob-view" ref={box}>
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => scene.current?.zoom(e.deltaY > 0 ? 1.1 : 0.9)}
        onContextMenu={(e) => e.preventDefault()}
      />
      {error && <div className="ob-note">{error}</div>}
    </div>
  );
}
