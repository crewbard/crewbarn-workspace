/**
 * Stock tab rules (Inventory > Stock): a row's status, the filter chips and
 * the grouping by location. Pure, so scripts/stock-rows.test.mjs checks them.
 *
 * Out: nothing on hand. Low: under "Keep at least" (par). Otherwise OK; a row
 * with no par is never Low, because "nobody set one" is not "running low".
 * "Held for jobs" is the reserved quantity; "Free to use" is on hand less that.
 */

export type StockStatus = 'ok' | 'low' | 'out'
export type StockChip = 'all' | 'low' | 'out' | 'held'

export interface StockRowLike {
  id: string
  location_id: string
  location?: { id: string; name: string } | null
  quantities: { qty_on_hand: number; qty_reserved: number; par_qty?: number | null }
}

export function stockStatus(row: StockRowLike): StockStatus {
  const q = row.quantities
  if (q.qty_on_hand <= 0) return 'out'
  if (q.par_qty != null && q.par_qty > 0 && q.qty_on_hand < q.par_qty) return 'low'
  return 'ok'
}

export function matchesChip(row: StockRowLike, chip: StockChip): boolean {
  if (chip === 'all') return true
  if (chip === 'held') return row.quantities.qty_reserved > 0
  return stockStatus(row) === chip
}

export function chipCounts(rows: StockRowLike[]): Record<StockChip, number> {
  const out: Record<StockChip, number> = { all: rows.length, low: 0, out: 0, held: 0 }
  for (const r of rows) {
    const s = stockStatus(r)
    if (s === 'low') out.low++
    if (s === 'out') out.out++
    if (r.quantities.qty_reserved > 0) out.held++
  }
  return out
}

export interface StockGroup<T extends StockRowLike> {
  locationId: string
  name: string
  rows: T[]
}

/** Rows by location, in the order the locations are given; unknown places last. */
export function groupByLocation<T extends StockRowLike>(rows: T[], locations: Array<{ id: string; name: string }>): Array<StockGroup<T>> {
  const order = new Map(locations.map((l, i) => [l.id, i]))
  const groups = new Map<string, StockGroup<T>>()
  for (const r of rows) {
    let g = groups.get(r.location_id)
    if (!g) {
      const name = r.location?.name ?? locations.find((l) => l.id === r.location_id)?.name ?? 'Unknown location'
      g = { locationId: r.location_id, name, rows: [] }
      groups.set(r.location_id, g)
    }
    g.rows.push(r)
  }
  return [...groups.values()].sort((a, b) => (order.get(a.locationId) ?? 1e9) - (order.get(b.locationId) ?? 1e9) || a.name.localeCompare(b.name))
}

export const STATUS_LABEL: Record<StockStatus, string> = { ok: 'OK', low: 'Low', out: 'Out' }
