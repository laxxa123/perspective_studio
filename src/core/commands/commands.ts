// The named commands (§8.5).
import type { Draft } from 'immer';
import { kindOf } from '../entities/registry';
import { newId } from '../document/ids';
import type { Entity, Id, KnownEntity, Layer, SceneDocument } from '../document/types';
import type { PerspectiveSystem } from '../perspective/types';
import type { Command } from './history';

const layerOf = (d: Draft<SceneDocument>, id: Id) => d.layers.find((l) => l.id === id);

export const setPerspective = (ps: PerspectiveSystem): Command => ({
  label: 'Change perspective',
  recipe: (d) => {
    d.perspective = ps;
  },
});

export const addEntity = (e: Entity): Command => ({
  label: `Add ${e.kind}`,
  recipe: (d) => {
    d.entities[e.id] = e;
    layerOf(d, e.layerId)?.order.push(e.id);
  },
});

export const updateEntity = (id: Id, patch: Partial<KnownEntity>, label = 'Edit'): Command => ({
  label,
  recipe: (d) => {
    const e = d.entities[id];
    if (e) Object.assign(e, patch);
  },
});

export const deleteEntities = (ids: Id[]): Command => ({
  label: ids.length > 1 ? `Delete ${ids.length} items` : 'Delete',
  recipe: (d) => {
    for (const id of ids) {
      const e = d.entities[id];
      if (!e) continue;
      const l = layerOf(d, e.layerId);
      if (l) l.order = l.order.filter((x) => x !== id);
      delete d.entities[id];
    }
  },
});

/** Duplicates entities, each offset by its kind's step (BX-04); returns the new ids via `out`. */
export function duplicateEntities(ids: Id[], out: Id[] = []): Command {
  return {
    label: 'Duplicate',
    recipe: (d) => {
      for (const id of ids) {
        const e = d.entities[id] as KnownEntity | undefined;
        const def = e && kindOf(e.kind);
        if (!e || !def || 'unknown' in e) continue;
        const copy = { ...JSON.parse(JSON.stringify(e)), ...def.offsetCopy(e), id: newId() } as KnownEntity;
        d.entities[copy.id] = copy;
        const l = layerOf(d, copy.layerId);
        if (l) l.order.splice(l.order.indexOf(id) + 1, 0, copy.id);
        out.push(copy.id);
      }
    },
  };
}

/** Moves an entity one step up (+1) or down (−1) in its layer's order. */
export const reorderEntity = (id: Id, delta: 1 | -1): Command => ({
  label: delta > 0 ? 'Bring forward' : 'Send backward',
  recipe: (d) => {
    const e = d.entities[id];
    const l = e && layerOf(d, e.layerId);
    if (!l) return;
    const i = l.order.indexOf(id);
    const j = Math.max(0, Math.min(l.order.length - 1, i + delta));
    l.order.splice(i, 1);
    l.order.splice(j, 0, id);
  },
});

export const addLayer = (layer: Layer): Command => ({
  label: 'Add layer',
  recipe: (d) => {
    d.layers.push(layer);
  },
});

export const updateLayer = (id: Id, patch: Partial<Omit<Layer, 'id' | 'order' | 'role'>>): Command => ({
  label: 'Edit layer',
  recipe: (d) => {
    const l = layerOf(d, id);
    if (l) Object.assign(l, patch);
  },
});

/** Moves a layer to a new index in the bottom → top list. */
export const reorderLayer = (id: Id, toIndex: number): Command => ({
  label: 'Reorder layers',
  recipe: (d) => {
    const i = d.layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    const [l] = d.layers.splice(i, 1);
    d.layers.splice(Math.max(0, Math.min(d.layers.length, toIndex)), 0, l);
  },
});

/** Deletes a layer and its entities; the last layer of a role cannot be deleted. */
export const deleteLayer = (id: Id): Command => ({
  label: 'Delete layer',
  recipe: (d) => {
    const l = layerOf(d, id);
    if (!l || d.layers.filter((x) => x.role === l.role).length <= 1) return;
    for (const eid of l.order) delete d.entities[eid];
    d.layers = d.layers.filter((x) => x.id !== id);
  },
});

/** Moves entities to another layer of the same role (on top). */
export const moveToLayer = (ids: Id[], layerId: Id): Command => ({
  label: 'Move to layer',
  recipe: (d) => {
    const target = layerOf(d, layerId);
    if (!target) return;
    for (const id of ids) {
      const e = d.entities[id];
      if (!e || e.layerId === layerId) continue;
      const from = layerOf(d, e.layerId);
      if (from) from.order = from.order.filter((x) => x !== id);
      e.layerId = layerId;
      target.order.push(id);
    }
  },
});

export const renameDocument = (name: string): Command => ({
  label: 'Rename',
  recipe: (d) => {
    d.name = name;
  },
});
