import { apiRequest } from '@/lib/api'
import type {
  InventorySettings,
  InventorySettingsUpdate,
  InventorySettingsResponse,
} from '@/types/tenantSettings'

/**
 * Fetch the current tenant's inventory settings.
 * Unwraps the { data } envelope so callers deal with the domain type.
 */
export async function getInventorySettings(): Promise<InventorySettings> {
  const response = await apiRequest<InventorySettingsResponse>(
    '/v1/settings/inventory'
  )
  return response.data
}

/**
 * Patch one or more inventory settings. Only changed fields should be
 * sent — backend validates each as `sometimes|boolean`.
 */
export async function updateInventorySettings(
  update: InventorySettingsUpdate
): Promise<InventorySettings> {
  const response = await apiRequest<InventorySettingsResponse>(
    '/v1/settings/inventory',
    {
      method: 'PATCH',
      body: update,
    }
  )
  return response.data
}
