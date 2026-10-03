// The drawing screen (SKETCH §4, §5): the canvas fills the phone; a few
// floating controls stay put while drawing (an open panel closes).
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RasterEngine } from '../engine/RasterEngine';
import { PointerInput } from '../input/PointerInput';
import { projectStore } from '../storage/ProjectStore';
import { useSketchStore } from '../state/useSketchStore';
import { onPause } from '../../../platform/lifecycle';
import { haptics } from '../../../platform/haptics';
import { engineRef, saveNow, scheduleSave, syncBrush } from './session';
import { ToolBar } from './ToolBar';
import { Panels } from './Panels';
import { SelectionBar } from './SelectionBar';
import { Eyedropper } from './Eyedropper';

const st = useSketchStore.getState;

/** The theme's page colour (around the canvas) as linear 0..1 RGB. */
function pageColor(el: HTMLElement): number[] {
  const css = getComputedStyle(el).getPropertyValue('--sk-page').trim() || '#e9e9e6';
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = css;
  const hex = c.fillStyle as string;
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function SketchScreen({ projectId }: { projectId: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'lost' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const drawing = useSketchStore((s) => s.drawing);
  const picking = useSketchStore((s) => s.picking);

  useEffect(() => {
    let alive = true;
    let engine: RasterEngine | null = null;
    let input: PointerInput | null = null;
    let ro: ResizeObserver | null = null;
    const cleanups: (() => void)[] = [];
    const canvas = canvasRef.current!;
    const box = wrap.current!;
    (async () => {
      const store = await projectStore();
      const p = await store.load(projectId);
      if (!alive) return;
      if (!p) throw new Error('This sketch could not be found.');
      engine = new RasterEngine(canvas, p.doc);
      engineRef.current = engine;
      engine.setPageColor(pageColor(box));
      engine.loadTiles(p.tiles);
      for (const r of p.doc.references) {
        const blob = await store.asset(r.assetId);
        if (blob && alive) engine.setReferenceImage(r.assetId, await createImageBitmap(blob));
      }
      if (!alive) return;
      syncBrush();
      const mirror = () => {
        const e = engineRef.current;
        if (!e) return;
        const s = st();
        // A finished selection returns to drawing (inside it); a transform that ended returns too.
        const mode = (e.hasSelection && !s.hasSelection && (s.mode === 'rect' || s.mode === 'lasso')) || (!e.floating && s.mode === 'transform') ? 'draw' : s.mode;
        s.set({ doc: e.doc, canUndo: e.canUndo, canRedo: e.canRedo, hasSelection: e.hasSelection, floating: !!e.floating, mode });
        if (e.lost) setStatus('lost');
      };
      cleanups.push(engine.subscribe(mirror));
      cleanups.push(engine.onDirty(() => scheduleSave()));
      mirror();
      const resize = () => {
        const r = box.getBoundingClientRect();
        engine?.resize(r.width, r.height, Math.min(3, window.devicePixelRatio || 1));
      };
      resize();
      if (st().settings.defaultZoom === 'actual') engine.actualSize();
      ro = new ResizeObserver(resize);
      ro.observe(box);
      input = new PointerInput(canvas, engine, {
        mode: () => st().mode,
        fingerDraw: () => st().settings.fingerDraw,
        tapUndo: () => st().settings.tapUndo,
        tapRedo: () => st().settings.tapRedo,
        onStroke: (active) => {
          if (active) st().set({ drawing: true, panel: 'none' });
          else st().set({ drawing: false });
        },
        onRefused: (why) => st().showToast(why === 'locked' ? 'This layer is locked' : 'This layer is hidden'),
        onUndo: () => {
          engineRef.current?.undo();
          st().showToast('Undo');
        },
        onRedo: () => {
          engineRef.current?.redo();
          st().showToast('Redo');
        },
        onReference: (r) => {
          const e = engineRef.current;
          if (e) e.setReferences(e.doc.references.map((x) => (x.id === r.id ? r : x)));
        },
        onTap: () => st().set({ panel: 'none' }),
        onSnap: () => haptics.tick(),
      });
      cleanups.push(onPause(() => void saveNow()));
      setStatus('ready');
    })().catch((e) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    });
    const unsubBrush = useSketchStore.subscribe((s, prev) => {
      if (s.presetId !== prev.presetId || s.color !== prev.color || s.sizeLevel !== prev.sizeLevel || s.opacityLevel !== prev.opacityLevel || s.snap !== prev.snap || s.settings.presets !== prev.settings.presets) syncBrush();
    });
    return () => {
      alive = false;
      unsubBrush();
      cleanups.forEach((f) => f());
      ro?.disconnect();
      input?.dispose();
      const e = engine;
      if (e) {
        if (e.stroking) e.strokeEnd();
        e.commitFloating();
        void saveNow(e).finally(() => {
          if (engineRef.current === e) engineRef.current = null;
          e.dispose();
        });
      }
      st().set({ doc: null, panel: 'none', mode: 'draw', drawing: false, picking: false, hasSelection: false, floating: false });
    };
  }, [projectId, attempt]);

  return (
    <div className={`sk-screen${drawing ? ' drawing' : ''}`}>
      <div className="sk-canvas" ref={wrap}>
        <canvas key={attempt} ref={canvasRef} aria-label="Sketch canvas" />
      </div>
      {status === 'loading' && (
        <div className="sk-center">
          <Loader2 className="spin" size={28} />
        </div>
      )}
      {status === 'error' && (
        <div className="sk-center sk-card">
          <p>{error}</p>
          <button className="sk-btn" onClick={() => st().set({ page: 'gallery', projectId: null })}>
            Back to sketches
          </button>
        </div>
      )}
      {status === 'lost' && (
        <div className="sk-center sk-card">
          <p>The display was reset by the system. Your sketch was autosaved.</p>
          <button
            className="sk-btn primary"
            onClick={() => {
              setStatus('loading');
              setAttempt((a) => a + 1);
            }}
          >
            Reopen
          </button>
        </div>
      )}
      {status === 'ready' && (
        <>
          {picking ? (
            <Eyedropper />
          ) : (
            <>
              <ToolBar />
              <SelectionBar />
              <Panels />
            </>
          )}
        </>
      )}
    </div>
  );
}
