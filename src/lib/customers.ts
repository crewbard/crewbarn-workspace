import { apiRequest } from '@/lib/api'
import type {
  Customer,
  CustomerInput,
  CustomerUpdateInput,
  CustomerListParams,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/customer'

/**
 * GET /v1/customers — paginated list with search, filter, sort.
 */
export async function listCustomers(
  params: CustomerListParams = {}
): Promise<PaginatedResponse<Customer>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })

  const path = '/v1/customers' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<Customer>>(path)
}

/**
 * GET /v1/customers/{id} — single customer.
 */
export async function getCustomer(id: string): Promise<Customer> {
  const response = await apiRequest<ResourceResponse<Customer>>(`/v1/customers/${id}`)
  return response.data
}

/**
 * POST /v1/customers — create a new customer.
 */
export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const response = await apiRequest<ResourceResponse<Customer>>('/v1/customers', {
    method: 'POST',
    body: input,
  })
  return response.data
}

/**
 * PATCH /v1/customers/{id} — partial update.
 */
export async function updateCustomer(
  id: string,
  input: Partial<CustomerUpdateInput>
): Promise<Customer> {
  const response = await apiRequest<ResourceResponse<Customer>>(`/v1/customers/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/**
 * DELETE /v1/customers/{id} — soft delete.
 */
export async function deleteCustomer(id: string): Promise<void> {
  await apiRequest<void>(`/v1/customers/${id}`, {
    method: 'DELETE',
  })
}

export interface CustomerMergeResponse extends ResourceResponse<Customer> {
  merge?: {
    merged_customer_id: string
    moved: Record<string, number>
  }
}

/**
 * POST /v1/customers/{id}/merge — merge a duplicate into the survivor customer.
 */
export async function mergeCustomer(
  survivorCustomerId: string,
  mergeCustomerId: string,
  reason?: string
): Promise<CustomerMergeResponse> {
  return apiRequest<CustomerMergeResponse>(`/v1/customers/${survivorCustomerId}/merge`, {
    method: 'POST',
    body: {
      merge_customer_id: mergeCustomerId,
      reason: reason?.trim() || undefined,
    },
  })
}
