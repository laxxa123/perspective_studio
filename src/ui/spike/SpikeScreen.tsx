import { useCallback, useState } from 'react';
import { PenSpike, type PenResult } from './PenSpike';
import { RenderSpike, type RenderResult } from './RenderSpike';
import { fmt } from './stats';

/** M0 risk spike (ADR-0002): measures rendering and pen input on the device. */
export function SpikeScreen({ width, height }: { width: number; height: number }) {
  const [tab, setTab] = useState<'render' | 'pen'>('render');
  const [render, setRender] = useState<Partial<Record<RenderResult['mode'], RenderResult>>>({});
  const [pen, setPen] = useState<PenResult | null>(null);
  const [copied, setCopied] = useState(false);

  const onRender = useCallback((r: RenderResult) => setRender((prev) => ({ ...prev, [r.mode]: r })), []);
  const onPen = useCallback((r: PenResult) => setPen(r), []);

  const canvasW = Math.min(width - 32, 900);
  const canvasH = Math.max(240, Math.min(height - 330, 700));

  const report = [
    `PERSPECTIVE_STUDIO M0 spike — ${__APP_VERSION__}`,
    `Device: ${navigator.userAgent}`,
    `Screen: ${window.screen.width}×${window.screen.height} CSS px, devicePixelRatio ${window.devicePixelRatio}, canvas ${canvasW}×${canvasH}`,
    ...(['pan', 'reproject'] as const).map((m) => {
      const r = render[m];
      return r
        ? `Render ${m}: ${fmt(r.fps)} fps, frame p50 ${fmt(r.p50)} ms, p95 ${fmt(r.p95)} ms, worst ${fmt(r.worst)} ms`
        : `Render ${m}: not run`;
    }),
    pen
      ? `Pen: ${pen.events} events, types [${pen.types}], pressure ${fmt(pen.pressureMin, 2)}–${fmt(pen.pressureMax, 2)}, coalesced ${pen.coalescedSupported ? `supported, ${fmt(pen.coalescedAvg)}/event` : 'not supported'}, ~${fmt(pen.rateHz, 0)} Hz, event→frame p50 ${fmt(pen.toFrameP50)} ms p95 ${fmt(pen.toFrameP95)} ms`
      : 'Pen: not run',
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the results', report);
    }
  };

  return (
    <div className="spike">
      <header className="spike-head">
        <strong>PERSPECTIVE STUDIO</strong>
        <span className="muted">{__APP_VERSION__} · M0 device check</span>
      </header>
      <nav className="spike-tabs">
        <button className={tab === 'render' ? 'active' : ''} onClick={() => setTab('render')}>1 · Rendering</button>
        <button className={tab === 'pen' ? 'active' : ''} onClick={() => setTab('pen')}>2 · Pen input</button>
      </nav>
      {tab === 'render' ? (
        <RenderSpike width={canvasW} height={canvasH} onResult={onRender} />
      ) : (
        <PenSpike width={canvasW} height={canvasH} onResult={onPen} />
      )}
      <pre className="spike-report">{report}</pre>
      <button className="primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy results'}</button>
    </div>
  );
}
