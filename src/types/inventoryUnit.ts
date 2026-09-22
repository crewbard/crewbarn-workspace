/**
 * InventoryUnit types — mirrors InventoryUnitResource. Slim for now;
 * grown as needed.
 */

import type { PaginatedResponse } from '@/types/api'
export type { PaginatedResponse }

export type InventoryUnitStatus =
  | 'available'
  | 'reserved'
  | 'installed'
  | 'sold'
  | 'lost'
  | 'damaged'

export interface InventoryUnitBinMini {
  id: string
  name: string
  bin_code?: string | null
  /** "DCJ1 / A" — compact "where to put it" label for QR put-away stickers */
  place_label?: string
  location_id: string
}

export interface InventoryUnitLocationMini {
  id: string
  name: string
}

export interface InventoryUnit {
  id: string
  catalog_item_id: string
  purchase_order_item_id: string | null
  vendor_order_number: string | null
  location_id: string
  bin_id: string | null
  serial_number: string
  status: InventoryUnitStatus
  notes: string | null
  received_at: string | null
  installed_at: string | null
  installation: {
    customer_id: string | null
    service_location_id: string | null
    asset_id?: string | null
    customer?: { id: string; name: string | null } | null
    service_location?: { id: string; name: string | null } | null
    asset?: { id: string; name: string | null; asset_code: string | null } | null
    work_order?: { id: string; work_order_number: number | null } | null
  }
  bin?: InventoryUnitBinMini | null
  location?: InventoryUnitLocationMini | null
  created_at: string | null
  updated_at: string | null
}

export interface InventoryUnitListParams {
  status?: InventoryUnitStatus
  location_id?: string
  bin_id?: string
  catalog_item_id?: string
  purchase_order_item_id?: string
  q?: string
  per_page?: number
  page?: number
}
