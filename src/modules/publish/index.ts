// PUBLISH module entry (CREATIVE.md §3): loaded on demand from the home screen.
export const loadPublishModule = () => import('./PublishModule');

/** The Android back button inside PUBLISH (set while the module is open); false = leave PUBLISH. */
export const publishBack: { current: (() => boolean) | null } = { current: null };
