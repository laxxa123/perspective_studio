import { describe, expect, it } from 'vitest';
import { newDocument, newLayer } from '../document/factory';
import type { BoxEntity } from '../document/types';
import {
  addEntity,
  addLayer,
  deleteEntities,
  deleteLayer,
  duplicateEntities,
  moveToLayer,
  renameDocument,
  reorderEntity,
  reorderLayer,
  setPerspective,
  updateEntity,
  updateLayer,
} from './commands';
import { begin, commit, emptyHistory, execute, HISTORY_LIMIT, preview, redo, undo } from './history';

const doc0 = newDocument({ name: 'T' });
const cubeId = Object.keys(doc0.entities)[0];
const cube = doc0.entities[cubeId] as BoxEntity;

describe('commands & history (§8.5, DOC-01)', () => {
  it('executes, undoes and redoes', () => {
    const a = execute(doc0, emptyHistory(), updateEntity(cubeId, { position: { x: 3, y: 0, z: 0 } }));
    expect((a.doc.entities[cubeId] as BoxEntity).position.x).toBe(3);
    const u = undo(a.doc, a.history)!;
    expect(u.doc).toEqual(doc0);
    const r = redo(u.doc, u.history)!;
    expect(r.doc).toEqual(a.doc);
    expect(undo(doc0, emptyHistory())).toBeNull();
    expect(redo(doc0, emptyHistory())).toBeNull();
  });

  it('records a drag as one entry', () => {
    const t = begin(doc0, 'Move');
    for (let x = 1; x <= 5; x++) preview(t, (d) => void ((d.entities[cubeId] as BoxEntity).position.x = x));
    const c = commit(t, emptyHistory());
    expect(c.history.past).toHaveLength(1);
    expect((c.doc.entities[cubeId] as BoxEntity).position.x).toBe(5);
    expect(undo(c.doc, c.history)!.doc).toEqual(doc0);
    expect(commit(begin(doc0, 'nothing'), emptyHistory()).history.past).toHaveLength(0);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries and ignores no-ops`, () => {
    let s = { doc: doc0, history: emptyHistory() };
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) s = execute(s.doc, s.history, renameDocument(`n${i}`));
    expect(s.history.past).toHaveLength(HISTORY_LIMIT);
    expect(execute(s.doc, s.history, renameDocument(s.doc.name)).history.past).toHaveLength(HISTORY_LIMIT);
  });

  it('adds, duplicates, reorders and deletes entities', () => {
    const extra: BoxEntity = { ...cube, id: 'x2' };
    let d = execute(doc0, emptyHistory(), addEntity(extra)).doc;
    expect(d.layers[0].order).toEqual([cubeId, 'x2']);
    d = execute(d, emptyHistory(), reorderEntity('x2', -1)).doc;
    expect(d.layers[0].order).toEqual(['x2', cubeId]);
    const ids: string[] = [];
    d = execute(d, emptyHistory(), duplicateEntities([cubeId], ids)).doc;
    expect((d.entities[ids[0]] as BoxEntity).position.x).toBe(cube.position.x + 1);
    d = execute(d, emptyHistory(), deleteEntities([cubeId, 'x2'])).doc;
    expect(Object.keys(d.entities)).toEqual(ids);
    expect(d.layers[0].order).toEqual(ids);
  });

  it('manages layers', () => {
    const l = newLayer('objects', 'More');
    let d = execute(doc0, emptyHistory(), addLayer(l)).doc;
    d = execute(d, emptyHistory(), updateLayer(l.id, { name: 'Walls', opacity: 0.5, locked: true })).doc;
    expect(d.layers[2]).toMatchObject({ name: 'Walls', opacity: 0.5, locked: true });
    d = execute(d, emptyHistory(), reorderLayer(l.id, 0)).doc;
    expect(d.layers[0].id).toBe(l.id);
    d = execute(d, emptyHistory(), moveToLayer([cubeId], l.id)).doc;
    expect(d.entities[cubeId].layerId).toBe(l.id);
    expect(d.layers[0].order).toEqual([cubeId]);
    d = execute(d, emptyHistory(), deleteLayer(l.id)).doc;
    expect(d.entities[cubeId]).toBeUndefined();
    // The last layer of a role stays.
    const objectsId = d.layers.find((x) => x.role === 'objects')!.id;
    expect(execute(d, emptyHistory(), deleteLayer(objectsId)).doc.layers).toHaveLength(2);
  });

  it('sets the perspective', () => {
    const ps = { ...doc0.perspective, horizonY: 300 };
    expect(execute(doc0, emptyHistory(), setPerspective(ps)).doc.perspective.horizonY).toBe(300);
  });
});
