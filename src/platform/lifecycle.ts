// App lifecycle: save on pause (NFR-R-01).
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/** Calls `cb` when the app goes to the background. Returns an unsubscribe. */
export function onPause(cb: () => void): () => void {
  const onVis = () => {
    if (document.visibilityState === 'hidden') cb();
  };
  document.addEventListener('visibilitychange', onVis);
  let remove: (() => void) | undefined;
  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) cb();
    }).then((h) => (remove = () => void h.remove()));
  }
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    remove?.();
  };
}

/**
 * Android back button: `cb` returns true when it handled the press (e.g. left
 * the editor); otherwise the app goes to the background.
 */
export function onBackButton(cb: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  let remove: (() => void) | undefined;
  App.addListener('backButton', () => {
    if (!cb()) void App.minimizeApp();
  }).then((h) => (remove = () => void h.remove()));
  return () => remove?.();
}
