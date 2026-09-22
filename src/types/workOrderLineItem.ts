/**
 * WorkOrderLineItem types matching API response from WorkOrderLineItemResource.
 * Keep in sync with: app/Http/Resources/WorkOrderLineItemResource.php
 */

// ---------- Money sub-object ----------

export interface WorkOrderLineItemMoney {
  customer_cost_cents: number
  owner_cost_cents: number
  is_taxable: boolean
  tax_rate_pct: number

  subtotal_cents: number
  tax_amount_cents: number
  total_cents: number
  margin_cents: number

  discount_id: string | null
  discount_kind: 'percent' | 'fixed' | null
  discount_value: number
  discount_amount_cents: number

  customer_cost_formatted: string
  subtotal_formatted: string
  tax_formatted: string
  total_formatted: string
  margin_formatted: string
}

// ---------- Line item (top-level) ----------

/** Row kind. 'item' = product/service; 'fee' = flat charge; 'discount' = a
 *  document-level discount row (percent/fixed). */
export type LineType = 'item' | 'fee' | 'discount'

export interface WorkOrderLineItem {
  id: string
  tenant_id: string
  work_order_id: string
  sort_order: number
  line_type: LineType
  item_type: 'service' | 'product' | null

  description: string
  quantity: number
  unit_label: string

  is_tracking_only: boolean

  // Reserved FK fields — null until catalog/assets/tax-classes ship
  catalog_item_id: string | null
  asset_id: string | null
  tax_class_id: string | null
  inventory_decremented: boolean

  money: WorkOrderLineItemMoney
  notes: string | null
  show_image_on_doc: boolean

  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

// ---------- Input shapes ----------

/**
 * Shape sent to POST /v1/work-orders/{wo}/line-items.
 */
export interface WorkOrderLineItemInput {
  sort_order?: number
  line_type?: LineType
  description: string
  quantity: number
  unit_label?: string
  customer_cost_cents?: number
  owner_cost_cents?: number
  is_taxable?: boolean
  tax_rate_pct?: number
  notes?: string | null
  show_image_on_doc?: boolean

  // Reserved FK fields — pass-through, no validation yet
  catalog_item_id?: string | null
  asset_id?: string | null
  tax_class_id?: string | null

  // Per-line discount (catalog pick or custom)
  discount_id?: string | null
  discount_kind?: 'percent' | 'fixed' | null
  discount_value?: number
}

/**
 * Shape sent to PATCH /v1/work-orders/{wo}/line-items/{id}.
 */
export type WorkOrderLineItemUpdateInput = Partial<WorkOrderLineItemInput>

/**
 * Local-only draft shape used by buffer-mode editor on the create form.
 * These are line items that don't exist on the server yet — they live in
 * React state until the parent work order is saved, then get POSTed sequentially.
 *
 * Derived totals (subtotal_cents, etc.) are computed client-side for display
 * but not persisted; the server is the source of truth on save.
 */
export interface WorkOrderLineItemDraft {
  // Local-only ID (e.g., "draft_xxx") to track the row in React state
  draft_id: string
  line_type: LineType
  description: string
  quantity: number
  unit_label: string
  customer_cost_cents: number
  owner_cost_cents: number
  is_taxable: boolean
  tax_rate_pct: number
  notes: string | null
  show_image_on_doc: boolean
  asset_id: string | null
  // Catalog + tax-class refs carried from a catalog pick so the saved line
  // keeps them (backend inherits the tax class from catalog_item_id). Without
  // these on the draft, create-form catalog lines land untaxed.
  catalog_item_id: string | null
  tax_class_id: string | null
  // Per-line discount (catalog pick or custom)
  discount_id: string | null
  discount_kind: 'percent' | 'fixed' | null
  discount_value: number
  // Computed client-side for live preview, not persisted
  subtotal_cents: number
  tax_amount_cents: number
  total_cents: number
  margin_cents: number
  discount_amount_cents: number
}
