import { apiRequest } from '@/lib/api'
import type {
  InventoryStockLevel,
  InventoryStockLevelInput,
  InventoryStockLevelUpdateInput,
  InventoryStockLevelListParams,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/inventoryStockLevel'

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

export async function listStockLevels(
  params: InventoryStockLevelListParams = {}
): Promise<PaginatedResponse<InventoryStockLevel>> {
  return apiRequest<PaginatedResponse<InventoryStockLevel>>(
    `/v1/inventory-stock-levels${buildQuery(params)}`
  )
}

export async function createStockLevel(
  input: InventoryStockLevelInput
): Promise<InventoryStockLevel> {
  const res = await apiRequest<ResourceResponse<InventoryStockLevel>>(
    '/v1/inventory-stock-levels',
    { method: 'POST', body: input }
  )
  return res.data
}

export async function updateStockLevel(
  id: string,
  input: InventoryStockLevelUpdateInput
): Promise<InventoryStockLevel> {
  const res = await apiRequest<ResourceResponse<InventoryStockLevel>>(
    `/v1/inventory-stock-levels/${id}`,
    { method: 'PATCH', body: input }
  )
  return res.data
}

export async function deleteStockLevel(id: string): Promise<void> {
  await apiRequest<void>(`/v1/inventory-stock-levels/${id}`, { method: 'DELETE' })
}

/**
 * Delete (soft) every stock_level row whose parent catalog_item /
 * location / bin record has been deleted. Returns the number nuked.
 */
export async function cleanupOrphanStockLevels(): Promise<number> {
  const res = await apiRequest<{ deleted: number }>(
    '/v1/inventory-stock-levels/cleanup',
    { method: 'POST', body: {} }
  )
  return res.deleted
}
