import { apiRequest } from '@/lib/api'
import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderUpdateInput,
  PurchaseOrderListParams,
  PurchaseOrderItem,
  PurchaseOrderItemInput,
  PurchaseOrderItemUpdateInput,
  PurchaseOrderReceiveInput,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/purchaseOrder'

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

// ---- Header CRUD ----

export async function listPurchaseOrders(
  params: PurchaseOrderListParams = {}
): Promise<PaginatedResponse<PurchaseOrder>> {
  return apiRequest<PaginatedResponse<PurchaseOrder>>(
    `/v1/purchase-orders${buildQuery(params)}`
  )
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await apiRequest<ResourceResponse<PurchaseOrder>>(
    `/v1/purchase-orders/${id}`
  )
  return res.data
}

export async function createPurchaseOrder(
  input: PurchaseOrderInput
): Promise<PurchaseOrder> {
  const res = await apiRequest<ResourceResponse<PurchaseOrder>>(
    '/v1/purchase-orders',
    { method: 'POST', body: input }
  )
  return res.data
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderUpdateInput
): Promise<PurchaseOrder> {
  const res = await apiRequest<ResourceResponse<PurchaseOrder>>(
    `/v1/purchase-orders/${id}`,
    { method: 'PATCH', body: input }
  )
  return res.data
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await apiRequest<void>(`/v1/purchase-orders/${id}`, { method: 'DELETE' })
}

// ---- Nested item CRUD ----

interface ItemListResponse {
  data: PurchaseOrderItem[]
}

export async function listPurchaseOrderItems(
  poId: string
): Promise<PurchaseOrderItem[]> {
  const res = await apiRequest<ItemListResponse>(
    `/v1/purchase-orders/${poId}/items`
  )
  return res.data
}

export async function createPurchaseOrderItem(
  poId: string,
  input: PurchaseOrderItemInput
): Promise<PurchaseOrderItem> {
  const res = await apiRequest<ResourceResponse<PurchaseOrderItem>>(
    `/v1/purchase-orders/${poId}/items`,
    { method: 'POST', body: input }
  )
  return res.data
}

export async function updatePurchaseOrderItem(
  poId: string,
  itemId: string,
  input: PurchaseOrderItemUpdateInput
): Promise<PurchaseOrderItem> {
  const res = await apiRequest<ResourceResponse<PurchaseOrderItem>>(
    `/v1/purchase-orders/${poId}/items/${itemId}`,
    { method: 'PATCH', body: input }
  )
  return res.data
}

export async function deletePurchaseOrderItem(
  poId: string,
  itemId: string
): Promise<void> {
  await apiRequest<void>(`/v1/purchase-orders/${poId}/items/${itemId}`, {
    method: 'DELETE',
  })
}

// ---- Receive ----

export async function receivePurchaseOrder(
  poId: string,
  input: PurchaseOrderReceiveInput
): Promise<PurchaseOrder> {
  const res = await apiRequest<ResourceResponse<PurchaseOrder>>(
    `/v1/purchase-orders/${poId}/receive`,
    { method: 'POST', body: input }
  )
  return res.data
}
