import { useEffect, useMemo, useRef } from 'react';
import { Crosshair, Lock, LockOpen, Maximize2, MousePointer2, RectangleHorizontal } from 'lucide-react';
import { allBounds, deriveScene, paperBounds } from '../core/derive/derive';
import {
  forbiddenBand,
  pointHandles,
  setMode,
  type PerspectiveHandleId,
  type PerspectiveMode,
} from '../core/perspective';
import { ANCHOR_MARGIN_PP } from '../core/math/tolerance';
import { fitRect, stageTransform, type Viewport } from '../core/viewport/viewport';
import { haptics } from '../platform/haptics';
import { SceneView, type Overlay } from '../render/konva/SceneView';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore, type ToolId } from '../state/uiStore';
import { attachInputRouter } from '../tools/inputRouter';
import { createPerspectiveTool } from '../tools/perspectiveTool';
import { idleTool, type Tool } from '../tools/types';
import { OffscreenChips } from './OffscreenChips';
import { useWindowSize } from './useWindowSize';
import { loadViewport, saveViewport } from './viewportPersistence';

/** Screen space kept clear of the bars when fitting. */
export const FIT_INSETS = { top: 90, right: 56, bottom: 150, left: 56 };

/** Handles whose drag can hit the PV-2 band, so it is shaded meanwhile (§10.5). */
const BAND_HANDLES: PerspectiveHandleId[] = ['vpV', 'horizon', 'vpL', 'vpR'];

export function Editor() {
  const { w, h } = useWindowSize();
  const perspective = useDocumentStore((s) => s.perspective);
  const paper = useDocumentStore((s) => s.paper);
  const docId = useDocumentStore((s) => s.id);
  const { viewport, tool, perspectiveLocked, dragging } = useUiStore();
  const ui = useUiStore.getState;

  // ----- viewport: restored per document (CV-03), else fit to paper -----
  useEffect(() => {
    if (useUiStore.getState().viewport) return;
    ui().setViewport(loadViewport(docId) ?? fitRect(paperBounds(paper), w, h, FIT_INSETS));
    // Only on first show.
  }, [docId, paper, w, h, ui]);
  useEffect(() => {
    if (!viewport) return;
    const t = window.setTimeout(() => saveViewport(docId, viewport), 300);
    return () => window.clearTimeout(t);
  }, [viewport, docId]);

  // ----- tools & input router (CV-02) -----
  const perspectiveTool = useMemo(
    () =>
      createPerspectiveTool({
        getPerspective: () => useDocumentStore.getState().perspective,
        setPerspective: (ps) => useDocumentStore.getState().setPerspective(ps),
        getViewport: () => useUiStore.getState().viewport!,
        setDragging: (d) => useUiStore.getState().setDragging(d),
        haptics,
      }),
    [],
  );
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    return attachInputRouter(el, {
      getViewport: () => useUiStore.getState().viewport!,
      setViewport: (v: Viewport) => useUiStore.getState().setViewport(v),
      getTool: (): Tool => {
        const s = useUiStore.getState();
        return s.tool === 'perspective' && !s.perspectiveLocked ? perspectiveTool : idleTool;
      },
    });
  }, [perspectiveTool]);

  const fitPaper = () => ui().setViewport(fitRect(paperBounds(paper), w, h, FIT_INSETS));
  const fitAll = () => ui().setViewport(fitRect(allBounds(perspective, paper), w, h, FIT_INSETS));

  // Keyboard (desktop, §10.3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'v') ui().setTool('select');
      else if (k === 'p' && !useUiStore.getState().perspectiveLocked) ui().setTool('perspective');
      else if (k === 'f') fitAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const model = useMemo(() => deriveScene(perspective, paper), [perspective, paper]);

  const editing = tool === 'perspective' && !perspectiveLocked;
  const overlay: Overlay | null = editing && viewport
    ? {
        handles: pointHandles(perspective).map((hd) => ({ id: hd.id, label: hd.label, family: hd.family, x: hd.point.x, y: hd.point.y })),
        active: dragging,
        band:
          dragging === 'anchor'
            ? { top: -1e6, bottom: perspective.horizonY + ANCHOR_MARGIN_PP }
            : dragging && BAND_HANDLES.includes(dragging)
              ? forbiddenBand(perspective)
              : null,
      }
    : null;

  const tools: { id: ToolId; label: string; icon: typeof Crosshair; disabled?: boolean }[] = [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'perspective', label: 'Perspective', icon: Crosshair, disabled: perspectiveLocked },
  ];

  return (
    <div className="editor">
      {/* Always mounted: the input router attaches to it once. */}
      <div className="surface" ref={surface}>
        {viewport && (
          <SceneView width={w} height={h} transform={stageTransform(viewport)} model={model} dimObjects={editing} overlay={overlay} />
        )}
      </div>

      {viewport && <OffscreenChips
        perspective={perspective}
        viewport={viewport}
        width={w}
        height={h}
        canDrag={editing}
        onDragStart={(id, pp) => perspectiveTool.startDrag(id, pp)}
        tool={perspectiveTool}
      />}

      <header className="topbar">
        <span className="title">Untitled scene</span>
        <button className="icon" title="Fit paper" aria-label="Fit paper" onClick={fitPaper}>
          <RectangleHorizontal size={20} />
        </button>
        <button className="icon" title="Fit all (F)" aria-label="Fit all" onClick={fitAll}>
          <Maximize2 size={20} />
        </button>
        <button
          className={perspectiveLocked ? 'icon on' : 'icon'}
          title={perspectiveLocked ? 'Perspective locked' : 'Lock perspective'}
          aria-label={perspectiveLocked ? 'Unlock perspective' : 'Lock perspective'}
          aria-pressed={perspectiveLocked}
          onClick={() => ui().setPerspectiveLocked(!perspectiveLocked)}
        >
          {perspectiveLocked ? <Lock size={20} /> : <LockOpen size={20} />}
        </button>
      </header>

      {editing && (
        <div className="minibar" role="group" aria-label="Perspective mode">
          {(['2pt', '3pt'] as PerspectiveMode[]).map((m) => (
            <button
              key={m}
              className={perspective.mode === m ? 'seg active' : 'seg'}
              onClick={() => useDocumentStore.getState().setPerspective(setMode(perspective, m))}
            >
              {m === '2pt' ? '2-point' : '3-point'}
            </button>
          ))}
        </div>
      )}

      <nav className="toolbar">
        {tools.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'tool active' : 'tool'}
            disabled={t.disabled}
            onClick={() => ui().setTool(t.id)}
            title={t.label}
          >
            <t.icon size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
