/**
 * Receive delivery helpers: where things went last time, the full name of a
 * place, and a first guess at the next structure, all worked out from the
 * places the shop already has (the same /inventory-bins list every screen
 * uses). Nothing here talks to the server.
 */
import { binsToDraft, renumberRoots, type DraftNode } from '@/lib/structureDraft'

export interface SpotBin {
  id: string
  location_id: string
  parent_bin_id: string | null
  bin_code: string | null
  name: string | null
  kind: string | null
  holds_stock?: boolean
  sort_order: number
  active: boolean
  capacity?: number | null
  created_at?: string | null
}

const KEY = 'cb.receive.spot'

/** The spot an item went into last time on this device, else the last spot used at all. */
export function rememberedSpot(catalogItemId: string | null | undefined): string | null {
  try {
    return (catalogItemId && localStorage.getItem(`${KEY}.${catalogItemId}`)) || localStorage.getItem(`${KEY}.last`)
  } catch {
    return null
  }
}

export function rememberSpot(catalogItemIds: ReadonlyArray<string | null | undefined>, binId: string): void {
  try {
    localStorage.setItem(`${KEY}.last`, binId)
    for (const id of catalogItemIds) if (id) localStorage.setItem(`${KEY}.${id}`, binId)
  } catch {
    /* private mode: nothing to remember */
  }
}

/** Every layer by name, outermost first: "Main shop › Rack B › Row 1 › Bin 3 › Section C". */
export function spotPath(bins: readonly SpotBin[], binId: string, locationName?: string | null): string {
  const byId = new Map(bins.map((b) => [b.id, b]))
  const parts: string[] = []
  const seen = new Set<string>()
  let cur = byId.get(binId)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift((cur.name ?? '').trim() || (cur.bin_code ?? '').trim() || 'Place')
    cur = cur.parent_bin_id ? byId.get(cur.parent_bin_id) : undefined
  }
  if (locationName) parts.unshift(locationName)
  return parts.join(' › ')
}

function newest(a: SpotBin, b: SpotBin): number {
  const t = (b.created_at ?? '').localeCompare(a.created_at ?? '')
  return t !== 0 ? t : (b.bin_code ?? '').localeCompare(a.bin_code ?? '', undefined, { numeric: true })
}

/**
 * First guess for a new structure in this location: a copy of the newest
 * structure the shop built here (or anywhere, if this location is empty),
 * with every layer's names and pattern kept and the outer code moved to the
 * next free one (Rack B becomes Rack C). Null when the shop has nothing yet,
 * so the builder starts from its own shapes as usual.
 */
export function guessStructure(
  bins: readonly SpotBin[],
  locationId: string,
): { nodes: DraftNode[]; from: string; to: string } | null {
  const live = bins.filter((b) => b.active !== false)
  const roots = live.filter((b) => !b.parent_bin_id)
  const here = roots.filter((b) => b.location_id === locationId).sort(newest)
  const pick = here[0] ?? roots.slice().sort(newest)[0]
  if (!pick) return null
  const draft = binsToDraft(live, pick.id)
  if (draft.length === 0) return null
  const r = renumberRoots(draft, here.map((b) => b.bin_code ?? ''))
  const from = (pick.name ?? '').trim() || (pick.bin_code ?? '')
  const to = r.nodes[0].name || r.nodes[0].code
  return { nodes: r.nodes, from, to }
}

/** The places a structure-apply just made that take stock, deepest first. */
export function firstStockSpot(bins: readonly SpotBin[], createdIds: readonly string[]): SpotBin | null {
  const made = new Set(createdIds)
  const byId = new Map(bins.map((b) => [b.id, b]))
  const depth = (b: SpotBin) => {
    let d = 0
    let c: SpotBin | undefined = b
    while (c?.parent_bin_id && d < 50) { d++; c = byId.get(c.parent_bin_id) }
    return d
  }
  const hasKids = new Set(bins.map((b) => b.parent_bin_id).filter(Boolean) as string[])
  const candidates = bins.filter((b) => made.has(b.id) && b.holds_stock !== false)
  candidates.sort((a, b) => (Number(hasKids.has(a.id)) - Number(hasKids.has(b.id))) || depth(b) - depth(a)
    || createdIds.indexOf(a.id) - createdIds.indexOf(b.id))
  return candidates[0] ?? null
}
