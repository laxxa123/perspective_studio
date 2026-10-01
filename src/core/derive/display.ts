// Display modes (§10.7): presets plus fine toggles. UI state, per document.

export type RaysMode = 'none' | 'selected' | 'all';

export interface DisplayOptions {
  /** Horizon, VPs, anchor. */
  guides: boolean;
  /** Boxes and rects. */
  objects: boolean;
  /** Construction rays from object edges to their VPs (the only VP guide lines, UI-11). */
  rays: RaysMode;
  hiddenEdges: boolean;
  faceFills: boolean;
  paperFrame: boolean;
  /** v1.5: 1 u floor grid (UI-06). */
  floorGrid: boolean;
  /** v1.5: 60° cone of vision (UI-07). */
  coneOfVision: boolean;
}

export type DisplayPreset = 'construction' | 'clean' | 'guides';

export const DISPLAY_PRESETS: Record<DisplayPreset, DisplayOptions> = {
  construction: { guides: true, objects: true, rays: 'selected', hiddenEdges: true, faceFills: false, paperFrame: true, floorGrid: true, coneOfVision: false },
  clean: { guides: false, objects: true, rays: 'none', hiddenEdges: false, faceFills: true, paperFrame: true, floorGrid: false, coneOfVision: false },
  guides: { guides: true, objects: false, rays: 'none', hiddenEdges: false, faceFills: false, paperFrame: true, floorGrid: true, coneOfVision: false },
};

export const DEFAULT_DISPLAY: DisplayOptions = DISPLAY_PRESETS.construction;

/** The preset these options equal, if any. */
export function presetOf(d: DisplayOptions): DisplayPreset | null {
  for (const [name, p] of Object.entries(DISPLAY_PRESETS) as [DisplayPreset, DisplayOptions][]) {
    if ((Object.keys(p) as (keyof DisplayOptions)[]).every((k) => p[k] === d[k])) return name;
  }
  return null;
}

/**
 * Saved display options: missing toggles (saved before v1.5) come from the
 * construction preset; toggles that no longer exist (vpFans, v1.7) are dropped.
 */
export function withDisplayDefaults(d: Partial<DisplayOptions>): DisplayOptions {
  const base = DISPLAY_PRESETS.construction;
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof DisplayOptions)[]) if (d[k] !== undefined) (out as Record<string, unknown>)[k] = d[k];
  return out;
}
