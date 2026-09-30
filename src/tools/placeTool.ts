// Shapes tool (UI-01, BX-02 revised, BX-08, RC-02, PL-01): tap to place the
// chosen shape — resting on surfaces below eye level, hanging from those above,
// on the working plane, or (ceiling) on its fixed plane.
import { addEntity } from '../core/commands/commands';
import { kindOf, shapeOptions } from '../core/entities/registry';
import { newId } from '../core/document/ids';
import type { KnownEntity } from '../core/document/types';
import { dist2, type Vec2 } from '../core/math/vec';
import { unproject } from '../core/perspective/camera';
import { placementAt, WORKING_PLANE_MIN_GAP, type Placement } from '../core/snapping/boxSnap';
import type { ToolEnv } from './env';
import { TAP_SLOP_PX, type Tool } from './types';

export function createPlaceTool(env: ToolEnv): Tool {
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
      const { kind, option } = env.shape();
      const def = kindOf(kind);
      const opt = shapeOptions().find((o) => o.kind === kind && o.id === option);
      if (!def?.create || !opt) return;
      const layerId = env.targetLayer('objects');
      if (!layerId) {
        env.toast('No unlocked, visible objects layer to place on.');
        return;
      }
      const cam = env.cam();
      let place: Placement | null;
      if (opt.placeOn === 'surface') {
        place = placementAt(Object.values(env.doc().entities), cam, i.pp, { workingPlane: env.workingPlane() });
      } else {
        const z = opt.placeOn;
        const P = Math.abs(z - cam.C.z) >= WORKING_PLANE_MIN_GAP ? unproject(cam, i.pp, z) : null;
        place = P ? { point: P, mode: z < cam.C.z ? 'rest' : 'hang', supportId: null } : null;
      }
      if (!place) {
        env.toast(
          opt.placeOn === 'surface'
            ? 'Nothing to place on here. Tap the floor, a surface you can see, or set a working plane.'
            : `Tap ${opt.placeOn > cam.C.z ? 'above' : 'below'} the horizon to place the ${opt.label.toLowerCase()}.`,
        );
        return;
      }
      const entity = def.create({ option, point: place.point, mode: place.mode, layerId, id: newId(), snapStep: env.snapStep() }) as KnownEntity;
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
