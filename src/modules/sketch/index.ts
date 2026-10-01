// SKETCH module entry (CREATIVE.md §3): loaded on demand from the home screen.
export const loadSketchModule = () => import('./SketchModule');

/** The Android back button inside SKETCH (set while the module is open); false = leave SKETCH. */
export const sketchBack: { current: (() => boolean) | null } = { current: null };
