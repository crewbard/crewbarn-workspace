import { apiRequest } from '@/lib/api'
import type { CustomerContact, CustomerContactInput } from '@/types/customer'
import type { ResourceResponse } from '@/types/api'

/**
 * POST /v1/customers/{customer}/contacts
 */
export async function createCustomerContact(
  customerId: string,
  input: CustomerContactInput,
): Promise<CustomerContact> {
  const res = await apiRequest<ResourceResponse<CustomerContact>>(
    `/v1/customers/${customerId}/contacts`,
    { method: 'POST', body: input },
  )
  return res.data
}

/**
 * PATCH /v1/customers/{customer}/contacts/{contact}
 */
export async function updateCustomerContact(
  customerId: string,
  contactId: string,
  input: CustomerContactInput,
): Promise<CustomerContact> {
  const res = await apiRequest<ResourceResponse<CustomerContact>>(
    `/v1/customers/${customerId}/contacts/${contactId}`,
    { method: 'PATCH', body: input },
  )
  return res.data
}

/**
 * DELETE /v1/customers/{customer}/contacts/{contact}
 */
export async function deleteCustomerContact(
  customerId: string,
  contactId: string,
): Promise<void> {
  await apiRequest<void>(
    `/v1/customers/${customerId}/contacts/${contactId}`,
    { method: 'DELETE' },
  )
}
