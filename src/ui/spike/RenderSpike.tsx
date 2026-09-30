import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Stage } from 'react-konva';
import type Konva from 'konva';
import { fmt, frameStats } from './stats';

// M0 spike, part 1 (ADR-0002, NFR-P-01): Konva in the Android WebView with
// 300 synthetic polylines. "Pan" moves the stage (transform only); "Re-project"
// changes every point of every line each frame through React, the way a
// vanishing-point drag will re-project every object.

const LINES = 300;
const POINTS = 12;
const RUN_MS = 5000;

type Mode = 'pan' | 'reproject';

function makeLines(width: number, height: number): number[][] {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: LINES }, () => {
    let x = rand() * width;
    let y = rand() * height;
    const pts: number[] = [];
    for (let i = 0; i < POINTS; i++) {
      pts.push(x, y);
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 60;
    }
    return pts;
  });
}

export interface RenderResult {
  mode: Mode;
  fps: number;
  p50: number;
  p95: number;
  worst: number;
}

export function RenderSpike({ width, height, onResult }: { width: number; height: number; onResult: (r: RenderResult) => void }) {
  const base = useMemo(() => makeLines(width, height), [width, height]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [phase, setPhase] = useState(0);
  const stageRef = useRef<Konva.Stage>(null);
  const [last, setLast] = useState<RenderResult | null>(null);

  useEffect(() => {
    if (!mode) return;
    const times: number[] = [];
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      times.push(t);
      const k = (t - start) / 1000;
      if (mode === 'pan') {
        stageRef.current?.position({ x: Math.sin(k * 2) * 40, y: Math.cos(k * 2) * 40 });
      } else {
        setPhase(k);
      }
      if (t - start < RUN_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        const r = { mode, ...frameStats(times) };
        setLast(r);
        onResult(r);
        stageRef.current?.position({ x: 0, y: 0 });
        setPhase(0);
        setMode(null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, onResult]);

  // Re-project: every point moves with the phase (a cheap stand-in for a new camera).
  const lines =
    mode === 'reproject'
      ? base.map((pts) => pts.map((v, i) => v + Math.sin(phase * 3 + i * 0.1) * (i % 2 ? 12 : 18)))
      : base;

  return (
    <div className="spike-panel">
      <div className="spike-canvas">
        <Stage ref={stageRef} width={width} height={height} listening={false}>
          <Layer>
            {lines.map((pts, i) => (
              <Line key={i} points={pts} stroke="#495057" strokeWidth={1} lineCap="round" lineJoin="round" />
            ))}
          </Layer>
        </Stage>
      </div>
      <div className="spike-actions">
        <button disabled={mode !== null} onClick={() => setMode('pan')}>Run pan test (5 s)</button>
        <button disabled={mode !== null} onClick={() => setMode('reproject')}>Run re-project test (5 s)</button>
      </div>
      <p className="spike-status">
        {mode
          ? `Running ${mode}…`
          : last
            ? `${last.mode}: ${fmt(last.fps)} fps · frame p50 ${fmt(last.p50)} ms · p95 ${fmt(last.p95)} ms · worst ${fmt(last.worst)} ms`
            : `${LINES} polylines × ${POINTS} points. Keep the phone still while a test runs.`}
      </p>
    </div>
  );
}
