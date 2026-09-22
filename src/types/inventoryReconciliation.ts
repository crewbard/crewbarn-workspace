/**
 * InventoryPendingReconciliation types — mirrors
 * InventoryPendingReconciliationResource.
 *
 * Created when an outgoing movement (issue/install/etc.) would have made
 * qty_on_hand go negative AND the tenant has `inventory_allow_unrecorded_stock`
 * on. Stock floors at 0; this row logs the shortfall for a manager to
 * resolve later.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
import type {
  InventoryMovementCatalogMini,
  InventoryMovementLocationMini,
} from '@/types/inventoryMovement'
export type { PaginatedResponse, ResourceResponse }

export type InventoryReconciliationStatus =
  | 'pending'
  | 'resolved_received'
  | 'resolved_writeoff'
  | 'resolved_other'

export interface InventoryReconciliation {
  id: string
  movement_id: string | null
  catalog_item_id: string
  location_id: string
  bin_id: string | null
  shortfall_qty: number
  status: InventoryReconciliationStatus
  resolution: {
    resolved_at: string | null
    resolved_by_account_id: string | null
    notes: string | null
    movement_id: string | null
  }
  movement?: { id: string; type: string; quantity: number; reference_number: string | null } | null
  catalog_item?: InventoryMovementCatalogMini | null
  location?: InventoryMovementLocationMini | null
  // Write-in context (a tech bought a part on a job). Present on write-in rows;
  // the job it was recorded on, and the receipt(s) that prove the purchase.
  is_write_in: boolean
  work_order: { id: string; work_order_number: string | null } | null
  receipts: Array<{
    id: string
    amount_cents: number
    expense_date: string | null
    employee_account_id: string | null
    reimbursement_status: string | null
  }>
  created_at: string | null
}

export interface InventoryReconciliationListParams {
  status?: InventoryReconciliationStatus
  catalog_item_id?: string
  location_id?: string
  per_page?: number
  page?: number
}

export type ReconciliationResolveAction =
  | 'retroactive_receive'
  | 'write_off'
  | 'convert_to_stock'

export interface ReconciliationResolveInput {
  action: ReconciliationResolveAction
  notes?: string | null
  /** convert_to_stock only — the name for the new catalog product. */
  catalog_item_name?: string | null
}
