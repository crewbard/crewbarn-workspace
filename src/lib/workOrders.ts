import { apiRequest } from '@/lib/api'
import type {
  WorkOrder,
  WorkOrderInput,
  WorkOrderUpdateInput,
  WorkOrderListParams,
} from '@/types/workOrder'
import type {
  WorkOrderLineItem,
  WorkOrderLineItemInput,
  WorkOrderLineItemUpdateInput,
} from '@/types/workOrderLineItem'
import type { PaginatedResponse, ResourceResponse } from '@/types/api'

// ---------- Work Orders ----------

/**
 * GET /v1/work-orders — paginated list with filters.
 */
export async function listWorkOrders(
  params: WorkOrderListParams = {}
): Promise<PaginatedResponse<WorkOrder>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/work-orders' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<WorkOrder>>(path)
}

/**
 * GET /v1/work-orders/{id} — single work order with eager-loaded relations.
 */
export async function getWorkOrder(id: string): Promise<WorkOrder> {
  const response = await apiRequest<ResourceResponse<WorkOrder>>(`/v1/work-orders/${id}`)
  return response.data
}

/**
 * POST /v1/work-orders — create a new work order.
 * Auto-assigns work_order_number atomically.
 */
export async function createWorkOrder(input: WorkOrderInput): Promise<WorkOrder> {
  const response = await apiRequest<ResourceResponse<WorkOrder>>('/v1/work-orders', {
    method: 'POST',
    body: input,
  })
  return response.data
}

/**
 * PATCH /v1/work-orders/{id} — partial update.
 * Auto-stamps lifecycle timestamps on status change.
 */
export async function updateWorkOrder(
  id: string,
  input: WorkOrderUpdateInput
): Promise<WorkOrder> {
  const response = await apiRequest<ResourceResponse<WorkOrder>>(`/v1/work-orders/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/**
 * DELETE /v1/work-orders/{id} — soft delete.
 */
export async function deleteWorkOrder(id: string): Promise<void> {
  await apiRequest<void>(`/v1/work-orders/${id}`, {
    method: 'DELETE',
  })
}

// ---------- Work Order Line Items (nested under a work order) ----------

/**
 * GET /v1/work-orders/{wo}/line-items — list lines for a work order.
 */
export async function listLineItems(workOrderId: string): Promise<WorkOrderLineItem[]> {
  const response = await apiRequest<ResourceResponse<WorkOrderLineItem[]>>(
    `/v1/work-orders/${workOrderId}/line-items`
  )
  return response.data
}

/**
 * POST /v1/work-orders/{wo}/line-items — add line item.
 * Server atomically recalculates work order totals.
 */
export async function createLineItem(
  workOrderId: string,
  input: WorkOrderLineItemInput
): Promise<WorkOrderLineItem> {
  const response = await apiRequest<ResourceResponse<WorkOrderLineItem>>(
    `/v1/work-orders/${workOrderId}/line-items`,
    { method: 'POST', body: input }
  )
  return response.data
}

/**
 * PATCH /v1/work-orders/{wo}/line-items/{id} — edit line item.
 * Server atomically recalculates work order totals.
 */
export async function updateLineItem(
  workOrderId: string,
  lineItemId: string,
  input: WorkOrderLineItemUpdateInput
): Promise<WorkOrderLineItem> {
  const response = await apiRequest<ResourceResponse<WorkOrderLineItem>>(
    `/v1/work-orders/${workOrderId}/line-items/${lineItemId}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

/**
 * DELETE /v1/work-orders/{wo}/line-items/{id} — remove line item.
 * Server atomically recalculates work order totals.
 */
export async function deleteLineItem(workOrderId: string, lineItemId: string): Promise<void> {
  await apiRequest<void>(
    `/v1/work-orders/${workOrderId}/line-items/${lineItemId}`,
    { method: 'DELETE' }
  )
}

/**
 * POST /v1/work-orders/{wo}/line-items/reorder — bulk re-sort.
 * Body: { order: ["woli_xxx", "woli_yyy", ...] } — sort_order assigned by array position.
 */
export async function reorderLineItems(workOrderId: string, order: string[]): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/v1/work-orders/${workOrderId}/line-items/reorder`,
    { method: 'POST', body: { order } }
  )
}
