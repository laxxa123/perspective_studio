// Persistence gates (OBJECTS §83.3, §85): permanent ids, preserved versions,
// reconstructable JSON — on both backends.
import 'fake-indexeddb/auto';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { STARTER_FIGURE } from '../core/figure';
import { STARTER_FOLD } from '../core/fold';
import { buildQuestion, defaultParams } from '../core/questions';
import { IdbTables } from './idb';
import { DraftRepository, filterSummaries, QuestionRepository } from './repository';
import { SqliteTables, type ObjectsTables, type SqlDriver } from './tables';

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

const q = (seed = 1) => buildQuestion('f-turn', { blocks: [], marked: null, figure: STARTER_FIGURE, fold: STARTER_FOLD }, { ...defaultParams(), ops: ['r90'] }, seed);

const backends: [string, () => ObjectsTables][] = [
  ['SQLite', () => new SqliteTables(nodeDriver())],
  ['IndexedDB', () => new IdbTables(`objects-test-${Math.random()}`)],
];

for (const [name, make] of backends) {
  describe(`${name} repositories`, () => {
    it('gives permanent ids that are never reused, and keeps every version', async () => {
      const t = make();
      await t.init();
      const repo = new QuestionRepository(t);
      const a = await repo.create(q(1), new Date('2026-10-03T10:00:00Z'));
      const b = await repo.create(q(2));
      expect(a.questionId).toBe('OBJECTS-Q-000001');
      expect(b.questionId).toBe('OBJECTS-Q-000002');
      const v2 = await repo.update(a.questionId!, { ...a, stem: 'Edited' });
      expect(v2.version).toBe(2);
      expect(v2.createdAt).toBe(a.createdAt);
      expect((await repo.get(a.questionId!, 1))!.stem).toBe(a.stem);
      expect((await repo.get(a.questionId!))!.stem).toBe('Edited');
      expect(await repo.versions(a.questionId!)).toHaveLength(2);
      await expect(t.insertVersion({ questionId: a.questionId!, version: 1, json: '{}', createdAt: '' })).rejects.toThrow();
      const dup = await repo.duplicate(a.questionId!);
      expect(dup.questionId).toBe('OBJECTS-Q-000003');
      const list = await repo.list();
      expect(list.map((s) => s.id)).toEqual(['OBJECTS-Q-000001', 'OBJECTS-Q-000002', 'OBJECTS-Q-000003']);
      expect(list[0].version).toBe(2);
      expect(filterSummaries(list, { text: 'edited' }).map((s) => s.id)).toEqual(['OBJECTS-Q-000001', 'OBJECTS-Q-000003']);
      expect(filterSummaries(list, { kind: 'blocks' })).toHaveLength(0);
      expect(filterSummaries(list, { family: 'f-turn', text: 'q-000002' })).toHaveLength(1);
      expect(await repo.get('OBJECTS-Q-999999')).toBeNull();
      await expect(repo.update('OBJECTS-Q-999999', a)).rejects.toThrow();
      await expect(repo.duplicate('OBJECTS-Q-999999')).rejects.toThrow();
    });

    it('saves, loads and clears the Studio draft', async () => {
      const t = make();
      await t.init();
      const d = new DraftRepository(t);
      expect(await d.load()).toBeNull();
      await d.save('{"a":1}');
      await d.save('{"a":2}');
      expect(await d.load()).toBe('{"a":2}');
      await d.clear();
      expect(await d.load()).toBeNull();
    });
  });
}
