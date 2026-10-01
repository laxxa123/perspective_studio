// Validation of loaded / imported documents (§7.8, DOC-04).
import { z } from 'zod';
import { kindOf } from '../entities/registry';
import { clampEye, eyeViolations, type Eye } from '../perspective/view';
import { migrate } from './migrations';
import { SCHEMA_VERSION, type Entity, type SceneDocument } from './types';

const vec2 = z.object({ x: z.number(), y: z.number() });

const eyeSchema = z.object({
  cv: vec2,
  distance: z.number(),
  turn: z.number(),
  tilt: z.number(),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
});

const layerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['objects', 'sketch']),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  order: z.array(z.string()),
});

const entityBase = z.looseObject({ id: z.string(), kind: z.string(), layerId: z.string() });

const documentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paper: z.object({ width: z.number().positive(), height: z.number().positive() }),
  eye: eyeSchema,
  layers: z.array(layerSchema).min(1),
  entities: z.record(z.string(), entityBase),
});

export interface LoadResult {
  doc: SceneDocument;
  warnings: string[];
}

/**
 * Parses stored / imported JSON: migrate, validate, repair an invalid
 * eye deterministically (ADR-0006), keep unknown entity kinds
 * (§7.7). Throws with a readable message when the file cannot be opened.
 */
export function loadDocument(raw: unknown): LoadResult {
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a PERSPECTIVE scene file.');
  const migrated = migrate(raw as Record<string, unknown>, SCHEMA_VERSION);
  const parsed = documentSchema.safeParse(migrated);
  if (!parsed.success) throw new Error(`Invalid document: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  const d = parsed.data;
  const warnings: string[] = [];

  let eye: Eye = d.eye;
  const bad = eyeViolations(eye);
  if (bad.includes('NaN')) throw new Error('Invalid document: the eye has non-finite values.');
  if (bad.length) {
    eye = clampEye(eye);
    warnings.push(`Eye repaired (${bad.join(', ')}).`);
  }

  const layerIds = new Set(d.layers.map((l) => l.id));
  const entities: Record<string, Entity> = {};
  for (const [id, e] of Object.entries(d.entities)) {
    if (e.id !== id) throw new Error(`Invalid document: entity key ${id} does not match its id.`);
    if (!layerIds.has(e.layerId)) throw new Error(`Invalid document: entity ${id} is on a missing layer.`);
    const def = kindOf(e.kind);
    if (!def) {
      entities[id] = { id, kind: e.kind, layerId: e.layerId, unknown: true, raw: e };
      continue;
    }
    const r = def.schema.safeParse(e);
    if (!r.success) throw new Error(`Invalid document: ${e.kind} ${id}: ${r.error.issues[0]?.message}`);
    entities[id] = r.data as Entity;
  }
  // Layer orders list exactly the entities on each layer.
  const layers = d.layers.map((l) => {
    const order = l.order.filter((id) => entities[id]?.layerId === l.id);
    for (const e of Object.values(entities)) if (e.layerId === l.id && !order.includes(e.id)) order.push(e.id);
    return { ...l, order };
  });

  return { doc: { ...d, eye, layers, entities }, warnings };
}

/** The JSON form of a document: unknown entities are written back unchanged (§7.7). */
export function serializeDocument(doc: SceneDocument): unknown {
  const entities: Record<string, unknown> = {};
  for (const [id, e] of Object.entries(doc.entities)) entities[id] = 'unknown' in e ? e.raw : e;
  return { ...doc, entities };
}
