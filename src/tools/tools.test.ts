import { describe, expect, it, vi } from 'vitest';
import { execute, emptyHistory, begin as beginTxn, preview as previewTxn, commit as commitTxn, type Transaction } from '../core/commands/history';
import { DEFAULT_DISPLAY } from '../core/derive/display';
import { deriveDocument } from '../core/derive/derive';
import { newDocument } from '../core/document/factory';
import type { BoxEntity, SceneDocument, StrokeEntity } from '../core/document/types';
import { project } from '../core/perspective/camera';
import { cameraFromEye, DEFAULT_PERSPECTIVE, perspectiveOf, type PerspectiveSystem } from '../core/perspective';
import { toScreen, type Viewport } from '../core/viewport/viewport';
import { DEFAULT_SKETCH, type SketchSettings } from '../state/uiStore';
import type { ToolEnv } from './env';
import { createPerspectiveTool, hitHandle } from './perspectiveTool';
import { createPlaceTool } from './placeTool';
import { createSelectTool, selectionHandles } from './selectTool';
import { createSketchTool } from './sketchTool';
import type { ToolInput } from './types';

const viewport: Viewport = { offsetX: -200, offsetY: -100, zoom: 0.5 };

function fakeEnv(sketch: Partial<SketchSettings> = {}) {
  let doc: SceneDocument = newDocument({ name: 'T' });
  let history = emptyHistory();
  let txn: Transaction | null = null;
  let selection: string[] = [];
  const toast = vi.fn();
  const env: ToolEnv = {
    doc: () => doc,
    cam: () => cameraFromEye(doc.eye),
    display: () => DEFAULT_DISPLAY,
    model: () => deriveDocument(doc, DEFAULT_DISPLAY, new Set(selection)),
    selection: () => selection,
    select: (ids) => (selection = ids),
    run: (cmd) => ({ doc, history } = execute(doc, history, cmd)),
    begin: (label) => (txn = beginTxn(doc, label)),
    preview: (r) => (doc = previewTxn(txn!, r)),
    commit: () => {
      ({ doc, history } = commitTxn(txn!, history));
      txn = null;
    },
    cancel: () => {
      doc = txn!.base;
      txn = null;
    },
    setLive: () => undefined,
    setMarquee: () => undefined,
    openContextMenu: () => undefined,
    toast,
    haptics: { tick: () => undefined },
    snapStep: () => null,
    targetLayer: (role) => doc.layers.find((l) => l.role === role)!.id,
    afterPlace: () => undefined,
    sketch: () => ({ ...DEFAULT_SKETCH, ...sketch }),
    shape: () => ({ kind: 'box', option: 'box' }),
    workingPlane: () => null,
    multi: () => false,
    penSeen: () => false,
  };
  const at = (pp: { x: number; y: number }, extra: Partial<ToolInput> = {}): ToolInput => ({
    pp,
    screen: toScreen(viewport, pp),
    pointerType: 'touch',
    pressure: 0.5,
    buttons: 1,
    shift: false,
    pxToPp: 1 / viewport.zoom,
    ...extra,
  });
  return { env, at, get: () => doc, history: () => history, toast };
}

const cubeOf = (doc: SceneDocument) => Object.values(doc.entities).find((e) => e.kind === 'box') as BoxEntity;

describe('select tool (BX-03)', () => {
  it('selects on tap and deselects on empty tap', () => {
    const t = fakeEnv();
    const tool = createSelectTool(t.env);
    const cube = cubeOf(t.get());
    const c = project(t.env.cam(), { x: 0, y: 0, z: 0.5 })!;
    tool.down(t.at(c));
    tool.up(t.at(c));
    expect(t.env.selection()).toEqual([cube.id]);
    const empty = { x: 600, y: 750 };
    tool.down(t.at(empty));
    tool.up(t.at(empty));
    expect(t.env.selection()).toEqual([]);
  });

  it('moves the body in one undo step', () => {
    const t = fakeEnv();
    const tool = createSelectTool(t.env);
    const cam = t.env.cam();
    const from = project(cam, { x: 0, y: 0, z: 0 })!;
    const to = project(cam, { x: 2, y: 0, z: 0 })!;
    tool.down(t.at(from));
    tool.move(t.at({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }));
    tool.move(t.at(to));
    tool.up(t.at(to));
    expect(cubeOf(t.get()).position.x).toBeCloseTo(1.5, 6);
    expect(t.history().past).toHaveLength(1);
  });

  it('resizes through a handle', () => {
    const t = fakeEnv();
    const tool = createSelectTool(t.env);
    t.env.select([cubeOf(t.get()).id]);
    const h = selectionHandles(t.env).find((x) => x.handle.family === 'V')!.handle;
    tool.down(t.at(h.point));
    tool.move(t.at({ x: h.point.x, y: h.point.y - 100 }));
    tool.up(t.at({ x: h.point.x, y: h.point.y - 100 }));
    expect(cubeOf(t.get()).size.z).toBeGreaterThan(1);
  });

  it('does not pick locked entities', () => {
    const t = fakeEnv();
    const cube = cubeOf(t.get());
    t.env.run({ label: 'lock', recipe: (d) => void ((d.entities[cube.id] as BoxEntity).locked = true) });
    const tool = createSelectTool(t.env);
    const c = project(t.env.cam(), { x: 0, y: 0, z: 0.5 })!;
    tool.down(t.at(c));
    tool.up(t.at(c));
    expect(t.env.selection()).toEqual([]);
  });
});

