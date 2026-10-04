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
  /**
   * What this spot is SUPPOSED to carry. Null = no par set, which is not the
   * same as 0 — zero says "carry none of these here", null says nobody has
   * decided. Only spots with a par can be short of anything.
   */
  par_qty: number | null
  /** How far under par, or null when there is no par to be under. */
  short_by: number | null
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
  /** null CLEARS the par; 0 sets a real par of none. */
  par_qty?: number | null
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
