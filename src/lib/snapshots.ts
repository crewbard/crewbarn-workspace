/**
 * Last-known copies of the three answers the shell needs before it can paint
 * completely — permissions, enabled modules, subscription state. Kept in
 * localStorage per account so a returning user's first frame already has the
 * right nav and no banner appears a beat later; React Query refetches in the
 * background and the snapshot is replaced.
 *
 * Nothing here is secret (the same data comes back on every page load) and
 * it is cleared with the session token, so a shared browser never shows the
 * next person the previous person's nav.
 */

const PREFIX = 'cb_snap:'

export function readSnapshot<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function writeSnapshot(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage full or blocked — the app simply loads the slow way next time */
  }
}

export function clearSnapshots(): void {
  try {
    const gone: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) gone.push(k)
    }
    gone.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* nothing to clear */
  }
}
