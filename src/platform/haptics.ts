// Haptic feedback (§10.9): a light tick on clamp, snap, selection.
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface HapticsPort {
  tick(): void;
}

export const haptics: HapticsPort = {
  tick() {
    // Best effort: no vibration hardware or permission is not an error.
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  },
};
