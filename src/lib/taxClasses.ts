import { apiRequest } from '@/lib/api'
import type {
  TaxClass,
  TaxClassInput,
  TaxClassUpdateInput,
  TaxClassListParams,
  TaxClassComponent,
  TaxClassComponentInput,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/taxClass'

// ---------- Tax classes ----------

/**
 * GET /v1/tax-classes - paginated list with components eager-loaded.
 */
export async function listTaxClasses(
  params: TaxClassListParams = {}
): Promise<PaginatedResponse<TaxClass>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/tax-classes' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<TaxClass>>(path)
}

/**
 * GET /v1/tax-classes/{id} - single tax class with components.
 */
export async function getTaxClass(id: string): Promise<TaxClass> {
  const response = await apiRequest<ResourceResponse<TaxClass>>(`/v1/tax-classes/${id}`)
  return response.data
}

/**
 * POST /v1/tax-classes - create with optional nested components.
 *
 * Backend handles the nested create in a single transaction; rate_pct
 * comes back computed correctly thanks to refresh() in the controller.
 */
export async function createTaxClass(input: TaxClassInput): Promise<TaxClass> {
  const response = await apiRequest<ResourceResponse<TaxClass>>('/v1/tax-classes', {
    method: 'POST',
    body: input,
  })
  return response.data
}

/**
 * PATCH /v1/tax-classes/{id} - update parent fields only. Component
 * changes go through the dedicated /components endpoints.
 */
export async function updateTaxClass(
  id: string,
  input: TaxClassUpdateInput
): Promise<TaxClass> {
  const response = await apiRequest<ResourceResponse<TaxClass>>(`/v1/tax-classes/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/**
 * DELETE /v1/tax-classes/{id} - soft delete.
 */
export async function deleteTaxClass(id: string): Promise<void> {
  await apiRequest<void>(`/v1/tax-classes/${id}`, {
    method: 'DELETE',
  })
}

// ---------- Tax class components (nested) ----------

/**
 * Each of these triggers the parent's rate_pct auto-recompute via
 * the TaxClassComponent::saved/deleted model events.
 */

export async function createTaxClassComponent(
  taxClassId: string,
  input: TaxClassComponentInput
): Promise<TaxClassComponent> {
  const response = await apiRequest<ResourceResponse<TaxClassComponent>>(
    `/v1/tax-classes/${taxClassId}/components`,
    { method: 'POST', body: input }
  )
  return response.data
}

export async function updateTaxClassComponent(
  taxClassId: string,
  componentId: string,
  input: Partial<TaxClassComponentInput>
): Promise<TaxClassComponent> {
  const response = await apiRequest<ResourceResponse<TaxClassComponent>>(
    `/v1/tax-classes/${taxClassId}/components/${componentId}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

export async function deleteTaxClassComponent(
  taxClassId: string,
  componentId: string
): Promise<void> {
  await apiRequest<void>(
    `/v1/tax-classes/${taxClassId}/components/${componentId}`,
    { method: 'DELETE' }
  )
}
