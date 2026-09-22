/**
 * EstimateLineItem types matching API response from EstimateLineItemResource.
 * Keep in sync with: app/Http/Resources/EstimateLineItemResource.php
 */

export type EstimateLineItemType = 'service' | 'product'

/** Row kind. 'item' = product/service; 'fee' = flat charge; 'discount' =
 *  a document-level discount row (percent/fixed). */
export type LineType = 'item' | 'fee' | 'discount'

// ---------- Money sub-object ----------

export interface EstimateLineItemMoney {
  unit_price_cents: number
  line_total_cents: number
  tax_amount_cents: number
  total_cents: number

  discount_id: string | null
  discount_kind: 'percent' | 'fixed' | null
  discount_value: number
  discount_amount_cents: number

  unit_price_formatted: string
  line_total_formatted: string
  tax_formatted: string
  total_formatted: string
}

// ---------- Line item (top-level) ----------

export interface EstimateLineItem {
  id: string
  tenant_id: string
  estimate_id: string
  display_order: number

  type: EstimateLineItemType
  line_type: LineType
  description: string
  quantity: number

  // Reserved FK fields
  service_catalog_item_id: string | null
  tax_class_id: string | null
  asset_id: string | null

  /** When true, the line's catalog image renders on customer-facing
   *  PDFs (via the merge tag image variants). Toggled globally for
   *  all lines from the editor's section-level switch. */
  show_image_on_doc: boolean

  money: EstimateLineItemMoney

  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

// ---------- Input shapes ----------

/**
 * Shape sent to POST /v1/estimates/{est}/line-items.
 * unit_price_cents is at top level on input; server stores it on the
 * model and re-emits inside the money sub-object on responses.
 */
export interface EstimateLineItemInput {
  display_order?: number
  type: EstimateLineItemType
  line_type?: LineType
  description: string
  quantity: number
  unit_price_cents: number

  service_catalog_item_id?: string | null
  tax_class_id?: string | null
  asset_id?: string | null
  show_image_on_doc?: boolean

  discount_id?: string | null
  discount_kind?: 'percent' | 'fixed' | null
  discount_value?: number
}

/**
 * Shape sent to PATCH /v1/estimates/{est}/line-items/{id}.
 */
export type EstimateLineItemUpdateInput = Partial<EstimateLineItemInput>

/**
 * Local-only draft shape used by the buffer-mode editor on the create
 * form. These are line items that don't exist server-side yet - they
 * live in React state until the parent estimate is saved, then get
 * POSTed sequentially.
 *
 * Computed totals (line_total_cents etc.) are calculated client-side
 * for live preview but not persisted; the server is the source of
 * truth on save and recomputes them.
 */
export interface EstimateLineItemDraft {
  draft_id: string
  type: EstimateLineItemType
  line_type: LineType
  description: string
  quantity: number
  unit_price_cents: number

  service_catalog_item_id: string | null
  tax_class_id: string | null
  asset_id: string | null
  show_image_on_doc: boolean

  discount_id: string | null
  discount_kind: 'percent' | 'fixed' | null
  discount_value: number

  // Computed client-side for preview
  line_total_cents: number
  tax_amount_cents: number
  total_cents: number
  discount_amount_cents: number
}