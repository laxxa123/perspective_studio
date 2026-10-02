// Secrets (ADR-0011): small values kept encrypted by the Android Keystore
// (@aparajita/capacitor-secure-storage); in a browser the plugin falls back
// to localStorage. Never synced, never exported, never logged.
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export async function getSecret(key: string): Promise<string | null> {
  try {
    return await SecureStorage.getItem(key);
  } catch {
    // A key that can no longer be decrypted (e.g. restored from a backup) reads as unset.
    return null;
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  await SecureStorage.setItem(key, value);
}

export async function removeSecret(key: string): Promise<void> {
  await SecureStorage.removeItem(key);
}
