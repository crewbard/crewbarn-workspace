import { apiRequest } from '@/lib/api'
import type { PartStock, Piece, VendorChoice } from '@/lib/catalogOrders'

/**
 * The parts cart (asks for parts) and Order parts (the buyer turning them
 * into purchase orders). See PurchaseRequestController for the rules.
 */

export type AskOrder = {
  purchase_order_id: string
  purchase_order_item_id: string
  po_number: string
  status: string
  vendor: string | null
  qty: number
  /** Still a draft: it can go back in the cart. */
  can_undo: boolean
}

export type AskFor = 'stock' | 'job' | 'estimate'

export type Ask = {
  id: string
  part_key: string
  catalog_item_id: string | null
  reference_card_id: string | null
  part_number: string | null
  description: string
  components: Piece[] | null
  list_price_cents: number | null
  qty: number
  on_order: number
  /** Still waiting for the buyer. */
  open: number
  orders: AskOrder[]
  notes: string | null
  for_kind: AskFor
  work_order_id: string | null
  estimate_id: string | null
  estimate_line_item_id: string | null
  job: { id: string; number: number | null; title: string | null; customer: string | null } | null
  estimate: { id: string; number: string; title: string | null; status: string; customer: string | null } | null
  needed_by: string | null
  source: string | null
  source_document_id: string | null
  source_page: number | null
  source_page_label: string | null
  requested_by: { id: string; name: string | null } | null
  created_at: string | null
}

export type Seller = {
  id: string
  vendor_id: string
  vendor: string | null
  part_key: string
  catalog_item_id: string | null
  part_number: string | null
  description: string | null
  vendor_sku: string | null
  last_cost_cents: number | null
  list_price_cents: number | null
  discount_pct: number | null
  lead_time_days: number | null
  preferred: boolean
  last_ordered_at: string | null
  last_received_at: string | null
  source: string | null
  /** On Order parts: what one costs from them. */
  unit_cost_cents?: number
}

export type PartGroup = {
  key: string
  part_number: string | null
  description: string
  catalog_item_id: string | null
  components: Piece[] | null
  list_price_cents: number | null
  owner_cost_cents: number | null
  /** The item's picture, when it is one of the shop's items and has one. */
  image?: { thumb_url: string; full_url: string } | null
  open: number
  needed_by: string | null
  asks: Ask[]
  sellers: Seller[]
  preferred_vendor_id: string | null
  stock: PartStock | null
}

export type DraftFromCart = {
  id: string
  po_number: string
  vendor: string
  kind: 'stock' | 'estimate'
  estimate_number: string | null
  lines: number
  total_cents: number
}

export type Review = { groups: PartGroup[]; drafts: DraftFromCart[] }

export type NewAsk = {
  catalog_item_id?: string
  reference_card_id?: string
  part_number?: string
  description?: string
  qty?: number
  notes?: string
  for_kind?: AskFor
  work_order_id?: string
  estimate_id?: string
  needed_by?: string
  source?: 'catalog' | 'reference_card' | 'item' | 'estimate' | 'job' | 'low_stock'
  source_document_id?: string
  source_page?: number
  source_page_label?: string
  list_price_cents?: number
  add_to_estimate?: boolean
  components?: Piece[]
  order_code?: string
}

const BASE = '/v1/purchase-requests'

export const cartCount = () => apiRequest<{ waiting: number | null; mine: number }>(`${BASE}/count`)

export const listAsks = (scope: { estimate_id?: string; work_order_id?: string } = {}) => {
  const q = scope.estimate_id
    ? `?estimate_id=${encodeURIComponent(scope.estimate_id)}`
    : scope.work_order_id ? `?work_order_id=${encodeURIComponent(scope.work_order_id)}` : ''
  return apiRequest<{ asks: Ask[]; can_order: boolean }>(`${BASE}${q}`)
}

export const addAsk = (body: NewAsk) =>
  apiRequest<{ ask: Ask | null; note: string | null }>(BASE, { method: 'POST', body })

export const addAsks = (lines: NewAsk[]) =>
  apiRequest<{ added: number }>(`${BASE}/bulk`, { method: 'POST', body: { lines } })

export const changeAsk = (id: string, body: { qty?: number; notes?: string | null; needed_by?: string | null }) =>
  apiRequest<{ ask: Ask }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body })

