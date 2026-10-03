// OBJECTS module entry (CREATIVE.md §3): loaded on demand from the home screen.
export const loadObjectsModule = () => import('./ObjectsModule');

/** The Android back button inside OBJECTS (set while the module is open); false = leave OBJECTS. */
export const objectsBack: { current: (() => boolean) | null } = { current: null };

/** The open dialog's close (Android back closes it first). */
export const objectsModal: { current: (() => void) | null } = { current: null };