describe('box tool (BX-02, BX-06)', () => {
  it('places a cube on the ground, on top of a box, and not above the horizon', () => {
    const t = fakeEnv();
    const tool = createPlaceTool(t.env);
    const cam = t.env.cam();
    const ground = project(cam, { x: 3, y: 0, z: 0 })!;
    tool.down(t.at(ground));
    tool.up(t.at(ground));
    const top = project(cam, { x: 0, y: 0, z: 1 })!;
    tool.down(t.at(top));
    tool.up(t.at(top));
    const boxes = Object.values(t.get().entities) as BoxEntity[];
    expect(boxes).toHaveLength(3);
    expect(boxes.some((b) => Math.abs(b.position.z - 1) < 1e-9)).toBe(true);
    tool.down(t.at({ x: 600, y: 100 }));
    tool.up(t.at({ x: 600, y: 100 }));
    expect(Object.values(t.get().entities)).toHaveLength(3);
    expect(t.toast).toHaveBeenCalled();
  });

  it('places a wall rect', () => {
    const t = fakeEnv();
    t.env.shape = () => ({ kind: 'rect', option: 'wallR' });
    const tool = createPlaceTool(t.env);
    const p = project(t.env.cam(), { x: 3, y: 0, z: 0 })!;
    tool.down(t.at(p));
    tool.up(t.at(p));
    expect(Object.values(t.get().entities).some((e) => e.kind === 'rect')).toBe(true);
  });
});

describe('shapes tool above the horizon (BX-02 revised, BX-08, RC-02, PL-01)', () => {
  it('hangs a box under a ceiling and places on the working plane', () => {
    const t = fakeEnv();
    t.env.shape = () => ({ kind: 'rect', option: 'ceiling' });
    const tool = createPlaceTool(t.env);
    const up = project(t.env.cam(), { x: 0, y: 0, z: 2.7 })!;
    tool.down(t.at(up));
    tool.up(t.at(up));
    expect(Object.values(t.get().entities).some((e) => e.kind === 'rect' && (e as { position: { z: number } }).position.z === 2.7)).toBe(true);
    t.env.shape = () => ({ kind: 'box', option: 'box' });
    tool.down(t.at(up));
    tool.up(t.at(up));
    const lamp = Object.values(t.get().entities).find((e) => e.kind === 'box' && (e as BoxEntity).position.z > 1) as BoxEntity;
    expect(lamp.position.z + lamp.size.z).toBeCloseTo(2.7, 6);
  });

  it('uses the working plane above the horizon', () => {
    const t = fakeEnv();
    t.env.workingPlane = () => 2.4;
    const tool = createPlaceTool(t.env);
    tool.down(t.at({ x: 600, y: 100 }));
    tool.up(t.at({ x: 600, y: 100 }));
    const b = Object.values(t.get().entities).find((e) => e.kind === 'box' && (e as BoxEntity).position.z > 0) as BoxEntity;
    expect(b.position.z + b.size.z).toBeCloseTo(2.4, 6);
  });
});

describe('multi-select on touch (UI-04)', () => {
  it('toggles membership in Multi mode', () => {
    const t = fakeEnv();
    const cube = cubeOf(t.get());
    t.env.multi = () => true;
    const tool = createSelectTool(t.env);
    const c = project(t.env.cam(), { x: 0, y: 0, z: 0.5 })!;
    tool.down(t.at(c));
    tool.up(t.at(c));
    expect(t.env.selection()).toEqual([cube.id]);
    tool.down(t.at(c));
    tool.up(t.at(c));
    expect(t.env.selection()).toEqual([]);
  });
});

