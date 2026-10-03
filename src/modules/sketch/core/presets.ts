// Brush presets (SKETCH §9) and grid presets: data, editable in Settings.
import type { BrushPreset, GuideModel } from './types';
import { DOC_H, DOC_W } from './types';

const base: Omit<BrushPreset, 'id' | 'name' | 'engine'> = {
  size: 12,
  opacity: 1,
  flow: 1,
  hardness: 0.8,
  spacing: 0.08,
  smoothing: 0.35,
  pressureSize: 0.6,
  pressureOpacity: 0,
  velocity: 0,
  tilt: 0,
  texture: 'none',
  rotation: 0,
  followStroke: false,
  roundness: 1,
  blendMode: 'normal',
};

export const DEFAULT_PRESETS: readonly BrushPreset[] = [
  { ...base, id: 'pencil', name: 'Pencil', engine: 'paint', size: 6, opacity: 0.85, flow: 0.55, hardness: 0.7, spacing: 0.12, smoothing: 0.25, pressureSize: 0.35, pressureOpacity: 0.7, texture: 'grain', tilt: 0.6 },
  { ...base, id: 'pen', name: 'Pen', engine: 'paint', size: 10, opacity: 1, flow: 1, hardness: 0.95, spacing: 0.05, smoothing: 0.55, pressureSize: 0.75, velocity: -0.25 },
  { ...base, id: 'marker', name: 'Marker', engine: 'paint', size: 28, opacity: 0.6, flow: 1, hardness: 0.85, spacing: 0.05, smoothing: 0.4, pressureSize: 0.1, roundness: 0.55, rotation: 30 },
  { ...base, id: 'brush', name: 'Brush', engine: 'paint', size: 36, opacity: 1, flow: 0.45, hardness: 0.55, spacing: 0.06, smoothing: 0.45, pressureSize: 0.7, pressureOpacity: 0.4, texture: 'canvas', tilt: 0.4 },
  { ...base, id: 'soft', name: 'Soft Brush', engine: 'paint', size: 90, opacity: 0.7, flow: 0.15, hardness: 0, spacing: 0.08, smoothing: 0.4, pressureSize: 0.3, pressureOpacity: 0.6 },
  { ...base, id: 'airbrush', name: 'Airbrush', engine: 'airbrush', size: 120, opacity: 1, flow: 0.05, hardness: 0, spacing: 0.05, smoothing: 0.3, pressureSize: 0.2, pressureOpacity: 0.8 },
  { ...base, id: 'blender', name: 'Blender', engine: 'blend', size: 48, opacity: 1, flow: 0.6, hardness: 0.2, spacing: 0.1, smoothing: 0.4, pressureSize: 0.4, strength: 0.7 },
  { ...base, id: 'eraser', name: 'Eraser', engine: 'erase', size: 40, opacity: 1, flow: 1, hardness: 0.75, spacing: 0.06, smoothing: 0.3, pressureSize: 0.5, blendMode: 'erase' },
];

/** Quick size levels (SKETCH §8), as multiples of the preset size. */
export const SIZE_LEVELS = [0.35, 0.6, 1, 1.6, 2.6] as const;
/** Quick opacity levels. */
export const OPACITY_LEVELS = [0.2, 0.4, 0.6, 0.8, 1] as const;

/** The default colours (tap "Colour"): black, white, light grey, red, then the current colour (or blue). */
export const DEFAULT_COLOURS = ['#000000', '#ffffff', '#cccccc', '#e03131'];
export function defaultFive(current: string): string[] {
  return [...DEFAULT_COLOURS, DEFAULT_COLOURS.includes(current.toLowerCase()) ? '#1c7ed6' : current.toLowerCase()];
}

export const QUICK_COLOURS = ['#212529', '#495057', '#ffffff', '#e03131', '#f08c00', '#fab005', '#2f9e44', '#1c7ed6', '#7048e8', '#e64980', '#8d6e63', '#0c8599'];

export function defaultGuides(): GuideModel {
  return {
    type: 'none',
    visible: true,
    opacity: 0.5,
    locked: false,
    horizonY: DOC_H * 0.4,
    vp1: { x: DOC_W * 0.5, y: DOC_H * 0.4 },
    vp2: { x: DOC_W * 1.4, y: DOC_H * 0.4 },
    vp3: { x: DOC_W * 0.5, y: DOC_H * 1.8 },
    density: 12,
  };
}

/** Where the vanishing points go when a perspective grid is chosen. */
export function gridPreset(g: GuideModel, type: GuideModel['type']): GuideModel {
  const h = g.horizonY;
  if (type === '1pt') return { ...g, type, vp1: { x: DOC_W / 2, y: h } };
  // Vanishing points start on the page so their handles can be grabbed; drag them out for gentler perspective.
  if (type === '2pt') return { ...g, type, vp1: { x: DOC_W * 0.04, y: h }, vp2: { x: DOC_W * 0.96, y: h } };
  if (type === '3pt') return { ...g, type, vp1: { x: DOC_W * 0.04, y: h }, vp2: { x: DOC_W * 0.96, y: h }, vp3: { x: DOC_W / 2, y: DOC_H * 0.97 } };
  return { ...g, type };
}
