import { apiRequest } from '@/lib/api'
import type {
  Estimate,
  EstimateInput,
  EstimateUpdateInput,
  EstimateListParams,
} from '@/types/estimate'
import type {
  EstimateLineItem,
  EstimateLineItemInput,
  EstimateLineItemUpdateInput,
} from '@/types/estimateLineItem'
import type { PaginatedResponse, ResourceResponse } from '@/types/api'

// ---------- Estimates ----------

/**
 * GET /v1/estimates - paginated list with filters.
 */
export async function listEstimates(
  params: EstimateListParams = {}
): Promise<PaginatedResponse<Estimate>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/estimates' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<Estimate>>(path)
}

/**
 * GET /v1/estimates/{id} - single estimate with eager-loaded relations.
 */
export async function getEstimate(id: string): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(`/v1/estimates/${id}`)
  return response.data
}

/**
 * POST /v1/estimates - create a new draft estimate.
 * Auto-assigns estimate_number atomically via TenantSetting.
 */
export async function createEstimate(input: EstimateInput): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>('/v1/estimates', {
    method: 'POST',
    body: input,
  })
  return response.data
}

/**
 * PATCH /v1/estimates/{id} - partial update.
 * Status transitions go through dedicated lifecycle endpoints.
 */
export async function updateEstimate(
  id: string,
  input: EstimateUpdateInput
): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(`/v1/estimates/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/**
 * DELETE /v1/estimates/{id} - soft delete.
 */
export async function deleteEstimate(id: string): Promise<void> {
  await apiRequest<void>(`/v1/estimates/${id}`, {
    method: 'DELETE',
  })
}

// ---------- Lifecycle actions ----------

/**
 * POST /v1/estimates/{id}/send - transition or redeliver.
 * Pass deliver=false when another reviewed channel already delivered it.
 * Returns full updated estimate so caller can setQueryData directly.
 */
export async function sendEstimate(
  id: string,
  options: { deliver?: boolean } = {}
): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(
    `/v1/estimates/${id}/send`,
    { method: 'POST', body: options }
  )
  return response.data
}

/**
 * POST /v1/estimates/{id}/approve - sent -> approved.
 */
export async function approveEstimate(id: string): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(
    `/v1/estimates/${id}/approve`,
    { method: 'POST' }
  )
  return response.data
}

/**
 * POST /v1/estimates/{id}/reject - sent -> rejected.
 */
export async function rejectEstimate(id: string): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(
    `/v1/estimates/${id}/reject`,
    { method: 'POST' }
  )
  return response.data
}

// ---------- Slice 7a-3: re-quote / convert ----------

/**
 * POST /v1/estimates/{id}/supersede - clone as new draft.
 * Original immediately flips to status='superseded'.
 * Body all-optional; default = clone all line items + carry over notes/terms.
 */
export interface SupersedeEstimateInput {
  line_item_ids?: string[]
  customer_notes?: string
  internal_notes?: string
  terms?: string
}
export async function supersedeEstimate(
  id: string,
  input: SupersedeEstimateInput = {}
): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(
    `/v1/estimates/${id}/supersede`,
    { method: 'POST', body: input }
  )
  return response.data
}

/**
 * POST /v1/estimates/{id}/convert - approved estimate -> WorkOrder.
 * Returns the new WorkOrder (skinny shape - just enough to navigate to it).
 * Estimate stays approved with converted_to_work_order_id pointing back.
 */
export interface ConvertEstimateInput {
  job_type_id: string
  status_id?: string
  service_location_id?: string
  title?: string
}
export interface ConvertedWorkOrder {
  id: string
  work_order_number: number
  display_number: string
  title: string
  [k: string]: unknown
}
export async function convertEstimate(
  id: string,
  input: ConvertEstimateInput
): Promise<ConvertedWorkOrder> {
  const response = await apiRequest<ResourceResponse<ConvertedWorkOrder>>(
    `/v1/estimates/${id}/convert`,
    { method: 'POST', body: input }
  )
  return response.data
}

// ---------- Covered assets ----------

/**
 * POST /v1/estimates/{id}/covered-assets - attach an asset.
 * Returns the updated estimate.
 */
export async function attachCoveredAsset(
  estimateId: string,
  assetId: string
): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(
    `/v1/estimates/${estimateId}/covered-assets`,
    { method: 'POST', body: { asset_id: assetId } }
  )
  return response.data
}

/**
 * DELETE /v1/estimates/{id}/covered-assets/{asset} - detach.
 * Returns the updated estimate.
 */
export async function detachCoveredAsset(
  estimateId: string,
  assetId: string
): Promise<Estimate> {
  const response = await apiRequest<ResourceResponse<Estimate>>(
    `/v1/estimates/${estimateId}/covered-assets/${assetId}`,
    { method: 'DELETE' }
  )
  return response.data
}

// ---------- Line items (nested under an estimate) ----------

/**
 * GET /v1/estimates/{est}/line-items
 */
export async function listLineItems(estimateId: string): Promise<EstimateLineItem[]> {
  const response = await apiRequest<ResourceResponse<EstimateLineItem[]>>(
    `/v1/estimates/${estimateId}/line-items`
  )
  return response.data
}

/**
 * POST /v1/estimates/{est}/line-items - add line item.
 * Server atomically recalculates parent estimate totals.
 */
export async function createLineItem(
  estimateId: string,
  input: EstimateLineItemInput
): Promise<EstimateLineItem> {
  const response = await apiRequest<ResourceResponse<EstimateLineItem>>(
    `/v1/estimates/${estimateId}/line-items`,
    { method: 'POST', body: input }
  )
  return response.data
}

/**
 * PATCH /v1/estimates/{est}/line-items/{id} - edit.
 */
export async function updateLineItem(
  estimateId: string,
  lineItemId: string,
  input: EstimateLineItemUpdateInput
): Promise<EstimateLineItem> {
  const response = await apiRequest<ResourceResponse<EstimateLineItem>>(
    `/v1/estimates/${estimateId}/line-items/${lineItemId}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

/**
 * DELETE /v1/estimates/{est}/line-items/{id} - remove.
 */
export async function deleteLineItem(estimateId: string, lineItemId: string): Promise<void> {
  await apiRequest<void>(
    `/v1/estimates/${estimateId}/line-items/${lineItemId}`,
    { method: 'DELETE' }
  )
}

/**
 * POST /v1/estimates/{est}/line-items/reorder - bulk reorder.
 * Body: { order: [eli_xxx, eli_yyy, ...] }. display_order = position+1.
 */
export async function reorderLineItems(estimateId: string, order: string[]): Promise<void> {
  await apiRequest<{ ok: true }>(
    `/v1/estimates/${estimateId}/line-items/reorder`,
    { method: 'POST', body: { order } }
  )
}