describe('sketch tool (SK-01, SK-03, SK-04)', () => {
  const drawLine = (t: ReturnType<typeof fakeEnv>, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const tool = createSketchTool(t.env);
    tool.down(t.at(a));
    for (let k = 1; k <= 10; k++) tool.move(t.at({ x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 + (k % 2 ? 1 : -1) }));
    tool.up(t.at(b));
    return Object.values(t.get().entities).find((e) => e.kind === 'stroke') as StrokeEntity;
  };

  it('draws a stroke with pressure triples', () => {
    const t = fakeEnv();
    const s = drawLine(t, { x: 100, y: 700 }, { x: 300, y: 650 });
    expect(s.points.length % 3).toBe(0);
    expect(s.constraint).toBeUndefined();
  });

  it('locks to a family while drawing', () => {
    const t = fakeEnv({ snap: 'locked', family: 'V' });
    const s = drawLine(t, { x: 600, y: 600 }, { x: 640, y: 780 });
    expect(s.constraint).toEqual({ family: 'V', mode: 'locked' });
  });

  it('soft-snaps a nearly straight stroke toward a VP', () => {
    const t = fakeEnv({ snap: 'soft' });
    const ps = perspectiveOf(t.get().eye)!;
    const a = { x: 600, y: 600 };
    const b = { x: a.x + (ps.vpRightX - a.x) * 0.2, y: a.y + (ps.horizonY - a.y) * 0.2 };
    expect(drawLine(t, a, b).constraint).toEqual({ family: 'R', mode: 'soft' });
  });

  it('erases whole strokes it sweeps over', () => {
    const t = fakeEnv();
    drawLine(t, { x: 100, y: 700 }, { x: 300, y: 700 });
    const eraser = createSketchTool({ ...t.env, sketch: () => ({ ...DEFAULT_SKETCH, eraser: true }) });
    eraser.down(t.at({ x: 200, y: 650 }));
    eraser.move(t.at({ x: 200, y: 750 }));
    eraser.up(t.at({ x: 200, y: 750 }));
    expect(Object.values(t.get().entities).some((e) => e.kind === 'stroke')).toBe(false);
  });
});

describe('perspective tool (PS-03)', () => {
  function setup() {
    let ps: PerspectiveSystem = DEFAULT_PERSPECTIVE;
    let base = ps;
    const tick = vi.fn();
    const commit = vi.fn();
    const tool = createPerspectiveTool({
      getPerspective: () => ps,
      getViewport: () => viewport,
      begin: () => (base = ps),
      preview: (p) => (ps = p),
      commit,
      cancel: () => (ps = base),
      setDragging: () => undefined,
      haptics: { tick },
    });
    const at = (pp: { x: number; y: number }) => fakeEnv().at(pp);
    return { tool, at, get: () => ps, tick, commit };
  }

  it('hits VPs, then the horizon', () => {
    const ps = DEFAULT_PERSPECTIVE;
    const vpl = toScreen(viewport, { x: ps.vpLeftX, y: ps.horizonY });
    expect(hitHandle(ps, viewport, { x: vpl.x + 10, y: vpl.y + 10 })).toBe('vpL');
    const mid = toScreen(viewport, { x: 600, y: ps.horizonY });
    expect(hitHandle(ps, viewport, { x: mid.x, y: mid.y + 12 })).toBe('horizon');
    expect(hitHandle(ps, viewport, { x: mid.x, y: mid.y + 200 })).toBeNull();
  });

  it('drags without jumping, ticks on clamp, commits once, cancels', () => {
    const t = setup();
    t.tool.down(t.at({ x: -690, y: 285 }));
    t.tool.move(t.at({ x: -890, y: 285 }));
    expect(t.get().vpLeftX).toBeCloseTo(-900);
    t.tool.up(t.at({ x: -890, y: 285 }));
    expect(t.commit).toHaveBeenCalledTimes(1);
    t.tool.down(t.at({ x: 600, y: 3200 }));
    t.tool.move(t.at({ x: 600, y: 320 }));
    t.tool.move(t.at({ x: 600, y: 310 }));
    expect(t.tick).toHaveBeenCalledTimes(1);
    t.tool.cancel();
    expect(t.get().vpVerticalY).toBe(3200);
  });
});
