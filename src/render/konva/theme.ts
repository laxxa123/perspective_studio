// Colours and weights by role + family (§8.3, §10.9). Core never chooses colours.
import type { Family } from '../../core/derive/renderModel';

export const FAMILY_COLOR: Record<Family, string> = {
  L: '#1c7ed6', // blue
  R: '#e8590c', // orange
  V: '#7048e8', // purple
};

export const THEME = {
  canvas: '#f4f2ec',
  paper: '#fbfaf6',
  paperBorder: '#d6d3ca',
  horizon: '#868e96',
  anchor: '#343a40',
  edge: '#343a40',
  /** Screen px (constant across zoom). */
  guideWidth: 1.25,
  edgeWidth: 1.5,
  vpRadius: 7,
  handleRadius: 13,
  anchorRadius: 6,
  forbidden: 'rgba(112, 72, 232, 0.10)',
  dimmedObjects: 0.4,
};
