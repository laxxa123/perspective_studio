// SketchDocument helpers (SKETCH §18): create, validate and edit the layer
// stack. Pure: these return new documents; pixels stay in the engine.
import { z } from 'zod';
import { defaultGuides } from './presets';
import type { Background, BlendMode, LayerModel, SketchDocument } from './types';
import { BLEND_MODES, DOC_H, DOC_W, MAX_LAYERS, TILE } from './types';

export const SCHEMA = 'creative.sketch.document.v1' as const;

let seq = 0;
/** A short unique id (time + counter + random). */
export function newId(prefix = ''): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newLayer(name: string): LayerModel {
  return { id: newId('l'), name, visible: true, opacity: 1, locked: false, blend: 'normal' };
}

export function createDocument(name = 'Sketch', background: Background = 'white', now = new Date()): SketchDocument {
  const layer = newLayer('Layer 1');
  const iso = now.toISOString();
  return {
    schema: SCHEMA,
    id: newId('s'),
    name,
    createdAt: iso,
    updatedAt: iso,
    canvas: { width: DOC_W, height: DOC_H, tile: TILE, background },
    layers: [layer],
    activeLayer: layer.id,
    guides: defaultGuides(),
    references: [],
    metadata: { app: 'CREATIVE SKETCH', strokes: 0 },
  };
}

const pt = z.object({ x: z.number(), y: z.number() });
const unit = z.number().min(0).max(1);

export const DocumentSchema = z.object({
  schema: z.literal(SCHEMA),
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  canvas: z.object({ width: z.literal(DOC_W), height: z.literal(DOC_H), tile: z.literal(TILE), background: z.enum(['white', 'paper', 'transparent']) }),
  layers: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        visible: z.boolean(),
        opacity: unit,
        locked: z.boolean(),
        blend: z.enum(BLEND_MODES as [BlendMode, ...BlendMode[]]),
      }),
    )
    .min(1)
    .max(MAX_LAYERS),
  activeLayer: z.string(),
  guides: z.object({
    type: z.enum(['none', 'cube', 'thirds', '1pt', '2pt', '3pt']),
    visible: z.boolean(),
    opacity: unit,
    locked: z.boolean(),
    horizonY: z.number(),
    vp1: pt,
    vp2: pt,
    vp3: pt,
    density: z.number().int().min(4).max(64),
  }),
  references: z.array(
    z.object({
      id: z.string(),
      assetId: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      aspect: z.number().positive(),
      rotation: z.number(),
      opacity: unit,
      locked: z.boolean(),
      hidden: z.boolean(),
    }),
  ),
  metadata: z.object({ app: z.string(), strokes: z.number().int().min(0) }),
});

/** Validates a stored document; repairs a dangling active layer. Throws on a malformed one. */
export function parseDocument(raw: unknown): SketchDocument {
  const d = DocumentSchema.parse(raw) as SketchDocument;
  if (new Set(d.layers.map((l) => l.id)).size !== d.layers.length) throw new Error('Duplicate layer ids');
  if (!d.layers.some((l) => l.id === d.activeLayer)) return { ...d, activeLayer: d.layers[d.layers.length - 1].id };
  return d;
}

// ----- layer stack edits (bottom → top) -----

export const layerIndex = (d: SketchDocument, id: string) => d.layers.findIndex((l) => l.id === id);
export const activeLayer = (d: SketchDocument) => d.layers[layerIndex(d, d.activeLayer)] ?? d.layers[d.layers.length - 1];

/** A name not yet used: "Layer N". */
export function nextLayerName(d: SketchDocument): string {
  const used = new Set(d.layers.map((l) => l.name));
  for (let n = d.layers.length + 1; ; n++) if (!used.has(`Layer ${n}`)) return `Layer ${n}`;
}

/** Inserts `layer` above the active layer and selects it. */
export function insertLayer(d: SketchDocument, layer: LayerModel, at = layerIndex(d, d.activeLayer) + 1): SketchDocument {
  if (d.layers.length >= MAX_LAYERS) return d;
  const layers = d.layers.slice();
  layers.splice(Math.max(0, Math.min(layers.length, at)), 0, layer);
  return { ...d, layers, activeLayer: layer.id };
}

/** Removes a layer (never the last one); the one below (or above) becomes active. */
export function removeLayer(d: SketchDocument, id: string): SketchDocument {
  const i = layerIndex(d, id);
  if (i < 0 || d.layers.length <= 1) return d;
  const layers = d.layers.filter((l) => l.id !== id);
  const active = d.activeLayer === id ? layers[Math.max(0, i - 1)].id : d.activeLayer;
  return { ...d, layers, activeLayer: active };
}

/** Moves a layer to index `to` (bottom = 0). */
export function moveLayer(d: SketchDocument, id: string, to: number): SketchDocument {
  const i = layerIndex(d, id);
  if (i < 0) return d;
  const j = Math.max(0, Math.min(d.layers.length - 1, to));
  if (i === j) return d;
  const layers = d.layers.slice();
  const [l] = layers.splice(i, 1);
  layers.splice(j, 0, l);
  return { ...d, layers };
}

export function patchLayer(d: SketchDocument, id: string, patch: Partial<Omit<LayerModel, 'id'>>): SketchDocument {
  if (layerIndex(d, id) < 0) return d;
  return { ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

export const touch = (d: SketchDocument, now = new Date()): SketchDocument => ({ ...d, updatedAt: now.toISOString() });
