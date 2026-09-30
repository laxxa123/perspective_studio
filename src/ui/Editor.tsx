// The editor (§10.2): full-bleed canvas, top bar, bottom toolbar with a
// contextual mini bar, inspector sheet, layers / display panels.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Crosshair,
  Layers,
  Lock,
  LockOpen,
  Map as MapIcon,
  Maximize2,
  MoreVertical,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  Redo2,
  SlidersHorizontal,
  SunMoon,
  Undo2,
} from 'lucide-react';
import { deleteEntities, duplicateEntities, renameDocument } from '../core/commands/commands';
import { allBounds, paperBounds } from '../core/derive/derive';
import { DISPLAY_PRESETS, presetOf } from '../core/derive/display';
import { kindOf } from '../core/entities/registry';
import type { KnownEntity } from '../core/document/types';
import { ANCHOR_MARGIN_PP } from '../core/math/tolerance';
import { forbiddenBand, pointHandles, type PerspectiveHandleId } from '../core/perspective';
import { fitRect, stageTransform, type Viewport } from '../core/viewport/viewport';
import { exportJson, exportPng, exportSvg, fileSafe } from '../export/exporters';
import { shareFile } from '../platform/files';
import { onPause } from '../platform/lifecycle';
import { SceneView, type Overlay } from '../render/konva/SceneView';
import { cameraOf, renderModelOf } from '../state/derived';
import { useDocumentStore } from '../state/documentStore';
import { useSettingsStore } from '../state/settingsStore';
import { useUiStore, type ToolId } from '../state/uiStore';
import { attachInputRouter } from '../tools/inputRouter';
import { notePen, perspectiveTool, toolEnv, toolFor } from '../tools/registry';
import { selectionHandles } from '../tools/selectTool';
import { idleTool } from '../tools/types';
import type { Theme } from '../theme/theme';
import { ContextMenu } from './ContextMenu';
import { DisplayPanel } from './DisplayPanel';
import { Inspector } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { OffscreenChips } from './OffscreenChips';
import { closeDocument, saveNow, savePrefs, scheduleSave } from './session';
import { PlanPanel } from './PlanPanel';
import { ShapesMenu } from './ShapesMenu';
import { ToolOptions } from './ToolOptions';
import { shapeOptions } from '../core/entities/registry';
import { useWindowSize } from './useWindowSize';

/** Screen space kept clear of the bars when fitting. */
export const FIT_INSETS = { top: 90, right: 56, bottom: 170, left: 56 };

const shapeLabel = (shape: { kind: string; option: string }) =>
  shapeOptions().find((o) => o.kind === shape.kind && o.id === shape.option)?.label ?? 'Shapes';

/** Handles whose drag can hit the PV-2 band, so it is shaded meanwhile (§10.5). */
const BAND_HANDLES: PerspectiveHandleId[] = ['vpV', 'horizon', 'vpL', 'vpR'];

const TOOLS: { id: ToolId; label: string; icon: typeof Box; key: string }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, key: 'v' },
  { id: 'shape', label: 'Shapes', icon: Box, key: 'b' },
  { id: 'sketch', label: 'Sketch', icon: PenLine, key: 's' },
  { id: 'perspective', label: 'Persp.', icon: Crosshair, key: 'p' },
];

