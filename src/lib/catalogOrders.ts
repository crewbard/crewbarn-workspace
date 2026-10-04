import { apiRequest } from '@/lib/api'

/**
 * The order form beside an open catalogue: a real draft purchase order,
 * built while reading. See CatalogOrderController for the rules.
 */

export type PartStock = {
  on_hand: number
  reserved: number
  /** Set aside for approved estimates and their open jobs. */
  held: number
  held_for: Array<{ label: string; qty: number }>
  available: number
  on_order: number
  in_drafts: number
  locations: Array<{ id: string; name: string; on_hand: number; available: number }>
}

export type CatalogPart = {
  id: string
  name: string
  sku: string | null
  supplier_sku: string | null
  supplier_name: string | null
  owner_cost_cents: number
  customer_cost_cents: number
  unit_label: string | null
  exact: boolean
  stock?: PartStock | null
}

export type OrderStage =
  | 'draft'
  | 'waiting_on_approval'
  | 'ready_to_order'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled'

/**
 * One piece of a build: a part number, an option code in brackets (a
 * finish, a style), or a choice written in ("LH", "2-3/4 backset").
 */
export type Piece = {
  part_number?: string | null
  description?: string | null
  kind: 'part' | 'option' | 'choice'
  list_price_cents?: number | null
  source_page?: number | null
  source_page_label?: string | null
}

export type OrderLine = {
  id: string
  description: string
  part_number: string | null
  /** The customer's price printed in the catalogue. */
  list_price_cents: number | null
  /** A build: the codes it is made of. */
  components: Piece[] | null
  catalog_item: CatalogPart | null
  qty: number
  qty_received: number
  unit_cost_cents: number
  line_total_cents: number
  source_document_id: string | null
  source_page: number | null
  source_page_label: string | null
  estimate_line_item_id: string | null
  stock: PartStock | null
}

export type CatalogOrder = {
  order: {
    id: string
    po_number: string
    status: string
    stage: OrderStage
    kind: 'stock' | 'estimate'
    vendor: { id: string; name: string; list_discount_pct: number | null } | null
    estimate: { id: string; estimate_number: string; title: string | null; status: string; customer: string | null } | null
    work_order_id: string | null
    subtotal_cents: number
    total_cents: number
    order_note: string | null
    status_note: string | null
    vendor_order_number: string | null
    mine: boolean
  }
  lines: OrderLine[]
  can_send: boolean
  /** After adding: what happened, when it was not simply "added". */
  note?: string | null
  added_line_id?: string | null
}

export type DraftSummary = {
  id: string
  po_number: string
  vendor: { id: string; name: string } | null
  kind: 'stock' | 'estimate'
  lines: number
  total_cents: number
  updated_at: string | null
}

/** An estimate the catalogue was opened from: parts go on its order. */
export type EstimateContext = { id: string; number: string; title?: string | null }

/** A part picked off a page or out of the search, on its way to the order. */
export type PickedPart = {
  part_number?: string
  catalog_item_id?: string
  description?: string
  qty?: number
  /** The price printed on its row. */
  list_price_cents?: number
  /** A part, or an option code in brackets (a finish, a style). */
  kind?: 'part' | 'option'
  source_document_id?: string
  source_page?: number
  source_page_label?: string
}

const BASE = '/v1/catalog-orders'

export const lookupParts = (q: string) =>
  apiRequest<{ items: CatalogPart[] }>(`${BASE}/lookup?q=${encodeURIComponent(q)}`).then((r) => r.items)

export type VendorChoice = { id: string; name: string; list_discount_pct: number | null }

export const listVendors = () =>
  apiRequest<{ vendors: VendorChoice[] }>(`${BASE}/vendors`).then((r) => r.vendors)

/** What the shop pays this vendor, as a percent off list. Re-costs the drafts to it. */
export const setVendorDiscount = (vendorId: string, pct: number | null) =>
  apiRequest<{ vendor: VendorChoice }>(`${BASE}/vendors/${encodeURIComponent(vendorId)}`, {
    method: 'PATCH',
    body: { list_discount_pct: pct },
  }).then((r) => r.vendor)

export const vendorForDocument = (documentId: string) =>
  apiRequest<{ vendor: { id: string; name: string } | null }>(`${BASE}/vendor-for?document_id=${encodeURIComponent(documentId)}`)
    .then((r) => r.vendor)

