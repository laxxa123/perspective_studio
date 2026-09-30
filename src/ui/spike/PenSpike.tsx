import { useEffect, useRef, useState } from 'react';
import { Layer, Line, Stage } from 'react-konva';
import type Konva from 'konva';
import { fmt, percentile } from './stats';

// M0 spike, part 2 (ADR-0002, NFR-P-02, SK-02): pointer input in the WebView.
// Records which pointer types arrive, whether pressure varies, how many
// coalesced events each pointermove carries, the event rate, and the time
// from an event to the next animation frame (a lower bound on input latency).

interface Sample {
  type: string;
  pressure: number;
  coalesced: number;
  toFrame: number;
  t: number;
}

export interface PenResult {
  events: number;
  types: string;
  pressureMin: number;
  pressureMax: number;
  coalescedAvg: number;
  rateHz: number;
  toFrameP50: number;
  toFrameP95: number;
  coalescedSupported: boolean;
}

function summarize(samples: Sample[]): PenResult | null {
  if (samples.length < 2) return null;
  const types = [...new Set(samples.map((s) => s.type))].join(', ');
  const pressures = samples.map((s) => s.pressure);
  const span = samples[samples.length - 1].t - samples[0].t;
  const coalescedTotal = samples.reduce((a, s) => a + s.coalesced, 0);
  return {
    events: samples.length,
    types,
    pressureMin: Math.min(...pressures),
    pressureMax: Math.max(...pressures),
    coalescedAvg: coalescedTotal / samples.length,
    rateHz: span > 0 ? ((coalescedTotal || samples.length) * 1000) / span : NaN,
    toFrameP50: percentile(samples.map((s) => s.toFrame), 50),
    toFrameP95: percentile(samples.map((s) => s.toFrame), 95),
    coalescedSupported: typeof PointerEvent !== 'undefined' && 'getCoalescedEvents' in PointerEvent.prototype,
  };
}

export function PenSpike({ width, height, onResult }: { width: number; height: number; onResult: (r: PenResult) => void }) {
  const samples = useRef<Sample[]>([]);
  const lineRef = useRef<Konva.Line>(null);
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [result, setResult] = useState<PenResult | null>(null);
  const drawing = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e: PointerEvent) => {
      drawing.current = true;
      el.setPointerCapture(e.pointerId);
      lineRef.current?.points(local(e));
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const pts = lineRef.current?.points() ?? [];
      for (const ce of events.length ? events : [e]) pts.push(...local(ce));
      lineRef.current?.points(pts);
      lineRef.current?.getLayer()?.batchDraw();
      const stamp = e.timeStamp;
      requestAnimationFrame((frame) => {
        samples.current.push({
          type: e.pointerType,
          pressure: e.pressure,
          coalesced: events.length,
          toFrame: frame - stamp,
          t: stamp,
        });
      });
    };
    const up = () => {
      if (!drawing.current) return;
      drawing.current = false;
      const pts = lineRef.current?.points() ?? [];
      if (pts.length) setStrokes((s) => [...s, [...pts]]);
      lineRef.current?.points([]);
      const r = summarize(samples.current);
      if (r) {
        setResult(r);
        onResult(r);
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [onResult]);

  return (
    <div className="spike-panel">
      <div className="spike-canvas" ref={box}>
        <Stage width={width} height={height} listening={false}>
          <Layer>
            {strokes.map((pts, i) => (
              <Line key={i} points={pts} stroke="#212529" strokeWidth={2} lineCap="round" lineJoin="round" />
            ))}
            <Line ref={lineRef} points={[]} stroke="#1c7ed6" strokeWidth={2} lineCap="round" lineJoin="round" />
          </Layer>
        </Stage>
      </div>
      <div className="spike-actions">
        <button
          onClick={() => {
            samples.current = [];
            setStrokes([]);
            setResult(null);
          }}
        >
          Clear
        </button>
      </div>
      <p className="spike-status">
        {result
          ? `${result.events} events · ${result.types} · pressure ${fmt(result.pressureMin, 2)}–${fmt(result.pressureMax, 2)} · coalesced ${fmt(result.coalescedAvg)}/event · ${fmt(result.rateHz, 0)} Hz · event→frame p50 ${fmt(result.toFrameP50)} ms, p95 ${fmt(result.toFrameP95)} ms`
          : 'Draw a few strokes with your finger, then with a stylus if you have one.'}
      </p>
    </div>
  );
}
