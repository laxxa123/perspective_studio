// Render model (§8.3): flat 2D primitives with semantic roles, in pp.
import type { Rect } from '../viewport/viewport';
import type { Family } from '../perspective/types';

export type { Family };

export type RenderRole =
  | 'edge'
  | 'hiddenEdge'
  | 'face'
  | 'ray'
  | 'horizon'
  | 'vp'
  | 'anchor'
  | 'stroke'
  | 'handle'
  | 'paper'
  | 'selection'
  /** v1.5: floor / working-plane grid lines (UI-06, PL-01). */
  | 'grid'
  /** v1.5: cone of vision (UI-07). */
  | 'cone';

export interface RenderItem {
  /** Stable: `${entityId}:${part}`. */
  key: string;
  entityId?: string;
  role: RenderRole;
  family?: Family;
  /** Flat [x0, y0, x1, y1, …] in pp. */
  points: number[];
  closed?: boolean;
  data?: Record<string, number | string>;
}

export type RenderModel = { items: RenderItem[]; bounds: Rect };
