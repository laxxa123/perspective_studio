// Persistence quality gates (CUBE §58): permanent ids, preserved versions,
// reconstructable JSON, assets linked — on both backends.
import 'fake-indexeddb/auto';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FACE_IDS, newCubeModel } from '../model/CubeModel';
import { PRESETS, presetCells } from '../geometry/NetShapes';
import { buildQuestion } from '../question/QuestionEngine';
import { SqliteTables, type CubeTables, type SqlDriver } from './CubeDatabase';
import { IdbTables } from './IdbTables';
import { AssetRepository, DraftRepository, QuestionRepository } from './QuestionRepository';

function nodeDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  return {
    async execute(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...(params as never[]));
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
  };
}

function question(seed = 1) {
  const m = newCubeModel({ cells: presetCells(PRESETS[0]) });
  for (const f of FACE_IDS) m.faces[f].elements.push({ id: f, kind: 'text', text: f, fontSize: 0.6, w: 0.6, h: 0.6, opacity: 1, transform: { x: 0.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 } });
  return buildQuestion(m, { type: 'net_to_cube', stemCount: 1, distractors: [], seed });
}

const backends: [string, () => CubeTables][] = [
  ['SQLite', () => new SqliteTables(nodeDriver())],
  ['IndexedDB', () => new IdbTables(`cube-test-${Math.random()}`)],
];

for (const [name, make] of backends) {
  describe(`${name} repositories`, () => {
    it('assigns permanent sequential ids and keeps every version', async () => {
      const t = make();
      await t.init();
      const repo = new QuestionRepository(t);
      const a = await repo.create(question(1), new Date('2026-10-01T10:00:00Z'));
      const b = await repo.create(question(2));
      expect(a.questionId).toBe('CUBE-Q-000001');
      expect(b.questionId).toBe('CUBE-Q-000002');
      const v2 = await repo.update('CUBE-Q-000001', { ...a, title: 'Edited' });
      expect(v2.version).toBe(2);
      expect(v2.questionId).toBe('CUBE-Q-000001');
      expect((await repo.get('CUBE-Q-000001', 1))!.title).toBe('');
      expect((await repo.get('CUBE-Q-000001'))!.title).toBe('Edited');
      expect((await repo.versions('CUBE-Q-000001')).map((v) => v.version)).toEqual([1, 2]);
      const copy = await repo.duplicate('CUBE-Q-000001');
      expect(copy.questionId).toBe('CUBE-Q-000003');
      expect((await repo.list()).map((s) => [s.id, s.version])).toEqual([
        ['CUBE-Q-000001', 2],
        ['CUBE-Q-000002', 1],
        ['CUBE-Q-000003', 1],
      ]);
    });

    it('reconstructs the exact question from storage', async () => {
      const t = make();
      await t.init();
      const repo = new QuestionRepository(t);
      const q = await repo.create(question(5));
      expect(await repo.get(q.questionId!)).toEqual(q);
    });

    it('stores assets by stable id and drafts', async () => {
      const t = make();
      await t.init();
      const assets = new AssetRepository(t);
      await assets.put({ id: 'asset-1', mime: 'image/png', data: 'data:image/png;base64,AAAA' });
      expect((await assets.get('asset-1'))!.data).toMatch(/^data:/);
      expect([...(await assets.ids())]).toEqual(['asset-1']);
      const drafts = new DraftRepository(t);
      await drafts.save('{"a":1}');
      expect(await drafts.load()).toBe('{"a":1}');
      await drafts.clear();
      expect(await drafts.load()).toBeNull();
    });
  });
}
