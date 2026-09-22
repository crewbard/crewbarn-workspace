import { apiRequest } from '@/lib/api'
import type {
  InventoryMovement,
  InventoryMovementListParams,
  InventoryMovementType,
  PaginatedResponse,
} from '@/types/inventoryMovement'
import type { ResourceResponse } from '@/types/api'

function buildQuery<T extends object>(params: T): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export async function listInventoryMovements(
  params: InventoryMovementListParams = {}
): Promise<PaginatedResponse<InventoryMovement>> {
  return apiRequest<PaginatedResponse<InventoryMovement>>(
    `/v1/inventory-movements${buildQuery(params)}`
  )
}

export interface CreateInventoryMovementInput {
  type: InventoryMovementType
  catalog_item_id: string
  quantity: number
  from_location_id?: string | null
  from_bin_id?: string | null
  to_location_id?: string | null
  to_bin_id?: string | null
  inventory_unit_id?: string | null
  reason?: string | null
  notes?: string | null
  reference_number?: string | null
}

export async function createInventoryMovement(
  input: CreateInventoryMovementInput
): Promise<InventoryMovement> {
  const res = await apiRequest<ResourceResponse<InventoryMovement>>(
    '/v1/inventory-movements',
    { method: 'POST', body: input }
  )
  return res.data
}
