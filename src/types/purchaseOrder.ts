/**
 * PurchaseOrder types - mirrors PurchaseOrderResource + PurchaseOrderItemResource.
 * Slice 16b: header CRUD + nested item CRUD.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled'

export interface PurchaseOrderVendorMini {
  id: string
  name: string
  label: string
}

export interface PurchaseOrderMoney {
  subtotal_cents: number
  tax_cents: number | null
  shipping_cents: number | null
  total_cents: number
  currency: string
  subtotal_formatted: string
  total_formatted: string
}

export interface PurchaseOrderItemCatalogMini {
  id: string
  name: string
  sku: string | null
  short_description?: string | null
  sn_tracking_enabled?: boolean
  unit_label?: string
  default_bin?: {
    id: string
    name: string
    bin_code?: string | null
    place_label?: string
    location_id: string
  } | null
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  catalog_item_id: string | null
  catalog_item?: PurchaseOrderItemCatalogMini | null
  description: string
  qty_ordered: number
  qty_received: number
  unit_cost_cents: number
  line_total_cents: number
  sort_order: number
  notes: string | null
  /** The part number as printed, and the catalogue page it was picked from. */
  part_number?: string | null
  source_document_id?: string | null
  source_page?: number | null
  source_page_label?: string | null
  estimate_line_item_id?: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PurchaseOrder {
  id: string
  tenant_id: string
  /** Null while a draft waits for the buyer to choose who it goes to. */
  vendor_id: string | null
  vendor?: PurchaseOrderVendorMini | null
  po_number: string
  vendor_order_number: string | null
  status: PurchaseOrderStatus
  /** Stock for the shelves, or parts for one estimate that wait on its answer. */
  kind?: 'stock' | 'estimate'
  /** A draft CrewBarn started when stock ran low; a person checks it and orders it. */
  auto_reorder?: boolean
  /** Written from a call with the vendor (the call is in that conversation). */
  source_call?: { message_id: string; conversation_id: string | null } | null
  /** Parts read off a blueprint (/purchase-orders/blueprints/:id). */
  source_takeoff_id?: string | null
  estimate_id?: string | null
  estimate_number?: string | null
  work_order_id?: string | null
  /** Why it was ordered before the customer approved. */
  order_note?: string | null
  /** What happened to it on its own: "Closed: the estimate was declined." */
  status_note?: string | null
  order_date: string | null
  expected_delivery: string | null
  money: PurchaseOrderMoney
  notes: string | null
  created_by_account_id: string | null
  sent_at: string | null
  received_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  items?: PurchaseOrderItem[]
  items_count?: number
  created_at: string | null
  updated_at: string | null
}

export interface PurchaseOrderInput {
  /** Null on a draft: not chosen yet. Needed before it is ordered. */
  vendor_id: string | null
  vendor_order_number?: string | null
  order_date?: string | null
  expected_delivery?: string | null
  tax_cents?: number | null
  shipping_cents?: number | null
  currency?: string
  notes?: string | null
  status?: PurchaseOrderStatus
}

export type PurchaseOrderUpdateInput = Partial<PurchaseOrderInput>

export interface PurchaseOrderItemInput {
  catalog_item_id?: string | null
  description: string
  qty_ordered: number
  qty_received?: number
  unit_cost_cents: number
  sort_order?: number
  notes?: string | null
}

export type PurchaseOrderItemUpdateInput = Partial<PurchaseOrderItemInput>

export interface PurchaseOrderListParams {
  status?: PurchaseOrderStatus
  vendor_id?: string
  q?: string
  include_archived?: boolean
  per_page?: number
  page?: number
}

// ---- Receive flow ----

export interface PurchaseOrderReceiveLineInput {
  po_item_id: string
  qty: number
  location_id?: string | null
  bin_id?: string | null
}

export interface PurchaseOrderReceiveInput {
  lines: PurchaseOrderReceiveLineInput[]
}

/**
 * GET /v1/purchase-orders/{id}/supplier-copy: the order as the supplier sees
 * it. Never bins, the shop's SKU or its notes.
 */
export interface SupplierCopyLine {
  id: string
  /** The supplier's own number; null when there isn't one (the copy shows the words only). */
  supplier_part_number: string | null
  description: string
  qty: number
  unit_label: string | null
  unit_cost_cents: number
  line_total_cents: number
  missing_part_number: boolean
  /** Where the number came from: the vendor's list, the product's Supplier SKU, or typed on this line. */
  number_source: 'vendor_list' | 'product_supplier' | 'line' | null
  catalog_item_id: string | null
  /** Typed on the line and not on this vendor's list yet: offer to save it there. */
  can_save_to_vendor: boolean
}

export interface PurchaseOrderSendEvent {
  kind: 'sent' | 'send_failed' | 'pdf_downloaded' | string
  to: string | null
  cc: string[]
  error: string | null
  by: string | null
  at: string | null
}

export interface SupplierCopy {
  po_number: string
  status: PurchaseOrderStatus
  order_date: string | null
  expected_delivery: string | null
  vendor_order_number: string | null
  currency: string
  shop: { name: string | null; address: string | null; phone: string | null; email: string | null; logo_url: string | null }
  supplier: { name: string; account_number: string | null; phone: string | null; email: string | null; address: string[]; payment_terms: string | null } | null
  lines: SupplierCopyLine[]
  vendor_id: string | null
  /** What Send needs: the vendor's email on file, why it can't go yet, when it last went, and the log. */
  send: { to: string | null; blocker: string | null; sent_at: string | null; log: PurchaseOrderSendEvent[] }
  missing_part_numbers: number
  money: { subtotal_cents: number; tax_cents: number | null; shipping_cents: number | null; total_cents: number }
}
