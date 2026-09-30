// Sketch tool (SK-01…04): pencil / pen / marker strokes with pressure, a
// stroke-level eraser, and perspective snapping Off / Soft / Locked.
import { addEntity, deleteEntities } from '../core/commands/commands';
import { hitSegment } from '../core/derive/hitTest';
import { strokeOutline } from '../core/entities/stroke/stroke';
import { newId } from '../core/document/ids';
import type { Id, StrokeEntity } from '../core/document/types';
import { dist2, type Vec2 } from '../core/math/vec';
import type { Family } from '../core/perspective/types';
import { LOCK_AFTER_PX, nearestFamily, onGuide, softSnap } from '../core/snapping/strokeSnap';
import { isEditable, type ToolEnv } from './env';
import type { Tool, ToolInput } from './types';

/** Min spacing between recorded samples, screen px. */
const SAMPLE_SPACING_PX = 1;
/** Finger / mouse report no real pressure: stored as this. */
const DEFAULT_PRESSURE = 0.5;

export function createSketchTool(env: ToolEnv): Tool {
  let raw: { x: number; y: number; p: number }[] = [];
  let family: Family | null = null;
  let startScreen: Vec2 | null = null;
  let erasing: { last: Vec2; ids: Set<Id> } | null = null;

  const pressureOf = (i: ToolInput) => (i.pointerType === 'pen' && i.pressure > 0 ? i.pressure : DEFAULT_PRESSURE);

  const constrained = (): { x: number; y: number; p: number }[] => {
    const s = env.sketch();
    if (s.snap !== 'locked' || !family || raw.length < 2) return raw;
    const ps = env.doc().perspective;
    const start = raw[0];
    return raw.map((q) => ({ ...onGuide(ps, family!, start, q), p: q.p }));
  };

  /** The width setting is in screen px; strokes store pp (§7.6), fixed when the stroke starts. */
  let widthPp = 1;

  const draft = (pts: { x: number; y: number; p: number }[]): Pick<StrokeEntity, 'points' | 'tool' | 'width'> => {
    const s = env.sketch();
    const flat = pts.length === 1 ? [pts[0].x, pts[0].y, pts[0].p, pts[0].x, pts[0].y, pts[0].p] : pts.flatMap((q) => [q.x, q.y, q.p]);
    return { points: flat, tool: s.tool, width: widthPp };
  };

  const showLive = () => {
    const s = env.sketch();
    env.setLive([{ key: 'live', role: 'stroke', points: strokeOutline(draft(constrained())), closed: true, data: { color: s.color, opacity: s.opacity } }]);
  };

  const eraseAlong = (a: Vec2, b: Vec2, pxToPp: number) => {
    if (!erasing) return;
    const doc = env.doc();
    const pick = (id: Id) => doc.entities[id]?.kind === 'stroke' && isEditable(doc, id) && !erasing!.ids.has(id);
    const hits = hitSegment(env.model().items, a, b, 8 * pxToPp, pick);
    if (!hits.length) return;
    for (const h of hits) erasing.ids.add(h);
    const ids = [...erasing.ids];
    env.preview(deleteEntities(ids).recipe);
  };

  return {
    // With a pen in use, fingers never draw (palm rejection, §10.3).
    touchPans: () => env.penSeen(),

    down(i) {
      if (env.sketch().eraser) {
        erasing = { last: i.pp, ids: new Set() };
        env.begin('Erase');
        eraseAlong(i.pp, i.pp, i.pxToPp);
        return;
      }
      if (!env.targetLayer('sketch')) {
        env.toast('No unlocked, visible sketch layer to draw on.');
        return;
      }
      raw = [{ ...i.pp, p: pressureOf(i) }];
      startScreen = i.screen;
      widthPp = env.sketch().width * i.pxToPp;
      const s = env.sketch();
      family = s.snap === 'locked' && s.family !== 'auto' ? s.family : null;
      showLive();
    },

    move(i) {
      if (erasing) {
        eraseAlong(erasing.last, i.pp, i.pxToPp);
        erasing.last = i.pp;
        return;
      }
      if (!raw.length) return;
      const last = raw[raw.length - 1];
      if (dist2(last, i.pp) < SAMPLE_SPACING_PX * i.pxToPp) return;
      raw.push({ ...i.pp, p: pressureOf(i) });
      const s = env.sketch();
      if (s.snap === 'locked' && !family && startScreen && dist2(startScreen, i.screen) > LOCK_AFTER_PX) {
        const start = raw[0];
        family = nearestFamily(env.doc().perspective, start, { x: i.pp.x - start.x, y: i.pp.y - start.y });
      }
      showLive();
    },

    up() {
      if (erasing) {
        if (erasing.ids.size) env.commit();
        else env.cancel();
        erasing = null;
        return;
      }
      if (!raw.length) return;
      const s = env.sketch();
      let pts = constrained();
      let constraint: StrokeEntity['constraint'];
      if (s.snap === 'locked' && family) {
        constraint = { family, mode: 'locked' };
      } else if (s.snap === 'soft' && pts.length > 2) {
        const snapped = softSnap(env.doc().perspective, pts);
        if (snapped) {
          pts = snapped.points.map((q, k) => ({ ...q, p: pts[k].p }));
          constraint = { family: snapped.family, mode: 'soft' };
          env.haptics.tick();
        }
      }
      const layerId = env.targetLayer('sketch')!;
      const stroke: StrokeEntity = {
        id: newId(),
        kind: 'stroke',
        layerId,
        visible: true,
        locked: false,
        space: 'picture',
        tool: s.tool,
        color: s.color,
        width: widthPp,
        opacity: s.opacity,
        points: draft(pts).points,
        ...(constraint ? { constraint } : {}),
      };
      env.run(addEntity(stroke));
      env.setLive([]);
      raw = [];
      family = null;
    },

    cancel() {
      if (erasing) env.cancel();
      erasing = null;
      raw = [];
      family = null;
      env.setLive([]);
    },
  };
}
