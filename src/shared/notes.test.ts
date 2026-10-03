import { describe, expect, it } from 'vitest';
import { emptyNotes, MAX_SAVED, openSaved, readNotes, removeSaved, saveCurrent } from './notes';

describe('the app-wide note (CREATIVE.md §2.4)', () => {
  it('keeps three saved notes, newest first; a fourth drops the oldest', () => {
    let n = emptyNotes();
    for (const t of ['a', 'b', 'c', 'd']) n = saveCurrent({ ...n, text: t }, new Date('2026-10-03T10:00:00Z'));
    expect(n.saved.map((s) => s.text)).toEqual(['d', 'c', 'b']);
    expect(n.saved).toHaveLength(MAX_SAVED);
  });
  it('does not save an empty note or the same note twice', () => {
    const n = saveCurrent({ text: 'x', saved: [] });
    expect(saveCurrent(n)).toBe(n);
    expect(saveCurrent({ text: '  ', saved: [] }).saved).toHaveLength(0);
  });
  it('opens and removes saved notes', () => {
    const n = { text: 'now', saved: [{ text: 'old', at: '' }] };
    expect(openSaved(n, 0).text).toBe('old');
    expect(openSaved(n, 2)).toBe(n);
    expect(removeSaved(n, 0).saved).toHaveLength(0);
  });
  it('reads stored notes, dropping anything unusable', () => {
    expect(readNotes(null)).toEqual(emptyNotes());
    expect(readNotes({ text: 5, saved: [{ text: 'a', at: 'x' }, { text: 1 }, null, { text: 'b', at: 'y' }, { text: 'c', at: 'z' }, { text: 'd', at: 'w' }] })).toEqual({ text: '', saved: [{ text: 'a', at: 'x' }, { text: 'b', at: 'y' }, { text: 'c', at: 'z' }] });
  });
});
