// Box tool (BX-02, BX-06) and Rect tool (RC-01): tap to place.
import { addEntity } from '../core/commands/commands';
import { DEFAULT_CUBE } from '../core/entities/box/box';
import { newId } from '../core/document/ids';
import type { BoxEntity, RectEntity } from '../core/document/types';
import { dist2, type Vec2 } from '../core/math/vec';
import { surfaceAt } from '../core/snapping/boxSnap';
import type { ToolEnv } from './env';
import { TAP_SLOP_PX, type Tool } from './types';

const snapTo = (v: number, step: number | null) => (step ? Math.round(v / step) * step : v);

export function createPlaceTool(env: ToolEnv, what: 'box' | 'rect'): Tool {
  let start: Vec2 | null = null;
  return {
    down(i) {
      start = i.screen;
    },
    move() {},
    up(i) {
      if (!start || dist2(start, i.screen) > TAP_SLOP_PX) {
        start = null;
        return;
      }
      start = null;
      const doc = env.doc();
      const layerId = env.targetLayer('objects');
      if (!layerId) {
        env.toast('No unlocked, visible objects layer to place on.');
        return;
      }
      const surface = surfaceAt(Object.values(doc.entities), env.cam(), i.pp);
      if (!surface) {
        env.toast('Tap below the horizon, or on top of a box, to place it.');
        return;
      }
      const step = env.snapStep();
      const P = surface.point;
      const half = DEFAULT_CUBE / 2;
      const base = { id: newId(), layerId, visible: true, locked: false };
      let entity: BoxEntity | RectEntity;
      if (what === 'box') {
        entity = {
          ...base,
          kind: 'box',
          position: { x: snapTo(P.x - half, step), y: snapTo(P.y - half, step), z: P.z },
          size: { x: DEFAULT_CUBE, y: DEFAULT_CUBE, z: DEFAULT_CUBE },
          uniform: true,
        };
      } else {
        const plane = env.rectPlane();
        const position =
          plane === 'ground'
            ? { x: snapTo(P.x - half, step), y: snapTo(P.y - half, step), z: P.z }
            : plane === 'wallL'
              ? { x: snapTo(P.x, step), y: snapTo(P.y - half, step), z: P.z }
              : { x: snapTo(P.x - half, step), y: snapTo(P.y, step), z: P.z };
        entity = { ...base, kind: 'rect', plane, position, size: { x: DEFAULT_CUBE, y: DEFAULT_CUBE } };
      }
      env.run(addEntity(entity));
      env.select([entity.id]);
      env.haptics.tick();
      env.afterPlace();
    },
    cancel() {
      start = null;
    },
  };
}
