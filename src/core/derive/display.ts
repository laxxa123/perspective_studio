// Display modes (§10.7): presets plus fine toggles. UI state, per document.

export type RaysMode = 'none' | 'selected' | 'all';

export interface DisplayOptions {
  /** Horizon, VPs, anchor. */
  guides: boolean;
  /** Fans of guide lines from each VP (the sketching backdrop). */
  vpFans: boolean;
  /** Boxes and rects. */
  objects: boolean;
  /** Construction rays from object edges to their VPs. */
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
  construction: { guides: true, vpFans: false, objects: true, rays: 'selected', hiddenEdges: true, faceFills: false, paperFrame: true, floorGrid: true, coneOfVision: false },
  clean: { guides: false, vpFans: false, objects: true, rays: 'none', hiddenEdges: false, faceFills: true, paperFrame: true, floorGrid: false, coneOfVision: false },
  guides: { guides: true, vpFans: true, objects: false, rays: 'none', hiddenEdges: false, faceFills: false, paperFrame: true, floorGrid: true, coneOfVision: false },
};

export const DEFAULT_DISPLAY: DisplayOptions = DISPLAY_PRESETS.construction;

/** The preset these options equal, if any. */
export function presetOf(d: DisplayOptions): DisplayPreset | null {
  for (const [name, p] of Object.entries(DISPLAY_PRESETS) as [DisplayPreset, DisplayOptions][]) {
    if ((Object.keys(p) as (keyof DisplayOptions)[]).every((k) => p[k] === d[k])) return name;
  }
  return null;
}

/** Display options saved before v1.5 lack the new toggles: fill them from the construction preset. */
export const withDisplayDefaults = (d: Partial<DisplayOptions>): DisplayOptions => ({ ...DISPLAY_PRESETS.construction, ...d });
