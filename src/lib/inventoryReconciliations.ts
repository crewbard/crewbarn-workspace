import { apiRequest } from '@/lib/api'
import type {
  InventoryReconciliation,
  InventoryReconciliationListParams,
  PaginatedResponse,
  ResourceResponse,
  ReconciliationResolveInput,
} from '@/types/inventoryReconciliation'

function buildQuery<T extends object>(params: T): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export async function listInventoryReconciliations(
  params: InventoryReconciliationListParams = {}
): Promise<PaginatedResponse<InventoryReconciliation>> {
  return apiRequest<PaginatedResponse<InventoryReconciliation>>(
    `/v1/inventory-reconciliations${buildQuery(params)}`
  )
}

export async function resolveInventoryReconciliation(
  id: string,
  input: ReconciliationResolveInput
): Promise<InventoryReconciliation> {
  const res = await apiRequest<ResourceResponse<InventoryReconciliation>>(
    `/v1/inventory-reconciliations/${id}/resolve`,
    { method: 'POST', body: input }
  )
  return res.data
}
