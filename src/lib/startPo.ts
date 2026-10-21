/**
 * Start PO from a bin, and the For stock / jobs / estimates filter on Needs
 * ordering and Order parts. Plain data so it can be tested on its own
 * (scripts/start-po.test.mjs).
 *
 * "Low" is the company-wide answer from GET /v1/inventory-stock-levels/low-stock
 * (total stock at or under the product's reorder point). Start PO keeps the
 * low products that sit in the place or anywhere inside it, from the
 * existing GET /v1/inventory-bins/{id}/contents. No new endpoint.
 */
import type { LowStockItem } from '@/types/lowStock'

export interface StockInPlace {
  catalog_item_id: string
  quantities: { qty_on_hand: number }
}

export interface StartPoRow {
  item: LowStockItem
  /** Units of it in this place and everything inside it. */
  here: number
  /** Suggested order: the reorder suggestion less what is already on order (never below 0). */
  suggested: number
}

/** The low items stored in a place, most short first, with what is here and a suggested quantity. */
export function lowItemsInPlace(levels: readonly StockInPlace[], low: readonly LowStockItem[]): StartPoRow[] {
  const here = new Map<string, number>()
  for (const l of levels) here.set(l.catalog_item_id, (here.get(l.catalog_item_id) ?? 0) + (Number(l.quantities?.qty_on_hand) || 0))
  const out: StartPoRow[] = []
  for (const it of low) {
    if (!here.has(it.id)) continue
    out.push({ item: it, here: here.get(it.id) ?? 0, suggested: suggestedQty(it) })
  }
  return out.sort((a, b) => shortBy(b.item) - shortBy(a.item) || a.item.name.localeCompare(b.item.name))
}

/** The same default Needs ordering uses: suggestion less what is already coming. */
export function suggestedQty(it: Pick<LowStockItem, 'suggested_qty' | 'on_order_qty'>): number {
  return Math.max(0, Math.ceil((it.suggested_qty || 0) - (it.on_order_qty || 0)))
}

function shortBy(it: LowStockItem): number {
  return (it.reorder_threshold || 0) - (it.current_stock || 0)
}

// ───────────────────────────── filter chips ─────────────────────────────

export type OrderFilter = 'all' | 'stock' | 'job' | 'estimate'
export const ORDER_FILTERS: ReadonlyArray<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'For stock' },
  { id: 'job', label: 'For jobs' },
  { id: 'estimate', label: 'For estimates' },
]

/** What a low item is needed for: jobs and estimates waiting on it, else stock. */
export function lowItemKinds(it: Pick<LowStockItem, 'jobs_waiting'>): Set<OrderFilter> {
  const kinds = new Set<OrderFilter>()
  for (const w of it.jobs_waiting?.for ?? []) {
    if (w.work_order_id) kinds.add('job')
    else if (w.estimate_id) kinds.add('estimate')
  }
  if (kinds.size === 0) kinds.add('stock')
  return kinds
}

export interface AskLike {
  for_kind: 'stock' | 'job' | 'estimate'
  open: number
  job?: { id: string } | null
  estimate?: { id: string } | null
}

/** What a part in the cart is for, from its asks still open (all of them when none is). */
export function groupKinds(asks: readonly AskLike[]): Set<OrderFilter> {
  const open = asks.filter((a) => a.open > 0)
  const kinds = new Set<OrderFilter>()
  for (const a of open.length ? open : asks) {
    if (a.for_kind === 'estimate' && a.estimate) kinds.add('estimate')
    else if (a.for_kind === 'job' || a.job) kinds.add('job')
    else kinds.add('stock')
  }
  return kinds
}

/** Counts for each chip; "all" is every row. */
export function filterCounts<T>(rows: readonly T[], kindsOf: (row: T) => Set<OrderFilter>): Record<OrderFilter, number> {
  const out: Record<OrderFilter, number> = { all: rows.length, stock: 0, job: 0, estimate: 0 }
  for (const r of rows) for (const k of kindsOf(r)) if (k !== 'all') out[k]++
  return out
}

export function applyFilter<T>(rows: readonly T[], filter: OrderFilter, kindsOf: (row: T) => Set<OrderFilter>): T[] {
  return filter === 'all' ? [...rows] : rows.filter((r) => kindsOf(r).has(filter))
}
