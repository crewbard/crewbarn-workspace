/**
 * InventoryBin types — mirrors InventoryBinResource.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

/**
 * Common bin "kinds" for the Kind dropdown. Stored as varchar so users
 * can also enter a free-form value if their setup doesn't fit.
 */
export const BIN_KIND_OPTIONS = [
  'Shelf',
  'Rack',
  'Cabinet',
  'Drawer',
  'Bin',
  'Section',
  'Tray',
  'Other',
] as const

export interface InventoryBin {
  id: string
  location_id: string
  parent_bin_id: string | null
  bin_code: string | null
  name: string | null
  kind: string | null
  /** Stock can sit directly here. False = it only holds other things. */
  holds_stock?: boolean
  barcode: string | null
  qr_code_value: string | null
  notes: string | null
  sort_order: number
  active: boolean
  /** "Truck 1 / Top Shelf / Drawer A" — server-computed display path */
  path_label: string
  /** "DCJ1 / A" — compact "where to put it" label for QR put-away stickers */
  place_label: string
  created_at: string | null
  updated_at: string | null
}

export interface InventoryBinInput {
  location_id: string
  parent_bin_id?: string | null
  bin_code?: string | null
  name?: string | null
  kind?: string | null
  barcode?: string | null
  qr_code_value?: string | null
  notes?: string | null
  sort_order?: number
  active?: boolean
}

export type InventoryBinUpdateInput = Partial<InventoryBinInput>

export interface InventoryBinListParams {
  location_id?: string
  parent_bin_id?: string
  in_subtree?: string
  roots_only?: boolean
  kind?: string
  q?: string
  per_page?: number
  page?: number
}
export interface InventoryBinSetupGroup {
  prefix: string
  description?: string | null
  count: number
  start?: number
}

export interface InventoryBinSetupInput {
  location_id: string
  use_racks?: boolean
  rack_prefix?: string | null
  rack_kind?: string | null
  rack_count?: number
  rack_start?: number
  use_shelves?: boolean
  shelf_prefix?: string | null
  shelf_kind?: string | null
  shelf_count?: number
  shelf_start?: number
  shelf_width_in?: number | null
  shelf_depth_in?: number | null
  container_width_in?: number | null
  container_depth_in?: number | null
  containers_per_parent?: number | null
  bin_kind?: string | null
  bin_groups: InventoryBinSetupGroup[]
  section_kind?: string | null
  section_labels?: string[]
  section_count?: number
}

export interface InventoryBinSetupNode {
  temp_key: string
  parent_temp_key: string | null
  depth: number
  kind: string
  bin_code: string
  name: string
  notes: string | null
  sort_order: number
  path: string
  role?: 'level_1' | 'level_2' | 'container' | 'position' | null
}

export interface InventoryBinSetupConflict {
  path?: string
  bin_code?: string
  message: string
}

export interface InventoryBinSetupPreview {
  nodes: InventoryBinSetupNode[]
  conflicts: InventoryBinSetupConflict[]
  total_count: number
  max_count: number
  total_container_count?: number
  container_capacity_per_parent?: number | null
  available_container_slots?: number | null
}

export interface InventoryBinSetupApplyResult {
  created_count: number
  bins: InventoryBin[]
}
