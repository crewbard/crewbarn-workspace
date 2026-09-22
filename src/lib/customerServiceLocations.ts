import { apiRequest } from '@/lib/api'
import type { CustomerServiceLocation } from '@/types/customer'
import type { ResourceResponse } from '@/types/api'

/**
 * Input shape for POST /v1/customers/{customer}/service-locations.
 *
 * Used by WorkOrderForm when the user types a new service location inline
 * during job creation. Per the locked design, every typed location is
 * persisted as a saved location on the customer (no one-time-only flag).
 */
export interface CustomerServiceLocationInput {
  nickname?: string | null
  street_address?: string | null
  apt_unit?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  is_primary?: boolean
  gated_property?: boolean
  gate_code?: string | null
  entry_notes?: string | null
  active?: boolean
}

/**
 * POST /v1/customers/{customer}/service-locations
 *
 * Server atomically swaps the primary flag if is_primary=true. Returns the
 * created location with its server-assigned id (loc_xxx).
 */
export async function createCustomerServiceLocation(
  customerId: string,
  input: CustomerServiceLocationInput
): Promise<CustomerServiceLocation> {
  const response = await apiRequest<ResourceResponse<CustomerServiceLocation>>(
    `/v1/customers/${customerId}/service-locations`,
    { method: 'POST', body: input }
  )
  return response.data
}

/**
 * PATCH /v1/customers/{customer}/service-locations/{service_location}
 *
 * Partial update — pass only the fields that changed.
 */
export async function updateCustomerServiceLocation(
  customerId: string,
  locationId: string,
  input: CustomerServiceLocationInput
): Promise<CustomerServiceLocation> {
  const response = await apiRequest<ResourceResponse<CustomerServiceLocation>>(
    `/v1/customers/${customerId}/service-locations/${locationId}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

/**
 * DELETE /v1/customers/{customer}/service-locations/{service_location}
 */
export async function deleteCustomerServiceLocation(
  customerId: string,
  locationId: string,
): Promise<void> {
  await apiRequest<void>(
    `/v1/customers/${customerId}/service-locations/${locationId}`,
    { method: 'DELETE' },
  )
}

/**
 * GET /v1/customer-service-locations/{id}
 *
 * Customer-independent fetch. Used by UI that has only a loc_xxx id
 * (asset group picker/manager modal headers).
 */
export async function getCustomerServiceLocation(
  id: string
): Promise<CustomerServiceLocation> {
  const response = await apiRequest<ResourceResponse<CustomerServiceLocation>>(
    `/v1/customer-service-locations/${id}`
  )
  return response.data
}
