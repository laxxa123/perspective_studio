import { DEFAULT_SETTINGS, useSettingsStore, type Settings } from '../state/settingsStore';

const KEY = 'perspective_studio.settings';

export function restoreSettings(): void {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    const clean: Partial<Settings> = {};
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (typeof s[k] === typeof DEFAULT_SETTINGS[k]) (clean as Record<string, unknown>)[k] = s[k];
    }
    useSettingsStore.getState().update(clean);
  } catch {
    // Defaults.
  }
  useSettingsStore.subscribe((s) => {
    const { update: _u, ...plain } = s;
    void _u;
    try {
      localStorage.setItem(KEY, JSON.stringify(plain));
    } catch {
      // Not remembered.
    }
  });
}
