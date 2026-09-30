// New documents (§10.8): a valid perspective system and one cube.
import { DEFAULT_PAPER } from './paper';
import { DEFAULT_PERSPECTIVE } from '../perspective/defaults';
import { setMode } from '../perspective/edit';
import type { PerspectiveMode } from '../perspective/types';
import { newId } from './ids';
import { SCHEMA_VERSION, type BoxEntity, type Layer, type SceneDocument } from './types';

export function newLayer(role: Layer['role'], name: string): Layer {
  return { id: newId(), name, role, visible: true, locked: false, opacity: 1, order: [] };
}

export function newDocument(opts: { name: string; mode?: PerspectiveMode; now?: Date }): SceneDocument {
  const now = (opts.now ?? new Date()).toISOString();
  const objects = newLayer('objects', 'Objects'); // LY-01
  const sketch = newLayer('sketch', 'Sketch');
  const cube: BoxEntity = {
    id: newId(),
    kind: 'box',
    layerId: objects.id,
    visible: true,
    locked: false,
    // Centred on the anchor (world origin).
    position: { x: -0.5, y: -0.5, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    uniform: true,
  };
  objects.order.push(cube.id);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name: opts.name,
    createdAt: now,
    updatedAt: now,
    paper: { ...DEFAULT_PAPER },
    perspective: setMode(DEFAULT_PERSPECTIVE, opts.mode ?? '3pt'),
    layers: [objects, sketch],
    entities: { [cube.id]: cube },
  };
}
