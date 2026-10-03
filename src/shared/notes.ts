// The app-wide note (CREATIVE.md §2.4): one note, reachable from the home
// screen and every module, saved as you type; Save keeps up to three saved
// notes, newest first — a fourth pushes the oldest out (FIFO). Kept on the
// device (localStorage); the functions below are pure.

export interface SavedNote {
  text: string;
  at: string;
}
export interface Notes {
  text: string;
  saved: SavedNote[];
}

export const MAX_SAVED = 3;
const KEY = 'creative.notes.v1';

export const emptyNotes = (): Notes => ({ text: '', saved: [] });

/** Checks a stored value; anything unusable is dropped. */
export function readNotes(raw: unknown): Notes {
  if (!raw || typeof raw !== 'object') return emptyNotes();
  const o = raw as Record<string, unknown>;
  const saved = (Array.isArray(o.saved) ? o.saved : [])
    .filter((s): s is SavedNote => !!s && typeof (s as SavedNote).text === 'string' && typeof (s as SavedNote).at === 'string')
    .slice(0, MAX_SAVED);
  return { text: typeof o.text === 'string' ? o.text : '', saved };
}

/** Saves the current text as the newest saved note (not when empty or the same as the newest). */
export function saveCurrent(n: Notes, now = new Date()): Notes {
  const t = n.text.trim();
  if (!t || n.saved[0]?.text === n.text) return n;
  return { ...n, saved: [{ text: n.text, at: now.toISOString() }, ...n.saved].slice(0, MAX_SAVED) };
}

/** Puts a saved note in the pad (the saved copy stays). */
export const openSaved = (n: Notes, i: number): Notes => (n.saved[i] ? { ...n, text: n.saved[i].text } : n);

export const removeSaved = (n: Notes, i: number): Notes => ({ ...n, saved: n.saved.filter((_, j) => j !== i) });

export function loadNotes(): Notes {
  try {
    return readNotes(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return emptyNotes();
  }
}

export function storeNotes(n: Notes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(n));
  } catch {
    // Storage blocked: the note stays for this session.
  }
}