export function Editor({ theme }: { theme: Theme }) {
  const { w, h } = useWindowSize();
  const doc = useDocumentStore((s) => s.doc)!;
  const revision = useDocumentStore((s) => s.revision);
  const canUndo = useDocumentStore((s) => s.history.past.length > 0);
  const canRedo = useDocumentStore((s) => s.history.future.length > 0);
  const { viewport, tool, perspectiveLocked, dragging, selection, display, panel, toast, live, marquee, workingPlane, planOpen, shape } = useUiStore();
  const handedness = useSettingsStore((s) => s.handedness);
  const ui = useUiStore.getState;
  const [menuOpen, setMenuOpen] = useState(false);

  // ----- autosave (DOC-02, NFR-R-01) -----
  useEffect(() => {
    if (revision > 0) scheduleSave();
  }, [revision]);
  useEffect(() => onPause(() => void saveNow()), []);
  useEffect(() => {
    if (!viewport) return;
    const t = setTimeout(() => savePrefs(doc.id, { viewport, display, workingPlane }), 400);
    return () => clearTimeout(t);
  }, [viewport, display, workingPlane, doc.id]);

  // ----- initial viewport -----
  useEffect(() => {
    if (!ui().viewport) ui().setViewport(fitRect(paperBounds(doc.paper), w, h, FIT_INSETS));
  }, [doc.paper, w, h, ui]);

  // ----- input router (CV-02) -----
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    return attachInputRouter(el, {
      getViewport: () => useUiStore.getState().viewport!,
      setViewport: (v: Viewport) => useUiStore.getState().setViewport(v),
      getTool: () => {
        const s = useUiStore.getState();
        if (s.tool === 'perspective' && s.perspectiveLocked) return idleTool;
        return toolFor(s.tool);
      },
      undo: () => useDocumentStore.getState().undo(),
      redo: () => useDocumentStore.getState().redo(),
      onPen: notePen,
    });
  }, []);

  const fitPaper = () => ui().setViewport(fitRect(paperBounds(doc.paper), w, h, FIT_INSETS));
  const fitAll = () => ui().setViewport(fitRect(allBounds(doc.perspective, doc.paper), w, h, FIT_INSETS));

  const deleteSelection = () => {
    if (!selection.length) return;
    useDocumentStore.getState().run(deleteEntities(selection));
    ui().select([]);
  };
  const duplicateSelection = () => {
    if (!selection.length) return;
    const out: string[] = [];
    useDocumentStore.getState().run(duplicateEntities(selection, out));
    ui().select(out);
  };

  // ----- keyboard (desktop, §10.3) -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const ds = useDocumentStore.getState();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) ds.redo();
        else ds.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        ds.redo();
      } else if (mod && k === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (!mod && (k === 'delete' || k === 'backspace')) {
        deleteSelection();
      } else if (!mod && !e.altKey) {
        const t = TOOLS.find((x) => x.key === k);
        if (t && !(t.id === 'perspective' && ui().perspectiveLocked)) ui().setTool(t.id);
        else if (k === 'f') fitAll();
        else if (k === 'g') ui().set({ display: { ...ui().display, guides: !ui().display.guides } });
        else if (k === 'c') ui().set({ display: presetOf(ui().display) === 'construction' ? DISPLAY_PRESETS.clean : DISPLAY_PRESETS.construction });
        else if (k === 'escape') ui().select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const model = renderModelOf(doc, display, selection, workingPlane);
  const selSet = useMemo(() => new Set(selection), [selection]);

  // ----- overlay -----
  const editingPerspective = tool === 'perspective' && !perspectiveLocked;
  const drawing = live.length > 0;
  const overlay: Overlay = { handles: [], active: dragging, band: null, marquee, live };
  if (editingPerspective) {
    overlay.handles = pointHandles(doc.perspective).map((hd) => ({ id: hd.id, label: hd.label, family: hd.family, x: hd.point.x, y: hd.point.y, big: true }));
    overlay.band =
      dragging === 'anchor'
        ? { top: -1e6, bottom: doc.perspective.horizonY + ANCHOR_MARGIN_PP }
        : dragging && BAND_HANDLES.includes(dragging)
          ? forbiddenBand(doc.perspective)
          : null;
  } else if (tool === 'select') {
    overlay.handles = selectionHandles(toolEnv).map(({ handle }) => ({
      id: handle.id,
      family: handle.family,
      x: handle.point.x,
      y: handle.point.y,
      glyph: handle.kind === 'lift' ? ('lift' as const) : undefined,
    }));
  }
  // Off-screen indicator for a selected entity entirely behind the camera (§6.5).
  const behind =
    selection.length === 1 &&
    (() => {
      const e = doc.entities[selection[0]] as KnownEntity | undefined;
      const def = e && !('unknown' in e) ? kindOf(e.kind) : undefined;
      return !!def && !!e && def.depth(e, { cam: cameraOf(doc.perspective), ps: doc.perspective, display, selected: true }) !== null && def.bounds(e, { cam: cameraOf(doc.perspective), ps: doc.perspective, display, selected: true }) === null;
    })();

  const exportAs = async (fmt: 'png1' | 'png2' | 'png4' | 'svg' | 'json') => {
    setMenuOpen(false);
    try {
      await saveNow();
      const base = fileSafe(doc.name);
      if (fmt === 'svg') await shareFile(`${base}.svg`, new Blob([exportSvg(doc, display)], { type: 'image/svg+xml' }));
      else if (fmt === 'json') await shareFile(`${base}.json`, new Blob([exportJson(doc)], { type: 'application/json' }));
      else await shareFile(`${base}.png`, await exportPng(doc, display, Number(fmt.slice(3)) as 1 | 2 | 4));
    } catch (e) {
      ui().showToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="editor">
      <div className="surface" ref={surface}>
        {viewport && (
          <SceneView
            width={w}
            height={h}
            transform={stageTransform(viewport)}
            model={model}
            selection={selSet}
            dimObjects={editingPerspective}
            overlay={overlay}
            theme={theme}
          />
        )}
      </div>

      {viewport && (
        <OffscreenChips perspective={doc.perspective} viewport={viewport} width={w} height={h} canDrag={editingPerspective} tool={perspectiveTool} theme={theme} />
      )}

      <header className={drawing ? 'topbar hidden' : 'topbar'}>
        <button className="icon" aria-label="Back to gallery" onClick={() => void closeDocument()}>
          <ArrowLeft size={20} />
        </button>
        <span className="title">{doc.name}</span>
        <button className="icon" aria-label="Undo" disabled={!canUndo} onClick={() => useDocumentStore.getState().undo()}>
          <Undo2 size={20} />
        </button>
        <button className="icon" aria-label="Redo" disabled={!canRedo} onClick={() => useDocumentStore.getState().redo()}>
          <Redo2 size={20} />
        </button>
        {/* CV-04: quick zoom, always one tap away. */}
        <button className="icon" aria-label="Fit page" title="Fit page" onClick={fitPaper}>
          <RectangleHorizontal size={20} />
        </button>
        <button className="icon" aria-label="Fit page and all VPs" title="Fit page + all VPs (F)" onClick={fitAll}>
          <Maximize2 size={20} />
        </button>
        <button className={planOpen ? 'icon on' : 'icon'} aria-label="Plan view" title="Plan view" onClick={() => ui().set({ planOpen: !planOpen })}>
          <MapIcon size={20} />
        </button>
        <button className={panel === 'layers' ? 'icon on wide-only' : 'icon wide-only'} aria-label="Layers" onClick={() => ui().set({ panel: panel === 'layers' ? 'none' : 'layers' })}>
          <Layers size={20} />
        </button>
        <button className={panel === 'display' ? 'icon on wide-only' : 'icon wide-only'} aria-label="Display" onClick={() => ui().set({ panel: panel === 'display' ? 'none' : 'display' })}>
          <SunMoon size={20} />
        </button>
        <button className="icon" aria-label="More" onClick={() => setMenuOpen(!menuOpen)}>
          <MoreVertical size={20} />
        </button>
      </header>

      {menuOpen && (
        <div className="ctx-backdrop" onPointerDown={() => setMenuOpen(false)}>
          <div className="menu more" onPointerDown={(e) => e.stopPropagation()}>
            <button className="narrow-only" onClick={() => { ui().set({ panel: 'layers' }); setMenuOpen(false); }}><Layers size={16} /> Layers</button>
            <button className="narrow-only" onClick={() => { ui().set({ panel: 'display' }); setMenuOpen(false); }}><SunMoon size={16} /> Display</button>
            <button onClick={() => { ui().set({ perspectiveLocked: !perspectiveLocked, tool: tool === 'perspective' && !perspectiveLocked ? 'select' : tool }); setMenuOpen(false); }}>
              {perspectiveLocked ? <LockOpen size={16} /> : <Lock size={16} />} {perspectiveLocked ? 'Unlock perspective' : 'Lock perspective'}
            </button>
            <button onClick={() => { ui().set({ panel: 'inspector' }); ui().select([]); setMenuOpen(false); }}><SlidersHorizontal size={16} /> Scene settings</button>
            <button onClick={() => {
              setMenuOpen(false);
              const name = window.prompt('Scene name', doc.name)?.trim();
              if (name) useDocumentStore.getState().run(renameDocument(name));
            }}>Rename</button>
            <hr />
            <button onClick={() => exportAs('png1')}>Export PNG 1×</button>
            <button onClick={() => exportAs('png2')}>Export PNG 2×</button>
            <button onClick={() => exportAs('png4')}>Export PNG 4×</button>
            <button onClick={() => exportAs('svg')}>Export SVG</button>
            <button onClick={() => exportAs('json')}>Export JSON</button>
          </div>
        </div>
      )}

      {panel === 'layers' && <LayersPanel doc={doc} />}
      {panel === 'display' && <DisplayPanel onFitPaper={fitPaper} />}
      {panel === 'shapes' && <ShapesMenu />}
      <div className={`bottom-stack ${handedness}${drawing ? ' drawing' : ''}`}>
        {/* Stacked above the tool bars so nothing overlaps; on phones the plan view takes the inspector's slot (OD-10, §10.1). */}
        {planOpen && !drawing && <PlanPanel doc={doc} theme={theme} width={Math.min(w - 40, 420)} height={Math.round(Math.min(h * 0.4, 360))} />}
        {panel !== 'layers' && panel !== 'display' && (!planOpen || w >= 820) && !drawing && <Inspector doc={doc} theme={theme} />}
        <ToolOptions doc={doc} theme={theme} />
        <nav className="toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'tool active' : 'tool'}
              disabled={t.id === 'perspective' && perspectiveLocked}
              onClick={() => {
                // UI-01: the Shapes button opens its submenu (and selects the tool).
                if (t.id === 'shape') ui().set({ tool: 'shape', panel: panel === 'shapes' ? 'none' : 'shapes', selection: [] });
                else ui().setTool(t.id);
              }}
              title={`${t.label} (${t.key.toUpperCase()})`}
            >
              <t.icon size={20} />
              <span>{t.id === 'shape' ? shapeLabel(shape) : t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <ContextMenu doc={doc} />
      {behind && <div className="toast">The selected object is behind the camera.</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
