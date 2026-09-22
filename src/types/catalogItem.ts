/**
 * CatalogItem types matching ServiceCatalogItemResource.
 * Keep in sync with: app/Http/Resources/ServiceCatalogItemResource.php
 *
 * Backend resource flattens 29 columns into 5 nested groups:
 *   - top-level: id, type, sku, name, description, etc.
 *   - pricing: customer_cost_cents, owner_cost_cents, tax_class_id + formatted strings + margin
 *   - inventory: reorder thresholds, supplier info
 *   - sn_tracking: enabled, format_prefix, next_sequence (products only)
 *   - images: thumb/medium/full URLs (R2 not wired yet)
 *
 * Money is in cents on the wire; UI converts to dollars-as-string for inputs.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
import type { CatalogCategory } from '@/types/catalogCategory'
import type { ProductCatalogCategory } from '@/types/productCatalogCategory'
import type { TaxClass } from '@/types/taxClass'
export type { PaginatedResponse, ResourceResponse }

// ---------- Type discriminator ----------

export type CatalogItemType = 'service' | 'product' | 'bundle'

// ---------- Nested groups in resource response ----------

export interface CatalogItemPricing {
  customer_cost_cents: number
  owner_cost_cents: number
  tax_class_id: string | null
  customer_cost_formatted: string   // "$75.00" pre-rendered
  owner_cost_formatted: string      // "$0.00" pre-rendered
  margin_cents: number              // max(0, customer - owner)
}

export interface CatalogItemInventory {
  reorder_threshold: number | null
  reorder_quantity: number | null
  supplier_name: string | null
  supplier_sku: string | null
}

export interface CatalogItemSnTracking {
  enabled: boolean
  format_prefix: string | null
  next_sequence: number
}

export interface CatalogItemImages {
  thumb_url: string | null
  medium_url: string | null
  full_url: string | null
}

export interface CatalogItemWarranty {
  /** Default manufacturer warranty (days). Snapshotted onto a warranties row on invoice send. */
  manufacturer_days: number | null
  /** Default company warranty (days) — what THIS shop promises on top of the manufacturer. */
  company_days: number | null
  /** Optional explicit labor warranty. When set, wins over the tenant labor rule. */
  labor_days: number | null
  /** When true, this item is a sellable warranty extension: stretches existing
   *  warranties on the same invoice instead of creating its own. */
  is_extension: boolean
  extension_kind: 'mfr' | 'co' | 'labor' | null
  extension_days: number | null
}

// ---------- CatalogItem ----------

export interface CatalogItemDefaultBinMini {
  id: string
  name: string
  bin_code?: string | null
  /** "DCJ1 / A" — compact "where to put it" label for QR put-away stickers */
  place_label?: string
  location_id: string
}

/**
 * Part source — does this part come from the original equipment
 * manufacturer (OEM / dealer) or is it an aftermarket replacement?
 * Drives the SKU auto-generator's middle character (A vs O).
 */
export type PartSource = 'aftermarket' | 'oem'

export interface CatalogItem {
  id: string
  service_category_id: string | null
  product_category_id: string | null
  type: CatalogItemType
  sku: string | null
  part_source: PartSource | null
  barcode: string | null
  qr_code_value: string | null
  name: string
  description: string | null
  short_description: string | null
  default_bin_id: string | null
  default_bin?: CatalogItemDefaultBinMini | null
  internal_notes: string | null
  internal_description: string | null
  unit_label: string
  default_quantity: number
  pricing: CatalogItemPricing
  inventory: CatalogItemInventory
  sn_tracking: CatalogItemSnTracking
  images: CatalogItemImages
  warranty: CatalogItemWarranty
  active: boolean
  show_stock_in_catalog: boolean
  is_stocked_item: boolean
  service_category: CatalogCategory | null    // eager-loaded by controller (only populated for type=service items)
  product_category: ProductCatalogCategory | null  // eager-loaded by controller (only populated for type=product items)
  tax_class: TaxClass | null         // eager-loaded by controller
  created_at: string | null
  updated_at: string | null
}

// ---------- Input shapes (FLAT, matches StoreServiceCatalogItemRequest) ----------

/**
 * POST/PATCH body. Flat structure - the backend Request flattens fields,
 * not nested groups. UI converts dollar inputs to cents before sending.
 */
export interface CatalogItemInput {
  type: CatalogItemType
  name: string
  sku?: string | null
  part_source?: PartSource | null
  barcode?: string | null
  qr_code_value?: string | null
  service_category_id?: string | null
  product_category_id?: string | null
  description?: string | null
  short_description?: string | null
  default_bin_id?: string | null
  internal_notes?: string | null
  internal_description?: string | null
  unit_label?: string
  default_quantity?: number
  customer_cost_cents?: number
  owner_cost_cents?: number
  tax_class_id?: string | null
  reorder_threshold?: number | null
  reorder_quantity?: number | null
  supplier_name?: string | null
  supplier_sku?: string | null
  sn_tracking_enabled?: boolean
  sn_format_prefix?: string | null
  active?: boolean
  show_stock_in_catalog?: boolean
  is_stocked_item?: boolean
  manufacturer_warranty_days?: number | null
  company_warranty_days?: number | null
  labor_warranty_days?: number | null
  is_warranty_extension?: boolean
  warranty_extension_kind?: 'mfr' | 'co' | 'labor' | null
  warranty_extension_days?: number | null
}

export type CatalogItemUpdateInput = Partial<CatalogItemInput>

// ---------- Query params ----------

export interface CatalogItemListParams {
  q?: string
  type?: CatalogItemType
  service_category_id?: string
  product_category_id?: string
  in_category_tree?: string
  active?: boolean
  per_page?: number
  page?: number
}