export const listDrafts = (estimateId?: string) =>
  apiRequest<{ orders: DraftSummary[] }>(`${BASE}/drafts${estimateId ? `?estimate_id=${encodeURIComponent(estimateId)}` : ''}`)
    .then((r) => r.orders)

export const readOrder = (id: string) => apiRequest<CatalogOrder>(`${BASE}/${encodeURIComponent(id)}`)

export const addToOrder = (body: PickedPart & {
  purchase_order_id?: string
  vendor_id?: string
  estimate_id?: string
  unit_cost_cents?: number
  add_to_estimate?: boolean
  /** A build: its pieces, and how it is ordered when not just its codes in a row. */
  components?: Piece[]
  order_code?: string
}) => apiRequest<CatalogOrder>(`${BASE}/lines`, { method: 'POST', body })

export const changeLine = (orderId: string, lineId: string, body: { qty?: number; unit_cost_cents?: number; description?: string }) =>
  apiRequest<CatalogOrder>(`${BASE}/${orderId}/lines/${lineId}`, { method: 'PATCH', body })

export const removeLine = (orderId: string, lineId: string) =>
  apiRequest<CatalogOrder>(`${BASE}/${orderId}/lines/${lineId}`, { method: 'DELETE' })

export const changeVendor = (orderId: string, vendorId: string) =>
  apiRequest<CatalogOrder>(`${BASE}/${orderId}`, { method: 'PATCH', body: { vendor_id: vendorId } })

export const makeCatalogItem = (orderId: string, lineId: string, body: { name?: string; sku?: string; customer_cost_cents?: number }) =>
  apiRequest<CatalogOrder>(`${BASE}/${orderId}/lines/${lineId}/create-item`, { method: 'POST', body })

export const markOrdered = (orderId: string, body: { reason?: string; vendor_order_number?: string }) =>
  apiRequest<CatalogOrder>(`${BASE}/${orderId}/order`, { method: 'POST', body })

export const keepAsStock = (orderId: string) =>
  apiRequest<CatalogOrder>(`${BASE}/${orderId}/keep-as-stock`, { method: 'POST', body: {} })

export const STAGE_LABEL: Record<OrderStage, string> = {
  draft: 'Draft',
  waiting_on_approval: 'Waiting on approval',
  ready_to_order: 'Ready to order',
  ordered: 'Ordered',
  partially_received: 'Part received',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Closed',
}

/** "PO-000123" as it is, "1042" as "PO 1042". */
export function poLabel(number: string): string {
  return /^po\b|^po-/i.test(number) ? number : `PO ${number}`
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function count(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** How a build is ordered: its codes, and its written-in choices, in the order picked. */
export function composeCode(pieces: Piece[]): string {
  return pieces
    .map((p) => p.part_number || (p.kind === 'choice' ? p.description : null))
    .filter(Boolean)
    .join(' ')
    .slice(0, 100)
}

// ------------------------------------------------------------ this browser

/*
 * The stock order being built, so closing the book and opening another
 * carries on with the same one. Per browser: the server also lists the
 * drafts this person started, which is what another computer picks up.
 */
const ACTIVE_KEY = 'crewbarn.catalogOrder.active'

export function activeOrderId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

/**
 * The build being put together, so closing the book does not lose it.
 * `code` is null while it is just the pieces' codes in a row.
 */
export type Build = { name: string; pieces: Piece[]; code: string | null; qty: number }

const BUILD_KEY = 'crewbarn.catalogOrder.build'

export function readBuild(): Build | null {
  try {
    const raw = window.localStorage.getItem(BUILD_KEY)
    const b = raw ? (JSON.parse(raw) as Partial<Build>) : null
    return b && Array.isArray(b.pieces)
      ? { name: String(b.name ?? ''), pieces: b.pieces, code: typeof b.code === 'string' ? b.code : null, qty: Number(b.qty) || 1 }
      : null
  } catch {
    return null
  }
}

export function writeBuild(build: Build | null): void {
  try {
    if (build) window.localStorage.setItem(BUILD_KEY, JSON.stringify(build))
    else window.localStorage.removeItem(BUILD_KEY)
  } catch {
    // Storage blocked: the build lasts as long as the page.
  }
}

export function setActiveOrderId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // The order is on the server either way.
  }
}
