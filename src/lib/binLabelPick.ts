/**
 * Hands the bins ticked on the Bins tree to the label page.
 *
 * The ids go into localStorage under a fresh key and only the key goes in the
 * URL: a few hundred bin ids would overflow the server's URL limit. Old picks
 * are cleared as new ones are saved, so this never grows.
 */
const PREFIX = 'crewbarn.binLabelPick.'
const KEEP = 5

export function saveBinLabelPick(ids: readonly string[]): string {
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  try {
    const old = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).sort()
    for (const k of old.slice(0, Math.max(0, old.length - KEEP + 1))) localStorage.removeItem(k)
    localStorage.setItem(PREFIX + key, JSON.stringify(ids))
  } catch {
    // Storage full or blocked: the label page will say nothing was picked.
  }
  return key
}

export function readBinLabelPick(key: string): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** The label page for these bins, in this order. */
export function binLabelPickUrl(ids: readonly string[]): string {
  if (ids.length === 0) return '/inventory?tab=bins'
  return `/inventory-bins/${ids[0]}/labels?pick=${saveBinLabelPick(ids)}`
}
