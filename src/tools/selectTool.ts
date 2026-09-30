// Select tool (§10.4, BX-03): tap to select (Shift adds), drag the body to
// move, drag handles to resize / lift, long press for the context menu,
// marquee with a mouse. Every drag is one transaction.
import { hitRect, hitTest } from '../core/derive/hitTest';
import { kindOf } from '../core/entities/registry';
import { MOVE_HANDLE, type DeriveCtx, type HandleDef } from '../core/entities/types';
import type { Entity, Id, KnownEntity } from '../core/document/types';
import { dist2, type Vec2 } from '../core/math/vec';
import { isEditable, type ToolEnv } from './env';
import { LONG_PRESS_MS, TAP_SLOP_PX, type Tool, type ToolInput } from './types';

/** Touch radius of an object handle, screen px. */
export const OBJECT_HANDLE_HIT_PX = 24;
/** Pick tolerance around edges and strokes, screen px. */
export const PICK_TOL_PX = 10;

export function selectionHandles(env: ToolEnv): { entity: KnownEntity; handle: HandleDef }[] {
  const sel = env.selection();
  if (sel.length !== 1) return [];
  const doc = env.doc();
  const e = doc.entities[sel[0]];
  if (!e || 'unknown' in e || !isEditable(doc, e.id)) return [];
  const def = kindOf(e.kind);
  if (!def) return [];
  const ctx: DeriveCtx = { cam: env.cam(), ps: doc.perspective, display: env.display(), selected: true };
  return def.handles(e, ctx).map((handle) => ({ entity: e, handle }));
}

type Press =
  | { kind: 'handle'; entity: KnownEntity; handleId: string; start: Vec2; startScreen: Vec2; dragging: boolean }
  | { kind: 'body'; id: Id; start: Vec2; startScreen: Vec2; dragging: boolean; starts: Map<Id, KnownEntity> }
  | { kind: 'empty'; start: Vec2; startScreen: Vec2; marquee: boolean };

export function createSelectTool(env: ToolEnv): Tool {
  let press: Press | null = null;
  let longPress: ReturnType<typeof setTimeout> | undefined;

  const pickable = (id: Id) => isEditable(env.doc(), id);

  const applyDrag = (i: ToolInput) => {
    if (!press || press.kind === 'empty') return;
    const doc = env.doc();
    const ctx: DeriveCtx = { cam: env.cam(), ps: doc.perspective, display: env.display(), selected: true };
    const others = Object.values(doc.entities) as Entity[];
    const snapStep = env.snapStep();
    if (press.kind === 'handle') {
      const e = press.entity;
      const patch = kindOf(e.kind)!.applyHandle(e, press.handleId, { start: e, startPp: press.start, pp: i.pp, snapStep, others }, ctx);
      env.preview((d) => void Object.assign(d.entities[e.id], patch));
      return;
    }
    const patches = [...press.starts.values()].map((e) => ({
      id: e.id,
      patch: kindOf(e.kind)!.applyHandle(e, MOVE_HANDLE, { start: e, startPp: press!.start, pp: i.pp, snapStep, others }, ctx),
    }));
    env.preview((d) => {
      for (const { id, patch } of patches) Object.assign(d.entities[id], patch);
    });
  };

  return {
    down(i) {
      clearTimeout(longPress);
      const tolPp = PICK_TOL_PX * i.pxToPp;
      // 1. Handles of the selected entity.
      for (const { entity, handle } of selectionHandles(env)) {
        if (dist2(handle.point, i.pp) <= OBJECT_HANDLE_HIT_PX * i.pxToPp) {
          press = { kind: 'handle', entity, handleId: handle.id, start: i.pp, startScreen: i.screen, dragging: false };
          return;
        }
      }
      // 2. An entity.
      const id = hitTest(env.model().items, i.pp, tolPp, pickable);
      if (id) {
        press = { kind: 'body', id, start: i.pp, startScreen: i.screen, dragging: false, starts: new Map() };
        longPress = setTimeout(() => {
          if (press?.kind === 'body' && !press.dragging) {
            env.select([id]);
            env.haptics.tick();
            env.openContextMenu(id, press.startScreen);
            press = null;
          }
        }, LONG_PRESS_MS);
        return;
      }
      // 3. Empty canvas: a marquee with a mouse / pen (desktop, §10.4).
      press = { kind: 'empty', start: i.pp, startScreen: i.screen, marquee: i.pointerType !== 'touch' };
    },

    move(i) {
      if (!press) return;
      const moved = dist2(i.screen, press.startScreen) > TAP_SLOP_PX;
      if (press.kind === 'empty') {
        if (press.marquee && moved) {
          const x = Math.min(press.start.x, i.pp.x);
          const y = Math.min(press.start.y, i.pp.y);
          env.setMarquee({ x, y, width: Math.abs(i.pp.x - press.start.x), height: Math.abs(i.pp.y - press.start.y) });
        }
        return;
      }
      if (!press.dragging) {
        if (!moved) return;
        clearTimeout(longPress);
        press.dragging = true;
        if (press.kind === 'body') {
          const sel = env.selection().includes(press.id) ? env.selection() : [press.id];
          if (!env.selection().includes(press.id)) env.select(sel);
          const doc = env.doc();
          for (const sid of sel) {
            const e = doc.entities[sid];
            if (e && !('unknown' in e) && isEditable(doc, sid)) press.starts.set(sid, e);
          }
          env.begin('Move');
        } else {
          env.begin('Resize');
        }
      }
      applyDrag(i);
    },

    up(i) {
      clearTimeout(longPress);
      const p = press;
      press = null;
      if (!p) return;
      if (p.kind === 'empty') {
        env.setMarquee(null);
        if (p.marquee && dist2(i.screen, p.startScreen) > TAP_SLOP_PX) {
          const r = { x: Math.min(p.start.x, i.pp.x), y: Math.min(p.start.y, i.pp.y), width: Math.abs(i.pp.x - p.start.x), height: Math.abs(i.pp.y - p.start.y) };
          const ids = hitRect(env.model().items, r, pickable);
          env.select(i.shift ? [...new Set([...env.selection(), ...ids])] : ids);
        } else if (!i.shift && !env.multi()) {
          env.select([]);
        }
        return;
      }
      if (p.dragging) {
        env.commit();
        return;
      }
      // A tap (no drag) on a handle counts as a tap on its object.
      const tappedId = p.kind === 'body' ? p.id : p.entity.id;
      {
        const sel = env.selection();
        // Shift (desktop) or Multi mode (touch, UI-04) toggles membership.
        if (i.shift || env.multi()) env.select(sel.includes(tappedId) ? sel.filter((x) => x !== tappedId) : [...sel, tappedId]);
        else env.select([tappedId]);
        env.haptics.tick();
      }
    },

    cancel() {
      clearTimeout(longPress);
      if (press && press.kind !== 'empty' && press.dragging) env.cancel();
      env.setMarquee(null);
      press = null;
    },
  };
}
