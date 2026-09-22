/**
 * InventoryStockLevel types — mirrors InventoryStockLevelResource.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export interface InventoryStockLevelQuantities {
  qty_on_hand: number
  qty_reserved: number
  qty_available: number
  sn_tracked: boolean
  sn_unit_count: number | null
}

export interface InventoryStockLevelLocationMini {
  id: string
  name: string
}

export interface InventoryStockLevelBinMini {
  id: string
  name: string | null
  bin_code: string | null
  path_label: string
  place_label: string
  location_id: string
}

export interface InventoryStockLevelCatalogItemMini {
  id: string
  name: string
  sku: string | null
  unit_label?: string
}

export interface InventoryStockLevel {
  id: string
  location_id: string
  bin_id: string | null
  catalog_item_id: string
  quantities: InventoryStockLevelQuantities
  last_counted_at: string | null
  last_movement_at: string | null
  // The backend returns fuller objects when relations are loaded; we only
  // type the fields we read from them.
  location?: InventoryStockLevelLocationMini | null
  bin?: InventoryStockLevelBinMini | null
  catalog_item?: InventoryStockLevelCatalogItemMini | null
  created_at: string | null
  updated_at: string | null
}

export interface InventoryStockLevelInput {
  location_id: string
  bin_id?: string | null
  catalog_item_id: string
  qty_on_hand?: number
  qty_reserved?: number
  last_counted_at?: string | null
}

export type InventoryStockLevelUpdateInput = Partial<InventoryStockLevelInput>

export interface InventoryStockLevelListParams {
  location_id?: string
  bin_id?: string
  /** That bin AND everything under it — scan a rack, see the whole rack. */
  in_bin_subtree?: string
  catalog_item_id?: string
  has_stock?: boolean
  per_page?: number
  page?: number
}
