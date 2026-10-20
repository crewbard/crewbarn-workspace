/**
 * Low-stock types — feeds the "+ Low stock" picker on PO detail.
 * Matches GET /v1/inventory-stock-levels/low-stock response.
 */

export interface LowStockItem {
  id: string
  name: string
  sku: string | null
  supplier_name: string | null
  supplier_sku: string | null
  owner_cost_cents: number
  reorder_threshold: number
  reorder_quantity: number | null
  current_stock: number
  /** Still to arrive on open stock orders, drafts included. */
  on_order_qty?: number
  suggested_qty: number

  /*
   * The detail the "What needs ordering" page shows under each name. Added
   * later and optional, so older callers (the PO picker) are unaffected.
   */
  description?: string | null
  short_description?: string | null
  unit_label?: string | null
  barcode?: string | null
  /** Product category name. */
  category?: string | null
  /** The item's own photo. */
  image?: { thumb_url: string; full_url: string } | null
  /** The item's home bin, from the catalog. */
  default_bin?: { label: string; location: string | null } | null
  /** Who sells it, best first: the starred supplier, then the most recently ordered from. */
  suppliers?: LowStockSupplier[]
  preferred_supplier?: LowStockSupplier | null
  /** How many sit at each place: the shop first, then each truck. */
  stock_by_location?: LowStockLocation[]
  /** The last real order of it (drafts and cancelled orders don't count). */
  last_bought?: {
    unit_cost_cents: number
    qty: number
    date: string | null
    vendor_name: string | null
    purchase_order_id: string
    po_number: string | null
  } | null
  /** Jobs and estimates it's set aside for, or asked for and not on an order yet. */
  jobs_waiting?: { count: number; qty: number; for: LowStockWaiting[] }
  /** The shop's reference card for it, if one matches its part numbers. */
  reference_card?: { id: string; title: string; has_picture: boolean; matched_on: 'ordered_from' | 'part_number' } | null
}

export interface LowStockSupplier {
  vendor_id: string
  vendor_name: string
  /** The supplier's own item number. */
  vendor_sku: string | null
  /** The part number it was ordered under. */
  part_number: string | null
  last_cost_cents: number | null
  last_ordered_at: string | null
  lead_time_days: number | null
  preferred: boolean
}

export interface LowStockLocation {
  location_id: string
  name: string
  /** warehouse | truck | … */
  type: string
  qty: number
  par_qty: number | null
  bins: string[]
}

export interface LowStockWaiting {
  /** held = set aside from stock; asked = asked for, not on an order yet. */
  kind: 'held' | 'asked'
  label: string
  work_order_id: string | null
  estimate_id: string | null
  qty: number
}