/** Take an ask out of the cart. `undo` is what it was, for restoreAsk. */
export const removeAsk = (id: string) =>
  apiRequest<{ ok: boolean; undo?: { id: string; qty: number } }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** Undo for removeAsk: back in the cart with the quantity it had. */
export const restoreAsk = (id: string, qty: number) =>
  apiRequest<{ ask: Ask }>(`${BASE}/${encodeURIComponent(id)}/restore`, { method: 'POST', body: { qty } })

export const readReview = () => apiRequest<Review>(`${BASE}/review`)

export type Share = { vendor_id: string; qty: number; unit_cost_cents?: number | null }

export const createOrders = (parts: Array<{ key: string; shares: Share[] }>) =>
  apiRequest<Review & { orders: Array<{ id: string; po_number: string; vendor: string; lines: number; total_cents: number }> }>(
    `${BASE}/order`, { method: 'POST', body: { parts } })

export const undoOrder = (purchaseOrderId: string, purchaseOrderItemId?: string) =>
  apiRequest<Review & { returned: number }>(`${BASE}/undo`, {
    method: 'POST',
    body: { purchase_order_id: purchaseOrderId, purchase_order_item_id: purchaseOrderItemId },
  })

// ------------------------------------------------------------ who sells what

const VI = '/v1/vendor-items'

export const sellersFor = (by: { catalog_item_id?: string; part_numbers?: string[]; key?: string }) => {
  const q = new URLSearchParams()
  if (by.catalog_item_id) q.set('catalog_item_id', by.catalog_item_id)
  if (by.key) q.set('key', by.key)
  for (const pn of by.part_numbers ?? []) q.append('part_numbers[]', pn)
  return apiRequest<{ items: Seller[] }>(`${VI}?${q.toString()}`).then((r) => r.items)
}

export const vendorParts = (vendorId: string, q = '') =>
  apiRequest<{ items: Seller[] }>(`${VI}?vendor_id=${encodeURIComponent(vendorId)}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((r) => r.items)

export const changeSeller = (id: string, body: { preferred?: boolean; vendor_sku?: string | null; last_cost_cents?: number | null; lead_time_days?: number | null }) =>
  apiRequest<{ item: Seller }>(`${VI}/${encodeURIComponent(id)}`, { method: 'PATCH', body }).then((r) => r.item)

export const addSeller = (body: {
  vendor_id: string
  catalog_item_id?: string
  part_number?: string
  description?: string
  vendor_sku?: string
  last_cost_cents?: number
  lead_time_days?: number
  preferred?: boolean
}) => apiRequest<{ item: Seller }>(VI, { method: 'POST', body }).then((r) => r.item)

/** A vendor and their own part number for a product that is not saved yet. */
export type DraftVendorNumber = { vendor_id: string; vendor_sku: string }

/** Save a new product's vendor numbers once it has an id. */
export async function saveDraftVendorNumbers(catalogItemId: string, rows: DraftVendorNumber[]): Promise<void> {
  for (const r of rows) {
    await addSeller({ vendor_id: r.vendor_id, catalog_item_id: catalogItemId, vendor_sku: r.vendor_sku || undefined })
  }
}

export const removeSeller = (id: string) => apiRequest<{ ok: boolean }>(`${VI}/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** What one costs from a vendor nobody has bought it from yet: list less their discount, else the item's own cost. */
export function guessCost(group: Pick<PartGroup, 'list_price_cents' | 'owner_cost_cents'>, vendor: VendorChoice | undefined): number | null {
  if (group.list_price_cents != null && group.owner_cost_cents == null) {
    const pct = vendor?.list_discount_pct ?? 0
    return Math.round(group.list_price_cents * (1 - Math.max(0, Math.min(100, pct)) / 100))
  }
  return group.owner_cost_cents
}

/** "for Job 1042 · Smith", "for stock", "for estimate 88". */
export function askFor(ask: Pick<Ask, 'for_kind' | 'job' | 'estimate'>): string {
  if (ask.for_kind === 'estimate' && ask.estimate) {
    return `Estimate ${ask.estimate.number}${ask.estimate.customer ? ` · ${ask.estimate.customer}` : ''}`
  }
  if (ask.job) return `Job ${ask.job.number ?? ''}${ask.job.customer ? ` · ${ask.job.customer}` : ''}`.trim()
  return 'Stock'
}

/** Keys the header badge and every list showing the cart share. */
export const CART_KEYS = [['parts-cart-count'], ['parts-cart'], ['order-parts'], ['parts-asks']] as const
