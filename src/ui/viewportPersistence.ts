// CV-03: the viewport is saved per document as UI state (not undoable).
import type { Viewport } from '../core/viewport/viewport';

const key = (docId: string) => `perspective_studio.viewport.${docId}`;

export function loadViewport(docId: string): Viewport | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(docId)) ?? 'null') as Viewport | null;
    return v && [v.offsetX, v.offsetY, v.zoom].every(Number.isFinite) && v.zoom > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveViewport(docId: string, v: Viewport): void {
  try {
    localStorage.setItem(key(docId), JSON.stringify(v));
  } catch {
    // Storage unavailable: the viewport just isn't remembered.
  }
}
