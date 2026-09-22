import { apiRequest } from '@/lib/api'
import type {
  InventoryLocation,
  InventoryLocationInput,
  InventoryLocationUpdateInput,
  InventoryLocationListParams,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/inventoryLocation'

export async function listInventoryLocations(
  params: InventoryLocationListParams = {}
): Promise<PaginatedResponse<InventoryLocation>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/inventory-locations' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<InventoryLocation>>(path)
}

export async function getInventoryLocation(id: string): Promise<InventoryLocation> {
  const response = await apiRequest<ResourceResponse<InventoryLocation>>(
    `/v1/inventory-locations/${id}`
  )
  return response.data
}

export async function createInventoryLocation(
  input: InventoryLocationInput
): Promise<InventoryLocation> {
  const response = await apiRequest<ResourceResponse<InventoryLocation>>(
    '/v1/inventory-locations',
    { method: 'POST', body: input }
  )
  return response.data
}

export async function updateInventoryLocation(
  id: string,
  input: InventoryLocationUpdateInput
): Promise<InventoryLocation> {
  const response = await apiRequest<ResourceResponse<InventoryLocation>>(
    `/v1/inventory-locations/${id}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

export async function deleteInventoryLocation(id: string): Promise<void> {
  await apiRequest<void>(`/v1/inventory-locations/${id}`, {
    method: 'DELETE',
  })
}
