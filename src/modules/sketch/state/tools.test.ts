import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';
import { readTools } from './useSketchStore';

describe('remembered tools (SKETCH §8)', () => {
  it('keeps what was saved and checks it', () => {
    const t = readTools({ presetId: 'marker', sizeLevel: 4, opacityLevel: 1, color: '#123456', recent: ['#123456', 'nope'], eraserSize: 0, snap: false, lastGrid: 'thirds' }, DEFAULT_SETTINGS);
    expect(t).toEqual({ presetId: 'marker', sizeLevel: 4, opacityLevel: 1, color: '#123456', recent: ['#123456'], eraserSize: 0, snap: false, lastGrid: 'thirds' });
  });

  it('falls back to the defaults (never the eraser; snap on; the cube grid)', () => {
    const t = readTools({ presetId: 'eraser', sizeLevel: 9, color: 'red', lastGrid: 'none' }, DEFAULT_SETTINGS);
    expect(t.presetId).toBe(DEFAULT_SETTINGS.defaultPreset);
    expect(t.sizeLevel).toBe(DEFAULT_SETTINGS.defaultSize);
    expect(t.color).toBe(DEFAULT_SETTINGS.defaultColor);
    expect(t.recent).toEqual(['#000000', '#ffffff', '#cccccc', '#e03131', DEFAULT_SETTINGS.defaultColor]);
    expect(t.snap).toBe(true);
    expect(t.lastGrid).toBe('cube');
    expect(readTools(null, DEFAULT_SETTINGS).eraserSize).toBe(3);
  });
});
