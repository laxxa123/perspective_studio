import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { newDocument } from '../document/factory';
import { loadDocument, serializeDocument } from '../document/schema';
import type { BoxEntity } from '../document/types';
import { setMode } from '../perspective';
import { validPerspective } from '../perspective/arbitraries.test-util';
import { allBounds, deriveDocument, newDeriveCache } from './derive';
import { DISPLAY_PRESETS } from './display';

const construction = DISPLAY_PRESETS.construction;

describe('deriveDocument (§8.3)', () => {
  const doc = newDocument({ name: 'T' });

  it('renders paper, guides and the starting cube', () => {
    const m = deriveDocument(doc, construction);
    const roles = m.items.map((i) => i.role);
    expect(roles).toContain('paper');
    expect(roles.filter((r) => r === 'vp')).toHaveLength(3);
    expect(roles.filter((r) => r === 'edge').length).toBeGreaterThanOrEqual(9);
    expect(new Set(m.items.map((i) => i.key)).size).toBe(m.items.length);
  });

  it('follows the display presets', () => {
    expect(deriveDocument(doc, DISPLAY_PRESETS.clean).items.some((i) => i.role === 'vp')).toBe(false);
    const g = deriveDocument(doc, DISPLAY_PRESETS.guides).items;
    expect(g.some((i) => i.role === 'edge')).toBe(false);
    expect(g.some((i) => i.key.startsWith('fan:'))).toBe(true);
    expect(deriveDocument({ ...doc, perspective: setMode(doc.perspective, '2pt') }, construction).items.filter((i) => i.role === 'vp')).toHaveLength(2);
  });

  it('hides invisible layers and entities', () => {
    const hidden = { ...doc, layers: doc.layers.map((l) => ({ ...l, visible: false })) };
    expect(deriveDocument(hidden, construction).items.some((i) => i.entityId)).toBe(false);
  });

  it('reuses memoized items for unchanged entities', () => {
    const cache = newDeriveCache();
    const a = deriveDocument(doc, construction, new Set(), cache);
    const b = deriveDocument(doc, construction, new Set(), cache);
    expect(b.items.find((i) => i.entityId)?.points).toBe(a.items.find((i) => i.entityId)?.points);
  });

  it('orders boxes far to near (painter, BX-07)', () => {
    const d = newDocument({ name: 'T' });
    const layer = d.layers[0];
    const near = Object.values(d.entities)[0] as BoxEntity;
    const far: BoxEntity = { ...near, id: 'far', position: { x: 5, y: 5, z: 0 } };
    const withFar = { ...d, entities: { ...d.entities, far }, layers: [{ ...layer, order: [near.id, 'far'] }, d.layers[1]] };
    const ids = deriveDocument(withFar, construction).items.filter((i) => i.entityId).map((i) => i.entityId);
    expect(ids.indexOf('far')).toBeLessThan(ids.indexOf(near.id));
  });

  it('PS-T6: serialize → load → derive is bit-identical', () => {
    fc.assert(
      fc.property(validPerspective, (ps) => {
        const d = { ...newDocument({ name: 'x' }), perspective: ps };
        const loaded = loadDocument(JSON.parse(JSON.stringify(serializeDocument(d)))).doc;
        expect(deriveDocument(loaded, construction)).toEqual(deriveDocument(d, construction));
      }),
      { numRuns: 1000 },
    );
  });

  it('bounds paper and all VPs for Fit all', () => {
    const r = allBounds(doc.perspective, doc.paper);
    expect(r.x).toBe(-700);
    expect(r.y + r.height).toBe(3200);
  });
});
