import { apiRequest } from '@/lib/api'
import type {
  InventoryUnit,
  InventoryUnitListParams,
  PaginatedResponse,
} from '@/types/inventoryUnit'
import type { ResourceResponse } from '@/types/api'

function buildQuery<T extends object>(params: T): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean') usp.set(k, v ? '1' : '0')
    else usp.set(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export async function listInventoryUnits(
  params: InventoryUnitListParams = {}
): Promise<PaginatedResponse<InventoryUnit>> {
  return apiRequest<PaginatedResponse<InventoryUnit>>(
    `/v1/inventory-units${buildQuery(params)}`
  )
}

export interface CreateInventoryUnitInput {
  catalog_item_id: string
  location_id: string
  bin_id?: string | null
  serial_number?: string | null
  status?: string
  notes?: string | null
  received_at?: string | null
}

export async function createInventoryUnit(
  input: CreateInventoryUnitInput
): Promise<InventoryUnit> {
  const res = await apiRequest<ResourceResponse<InventoryUnit>>(
    '/v1/inventory-units',
    { method: 'POST', body: input }
  )
  return res.data
}

export interface UpdateInventoryUnitInput {
  location_id?: string
  bin_id?: string | null
  serial_number?: string | null
  status?: string
  notes?: string | null
}

export async function updateInventoryUnit(
  id: string,
  input: UpdateInventoryUnitInput
): Promise<InventoryUnit> {
  const res = await apiRequest<ResourceResponse<InventoryUnit>>(
    `/v1/inventory-units/${id}`,
    { method: 'PATCH', body: input }
  )
  return res.data
}
