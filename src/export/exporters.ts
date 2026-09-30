// Export entry points (EXP-01, EXP-02, DOC-03, DOC-05). PNG and SVG show the
// paper area in the current display mode, without selection or handles.
import { deriveDocument } from '../core/derive/derive';
import type { DisplayOptions } from '../core/derive/display';
import { loadDocument, serializeDocument } from '../core/document/schema';
import type { SceneDocument } from '../core/document/types';
import { LIGHT } from '../theme/theme';
import { svgToPng } from './png';
import { renderModelToSvg } from './svg';

export const fileSafe = (name: string) => name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 60) || 'scene';

/** Line weights for a paper-sized export: 1 screen px ≈ 1 pp. */
const PX_PER_PP = 1;

export function exportSvg(doc: SceneDocument, display: DisplayOptions): string {
  const model = deriveDocument(doc, display);
  const frame = { x: 0, y: 0, width: doc.paper.width, height: doc.paper.height };
  return renderModelToSvg(model, LIGHT, frame, { title: doc.name, pxPerPp: PX_PER_PP });
}

export function exportPng(doc: SceneDocument, display: DisplayOptions, scale: 1 | 2 | 4): Promise<Blob> {
  return svgToPng(exportSvg(doc, display), doc.paper.width, doc.paper.height, scale);
}

/** A small thumbnail for the gallery (DOC-02). */
export function thumbnail(doc: SceneDocument, display: DisplayOptions): Promise<Blob> {
  return svgToPng(exportSvg(doc, display), doc.paper.width, doc.paper.height, 320 / doc.paper.width);
}

export const exportJson = (doc: SceneDocument): string => JSON.stringify(serializeDocument(doc), null, 2);

export interface Backup {
  format: 'perspective_studio.backup';
  version: 1;
  exportedAt: string;
  documents: unknown[];
}

export const makeBackup = (documents: unknown[], now = new Date()): string =>
  JSON.stringify({ format: 'perspective_studio.backup', version: 1, exportedAt: now.toISOString(), documents } satisfies Backup);

/**
 * Parses an imported file: one document or a backup. Every document is fully
 * validated before anything is returned (NFR-R-02).
 */
export function parseImport(text: string): { docs: SceneDocument[]; warnings: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This is not a JSON file.');
  }
  const list = (raw as Backup)?.format === 'perspective_studio.backup' ? (raw as Backup).documents : [raw];
  const docs: SceneDocument[] = [];
  const warnings: string[] = [];
  for (const r of list) {
    const res = loadDocument(r);
    docs.push(res.doc);
    warnings.push(...res.warnings);
  }
  return { docs, warnings };
}
