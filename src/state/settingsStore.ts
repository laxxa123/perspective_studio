// App preferences (§10.8 Settings): small, device-local.
import { create } from 'zustand';

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  /** Object grid snap on by default (OD-6). */
  gridSnap: boolean;
  gridStep: number;
  /** Toolbar position for one-handed use. */
  handedness: 'center' | 'left' | 'right';
  /** OD-5: after placing a box, go back to Select. */
  returnToSelect: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  gridSnap: true,
  gridStep: 0.1,
  handedness: 'center',
  returnToSelect: true,
};

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  update: (patch) => set(patch),
}));
