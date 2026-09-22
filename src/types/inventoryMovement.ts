/**
 * InventoryMovement types — mirrors InventoryMovementResource.
 *
 * Movements are an append-only event log. Every stock-changing action
 * (receive, transfer, issue, install, write_off, adjustment, return)
 * writes one row. The applier consumes them to update stock_levels
 * and inventory_units.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export type InventoryMovementType =
  | 'receive'
  | 'transfer'
  | 'issue'
  | 'install'
  | 'write_off'
  | 'adjustment'
  | 'return'
  | 'vendor_rma'

export const INVENTORY_MOVEMENT_TYPES: InventoryMovementType[] = [
  'receive',
  'transfer',
  'issue',
  'install',
  'write_off',
  'adjustment',
  'return',
  'vendor_rma',
]

export interface InventoryMovementCatalogMini {
  id: string
  name: string
  sku: string | null
  unit_label?: string
}

export interface InventoryMovementLocationMini {
  id: string
  name: string
}

export interface InventoryMovementBinMini {
  id: string
  name: string | null
  bin_code: string | null
  path_label?: string
  location_id: string
}

export interface InventoryMovementUnitMini {
  id: string
  serial_number: string | null
  status: string
}

export interface InventoryMovement {
  id: string
  type: InventoryMovementType
  reference_number: string | null
  catalog_item_id: string
  quantity: number
  from: { location_id: string | null; bin_id: string | null }
  to: { location_id: string | null; bin_id: string | null }
  inventory_unit_id: string | null
  supplier_name: string | null
  unit_cost_cents: number | null
  work_order_line_item_id: string | null
  installation: {
    customer_id: string | null
    service_location_id: string | null
    /** Present when the relation was eager-loaded — names for the log. */
    customer_name?: string | null
    service_location_label?: string | null
  }
  /** The JOB behind work_order_line_item_id; what a person wants to open. */
  work_order?: { id: string; number?: string | null; title?: string | null } | null
  created_by_name?: string | null
  reason: string | null
  notes: string | null
  applied_at: string | null
  voided_by_movement_id: string | null
  created_by_account_id: string | null
  catalog_item?: InventoryMovementCatalogMini | null
  from_location?: InventoryMovementLocationMini | null
  to_location?: InventoryMovementLocationMini | null
  from_bin?: InventoryMovementBinMini | null
  to_bin?: InventoryMovementBinMini | null
  inventory_unit?: InventoryMovementUnitMini | null
  created_at: string | null
  updated_at: string | null
}

export interface InventoryMovementListParams {
  type?: InventoryMovementType
  catalog_item_id?: string
  location_id?: string
  inventory_unit_id?: string
  work_order_line_item_id?: string
  from_date?: string
  to_date?: string
  per_page?: number
  page?: number
}
