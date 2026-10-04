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
  vendor_id: string
  vendor?: PurchaseOrderVendorMini
  po_number: string
  vendor_order_number: string | null
  status: PurchaseOrderStatus
  /** Stock for the shelves, or parts for one estimate that wait on its answer. */
  kind?: 'stock' | 'estimate'
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
  vendor_id: string
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
