import type { CatalogItem } from '@/types/catalogItem'
import type { StockStatus } from '@/lib/stockRows'

/**
 * Product catalog rules, pure so scripts/catalog-products.test.mjs checks them.
 * The list and grid both read these (components/catalog/productBits.tsx).
 */

/** Total on hand across every bin, from the list endpoint (not added up here). */
export function onHand(item: CatalogItem): number {
  return Number(item.inventory.current_stock ?? 0)
}

/**
 * Out: nothing on hand. Low: above 0 and at or under the reorder point. The
 * same rule as the server's Low/Out filters and the category tiles.
 */
export function productStockStatus(item: CatalogItem): StockStatus {
  const qty = onHand(item)
  const threshold = item.inventory.reorder_threshold
  if (qty <= 0) return 'out'
  if (threshold != null && qty <= threshold) return 'low'
  return 'ok'
}

// ---------- Quick filters ----------

export type CatalogFilter = 'all' | 'low' | 'out' | 'no_price' | 'no_photo' | 'no_supplier' | 'not_stocked' | 'inactive'

export const CATALOG_FILTERS: CatalogFilter[] = ['all', 'low', 'out', 'no_price', 'no_photo', 'no_supplier', 'not_stocked', 'inactive']

export const CATALOG_FILTER_LABEL: Record<CatalogFilter, string> = {
  all: 'All',
  low: 'Low',
  out: 'Out',
  no_price: 'No price',
  no_photo: 'No photo',
  no_supplier: 'No supplier',
  not_stocked: 'Not stocked',
  inactive: 'Inactive',
}

/**
 * What a filter asks the list for. All shows every product, active and
 * inactive, as the page always has; Inactive is the active flag; the rest
 * are ?attention= over active products.
 */
export function filterParams(filter: CatalogFilter): { active?: boolean; attention?: Exclude<CatalogFilter, 'all' | 'inactive'> } {
  if (filter === 'all') return {}
  if (filter === 'inactive') return { active: false }
  return { active: true, attention: filter }
}

/** The count a chip shows, from GET /v1/catalog-items/attention. */
export function filterCount(filter: CatalogFilter, counts: Record<string, number> | undefined): number | null {
  if (!counts) return null
  // All counts inactive products too: total is active only.
  if (filter === 'all') return typeof counts.total === 'number' ? counts.total + (counts.inactive ?? 0) : null
  const key = filter
  return typeof counts[key] === 'number' ? counts[key] : null
}

/**
 * The "Needs attention" strip: the problems worth fixing, biggest first, and
 * only the ones that are there. Empty when nothing needs attention.
 */
export function attentionItems(counts: Record<string, number> | undefined): Array<{ filter: CatalogFilter; count: number; text: string }> {
  if (!counts) return []
  const words: Array<[CatalogFilter, string]> = [
    ['out', 'out of stock'],
    ['low', 'running low'],
    ['no_price', 'with no price'],
    ['no_supplier', 'with no supplier'],
    ['no_photo', 'with no photo'],
  ]
  return words
    .map(([filter, text]) => ({ filter, count: counts[filter] ?? 0, text }))
    .filter((x) => x.count > 0)
}

// ---------- List or grid ----------

export type CatalogView = 'list' | 'grid'
export const CATALOG_VIEW_KEY = 'crewbarn.catalog.view'

export function readCatalogView(stored: string | null): CatalogView {
  return stored === 'grid' ? 'grid' : 'list'
}
