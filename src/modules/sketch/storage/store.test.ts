import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDocument, insertLayer, newLayer, removeLayer } from '../core/document';
import { History, type Command } from '../core/history';
import { compress, decompress, ProjectStore } from './ProjectStore';

const tile = (v: number) => new Uint8Array(256 * 256 * 4).fill(v);
let n = 0;
const store = () => new ProjectStore(`sketch-test-${n++}`).open();

describe('project store', () => {
  it('compresses tiles losslessly', async () => {
    const t = tile(7);
    t[5] = 200;
    const c = await compress(t);
    expect(c.bytes.byteLength).toBeLessThan(t.length / 10);
    expect(await decompress(c)).toEqual(t);
    expect(await decompress({ bytes: t.slice().buffer, raw: true })).toEqual(t);
  });

  it('saves and reopens a project exactly, newest first', async () => {
    const s = await store();
    const a = createDocument('A', 'white', new Date(1000));
    const b = createDocument('B', 'paper', new Date(2000));
    await s.save(a, [{ layerId: a.layers[0].id, index: 3, data: tile(1) }]);
    await s.save(b, []);
    expect((await s.list()).map((p) => p.name)).toEqual(['B', 'A']);
    const back = await s.load(a.id);
    expect(back!.doc).toEqual(a);
    expect(back!.tiles).toHaveLength(1);
    expect(back!.tiles[0].index).toBe(3);
    expect(back!.tiles[0].data).toEqual(tile(1));
    expect(await s.load('missing')).toBeNull();
  });

  it('autosave updates, clears and drops tiles of deleted layers', async () => {
    const s = await store();
    let d = createDocument('A');
    d = insertLayer(d, newLayer('Layer 2'));
    const [l1, l2] = d.layers.map((l) => l.id);
    await s.save(d, [
      { layerId: l1, index: 0, data: tile(1) },
      { layerId: l1, index: 1, data: tile(2) },
      { layerId: l2, index: 0, data: tile(3) },
    ]);
    await s.save(d, [{ layerId: l1, index: 1, data: null }]);
    expect((await s.load(d.id))!.tiles).toHaveLength(2);
    d = removeLayer(d, l2);
    await s.save(d, []);
    const back = await s.load(d.id);
    expect(back!.tiles.map((t) => t.layerId)).toEqual([l1]);
  });

  it('renames, duplicates (with assets and thumbnail) and deletes', async () => {
    const s = await store();
    const d = createDocument('Orig');
    const asset = await s.putAsset(d.id, new Blob(['img']));
    const withRef = { ...d, references: [{ id: 'r', assetId: asset, x: 0, y: 0, width: 100, aspect: 1, rotation: 0, opacity: 0.5, locked: false, hidden: false }] };
    await s.save(withRef, [{ layerId: d.layers[0].id, index: 0, data: tile(9) }], new Blob(['thumb']));
    await s.rename(d.id, 'Renamed');
    expect((await s.list())[0].name).toBe('Renamed');
    const copy = (await s.duplicate(d.id))!;
    const c = await s.load(copy);
    expect(c!.doc.name).toBe('Renamed copy');
    expect(c!.tiles[0].data).toEqual(tile(9));
    expect(c!.doc.references[0].assetId.startsWith(copy)).toBe(true);
    expect(await s.asset(c!.doc.references[0].assetId)).not.toBeNull();
    expect(await s.thumbnail(copy)).not.toBeNull();
    await s.remove(d.id);
    expect(await s.load(d.id)).toBeNull();
    expect(await s.asset(asset)).toBeNull();
    expect(await s.thumbnail(d.id)).toBeNull();
    expect((await s.list()).map((p) => p.id)).toEqual([copy]);
    expect(await s.duplicate('missing')).toBeNull();
  });

  it('prunes unused assets', async () => {
    const s = await store();
    const d = createDocument();
    const a = await s.putAsset(d.id, new Blob(['x']));
    await s.pruneAssets(d);
    expect(await s.asset(a)).toBeNull();
    s.close();
  });
});

describe('history', () => {
  const cmd = (log: string[], name: string, bytes = 10): Command & { disposed: boolean } => ({
    label: name,
    disposed: false,
    bytes: () => bytes,
    undo: () => log.push(`undo ${name}`),
    redo: () => log.push(`redo ${name}`),
    dispose() {
      this.disposed = true;
    },
  });

  it('undoes and redoes in order; a new step drops the redo branch', () => {
    const log: string[] = [];
    let changes = 0;
    const h = new History(1000, () => changes++);
    const a = cmd(log, 'a');
    const b = cmd(log, 'b');
    h.push(a);
    h.push(b);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
    h.undo();
    h.redo();
    h.undo();
    expect(log).toEqual(['undo b', 'redo b', 'undo b']);
    h.push(cmd(log, 'c'));
    expect(b.disposed).toBe(true);
    expect(h.canRedo).toBe(false);
    expect(h.size).toBe(2);
    expect(changes).toBe(6);
    expect(h.undo()?.label).toBe('c');
    expect(h.undo()?.label).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.redo()?.label).toBe('a');
    h.clear();
    expect(h.all()).toHaveLength(0);
    expect(h.redo()).toBeNull();
  });

  it('drops the oldest steps over the memory budget, keeping the latest', () => {
    const log: string[] = [];
    const h = new History(25);
    const a = cmd(log, 'a');
    h.push(a);
    h.push(cmd(log, 'b'));
    h.push(cmd(log, 'c'));
    expect(a.disposed).toBe(true);
    expect(h.size).toBe(2);
    expect(h.bytes()).toBe(20);
    const big = cmd(log, 'big', 100);
    h.push(big);
    expect(h.size).toBe(1);
    expect(big.disposed).toBe(false);
  });
});
