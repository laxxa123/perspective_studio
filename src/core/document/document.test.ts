import { describe, expect, it } from 'vitest';
import { newDocument } from './factory';
import { migrate, type Migration } from './migrations';
import { loadDocument, serializeDocument } from './schema';

describe('documents (§7, DOC-04)', () => {
  const doc = newDocument({ name: 'Scene', now: new Date('2026-09-30T00:00:00Z') });

  it('starts valid with two layers and one cube (§10.8, LY-01)', () => {
    expect(doc.layers.map((l) => [l.name, l.role])).toEqual([['Objects', 'objects'], ['Sketch', 'sketch']]);
    expect(Object.values(doc.entities).map((e) => e.kind)).toEqual(['box']);
    expect(loadDocument(doc).warnings).toEqual([]);
  });

  it('round-trips through JSON identically', () => {
    const back = loadDocument(JSON.parse(JSON.stringify(serializeDocument(doc)))).doc;
    expect(back).toEqual(doc);
  });

  it('keeps unknown entity kinds and re-saves them unchanged (§7.7)', () => {
    const raw = JSON.parse(JSON.stringify(doc));
    const layerId = raw.layers[0].id;
    raw.entities.z1 = { id: 'z1', kind: 'cylinder', layerId, radius: 3 };
    raw.layers[0].order.push('z1');
    const loaded = loadDocument(raw).doc;
    expect(loaded.entities.z1).toMatchObject({ unknown: true, kind: 'cylinder' });
    expect((serializeDocument(loaded) as { entities: Record<string, unknown> }).entities.z1).toEqual(raw.entities.z1);
  });

  it('refuses invalid files (NFR-R-02)', () => {
    expect(() => loadDocument(null)).toThrow();
    expect(() => loadDocument({ hello: 1 })).toThrow(/schemaVersion/);
    expect(() => loadDocument({ ...doc, schemaVersion: 99 })).toThrow(/newer/);
    expect(() => loadDocument({ ...doc, layers: [] })).toThrow(/Invalid/);
    const badBox = JSON.parse(JSON.stringify(doc));
    const id = Object.keys(badBox.entities)[0];
    badBox.entities[id].size.x = -1;
    expect(() => loadDocument(badBox)).toThrow(/box/);
    const orphan = JSON.parse(JSON.stringify(doc));
    orphan.entities[id].layerId = 'missing';
    expect(() => loadDocument(orphan)).toThrow(/missing layer/);
  });

  it('repairs an invalid perspective deterministically with a warning (§6.3)', () => {
    const bad = { ...doc, perspective: { ...doc.perspective, vpVerticalY: 300 } };
    const r = loadDocument(bad);
    expect(r.warnings[0]).toMatch(/PV-2/);
    expect(loadDocument(bad).doc.perspective).toEqual(r.doc.perspective);
  });

  it('repairs layer orders to match entities', () => {
    const raw = JSON.parse(JSON.stringify(doc));
    raw.layers[0].order = ['ghost'];
    const loaded = loadDocument(raw).doc;
    expect(loaded.layers[0].order).toEqual(Object.keys(doc.entities));
  });
});

describe('migrations (§7.8)', () => {
  // Fixture: a hypothetical v1 → v2 migration renaming a field.
  const fixtureV1 = { schemaVersion: 1, title: 'Old' };
  const expectedV2 = { schemaVersion: 2, name: 'Old' };
  const m: Migration = {
    from: 1,
    description: 'rename title → name',
    migrate: ({ title, ...rest }) => ({ ...rest, name: title }),
  };
  it('chains migrations up to the target version', () => {
    expect(migrate(fixtureV1, 2, [m])).toEqual(expectedV2);
    expect(migrate(fixtureV1, 1, [m])).toEqual(fixtureV1);
  });
  it('fails when a step is missing', () => {
    expect(() => migrate(fixtureV1, 3, [m])).toThrow(/No migration from schema 2/);
  });
});
