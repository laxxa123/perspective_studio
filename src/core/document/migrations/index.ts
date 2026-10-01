// Schema migrations (§7.8): pure (docN) → docN+1, chained on load.
// Add a file NNN_description.ts exporting a Migration, and list it here.

export interface Migration {
  /** The schemaVersion this migration upgrades from. */
  from: number;
  description: string;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}

import { eyeMigration } from './001_eye';

export const MIGRATIONS: Migration[] = [eyeMigration];

export function migrate(
  raw: Record<string, unknown>,
  target: number,
  migrations: Migration[] = MIGRATIONS,
): Record<string, unknown> {
  let doc = raw;
  let v = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : NaN;
  if (!Number.isInteger(v) || v < 1) throw new Error('Not a PERSPECTIVE_STUDIO document (no schemaVersion).');
  if (v > target) throw new Error(`This file is from a newer version of the app (schema ${v}).`);
  while (v < target) {
    const m = migrations.find((x) => x.from === v);
    if (!m) throw new Error(`No migration from schema ${v}.`);
    doc = { ...m.migrate(doc), schemaVersion: v + 1 };
    v += 1;
  }
  return doc;
}
