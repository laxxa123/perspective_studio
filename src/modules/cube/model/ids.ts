/** A random id for elements, patterns and assets (never a device path, CUBE §19). */
export function uid(prefix: string): string {
  const c = globalThis.crypto as Crypto | undefined;
  const r = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${r}`;
}
