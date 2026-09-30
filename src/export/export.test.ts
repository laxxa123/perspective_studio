import { describe, expect, it } from 'vitest';
import { DISPLAY_PRESETS } from '../core/derive/display';
import { newDocument } from '../core/document/factory';
import { exportJson, exportSvg, fileSafe, makeBackup, parseImport } from './exporters';

const doc = newDocument({ name: 'My <scene>' });

describe('export (EXP-02, DOC-03, DOC-05)', () => {
  it('writes an SVG of the paper in the display mode', () => {
    const svg = exportSvg(doc, DISPLAY_PRESETS.construction);
    expect(svg).toContain('viewBox="0 0 1200 800"');
    expect(svg).toContain('<title>My &lt;scene&gt;</title>');
    expect(svg).toMatch(/<circle/);
    expect(exportSvg(doc, DISPLAY_PRESETS.clean)).not.toMatch(/<circle/);
  });

  it('round-trips JSON identically, alone or in a backup', () => {
    expect(parseImport(exportJson(doc)).docs[0]).toEqual(doc);
    const backup = makeBackup([JSON.parse(exportJson(doc)), JSON.parse(exportJson(doc))]);
    expect(parseImport(backup).docs).toHaveLength(2);
  });

  it('rejects broken files without partial results', () => {
    expect(() => parseImport('nope')).toThrow(/JSON/);
    expect(() => parseImport(makeBackup([JSON.parse(exportJson(doc)), { bad: true }]))).toThrow();
  });

  it('makes safe file names', () => {
    expect(fileSafe('Cube: study #1')).toBe('Cube_study_1');
    expect(fileSafe('  ')).toBe('scene');
  });
});
