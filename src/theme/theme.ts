// The one theme source (§17.5): colours by role + family (§8.3, §10.9).
import type { Family } from '../core/derive/renderModel';

export interface Theme {
  name: 'light' | 'dark';
  canvas: string;
  paper: string;
  paperBorder: string;
  ink: string;
  muted: string;
  horizon: string;
  anchor: string;
  edge: string;
  hiddenEdge: string;
  family: Record<Family, string>;
  /** Face tint alpha when fills are on. */
  faceAlpha: number;
  rayAlpha: number;
  fanAlpha: number;
  selection: string;
  forbidden: string;
  marquee: string;
}

const FAMILY = { L: '#1c7ed6', R: '#e8590c', V: '#7048e8' };

export const LIGHT: Theme = {
  name: 'light',
  canvas: '#f1efe9',
  paper: '#fbfaf6',
  paperBorder: '#d6d3ca',
  ink: '#212529',
  muted: '#868e96',
  horizon: '#868e96',
  anchor: '#343a40',
  edge: '#343a40',
  hiddenEdge: '#adb5bd',
  family: FAMILY,
  faceAlpha: 0.14,
  rayAlpha: 0.45,
  fanAlpha: 0.22,
  selection: '#1c7ed6',
  forbidden: 'rgba(112, 72, 232, 0.10)',
  marquee: 'rgba(28, 126, 214, 0.12)',
};

export const DARK: Theme = {
  name: 'dark',
  canvas: '#15171a',
  paper: '#1f2226',
  paperBorder: '#3a3f45',
  ink: '#e9ecef',
  muted: '#909296',
  horizon: '#909296',
  anchor: '#dee2e6',
  edge: '#e9ecef',
  hiddenEdge: '#5c636a',
  family: { L: '#4dabf7', R: '#ff922b', V: '#9775fa' },
  faceAlpha: 0.18,
  rayAlpha: 0.5,
  fanAlpha: 0.25,
  selection: '#4dabf7',
  forbidden: 'rgba(151, 117, 250, 0.14)',
  marquee: 'rgba(77, 171, 247, 0.15)',
};

/** Screen-px weights (constant across zoom, §9). */
export const WEIGHTS = {
  guide: 1.25,
  edge: 1.6,
  hiddenEdge: 1,
  ray: 0.8,
  fan: 0.6,
  selectedEdge: 2.6,
  vpRadius: 7,
  handleRadius: 13,
  entityHandleRadius: 11,
};

/** Hex colour + alpha → rgba(). */
export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
