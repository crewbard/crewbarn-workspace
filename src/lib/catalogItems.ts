import { API_URL, ApiError, apiRequest, getStoredToken, getActingTenant } from '@/lib/api'
import type {
  CatalogItem,
  CatalogItemInput,
  CatalogItemUpdateInput,
  CatalogItemListParams,
  CatalogAttentionCounts,
  BulkPriceChange,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/catalogItem'

/**
 * GET /v1/catalog-items - paginated list with FTS search via ?q=.
 * Backend uses GIN index for FTS plus LIKE on identifier columns
 * (sku, supplier_sku, barcode, qr_code_value) for partial-match.
 */
export async function listCatalogItems(
  params: CatalogItemListParams = {}
): Promise<PaginatedResponse<CatalogItem>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (key === 'fits' && value && typeof value === 'object') {
      // Fits filter: fits[subject]=vehicle&fits[make]=Ford…
      Object.entries(value as Record<string, string>).forEach(([field, v]) => {
        if (v !== undefined && v !== null && v !== '') query.append(`fits[${field}]`, String(v))
      })
      return
    }
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/catalog-items' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<CatalogItem>>(path)
}

/**
 * GET /v1/catalog-items/attention - products missing a price, photo or
 * supplier, low, out and not stocked, for the Product catalog strip and chips.
 */
export async function getCatalogAttention(
  params: { product_category_id?: string } = {}
): Promise<CatalogAttentionCounts> {
  const query = params.product_category_id ? `?product_category_id=${encodeURIComponent(params.product_category_id)}` : ''
  const response = await apiRequest<{ data: CatalogAttentionCounts }>(`/v1/catalog-items/attention${query}`)
  return response.data
}

export async function getCatalogItem(id: string): Promise<CatalogItem> {
  const response = await apiRequest<ResourceResponse<CatalogItem>>(`/v1/catalog-items/${id}`)
  return response.data
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  const response = await apiRequest<ResourceResponse<CatalogItem>>('/v1/catalog-items', {
    method: 'POST',
    body: input,
  })
  return response.data
}

export async function updateCatalogItem(
  id: string,
  input: CatalogItemUpdateInput
): Promise<CatalogItem> {
  const response = await apiRequest<ResourceResponse<CatalogItem>>(`/v1/catalog-items/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/** POST /v1/catalog-items/prices: price several products at a markup over their own cost. */
export async function bulkSetPrice(input: { items: string[]; markup_percent: number; rounding?: 'nearest_cent' | 'up_to_dollar' }): Promise<{ changed: BulkPriceChange[]; skipped: string[] }> {
  const response = await apiRequest<{ data: { changed: BulkPriceChange[]; skipped: string[] } }>('/v1/catalog-items/prices', { method: 'POST', body: input })
  return response.data
}

export async function deleteCatalogItem(id: string): Promise<void> {
  await apiRequest<void>(`/v1/catalog-items/${id}`, {
    method: 'DELETE',
  })
}

/**
 * Multipart upload of an image for a catalog item. 1:1 with the item —
 * uploading replaces any prior image on this row. Uses fetch directly
 * because apiRequest forces a JSON Content-Type, which the browser must
 * set on its own (with boundary) for multipart/form-data.
 */
export async function uploadCatalogItemImage(id: string, file: File): Promise<CatalogItem> {
  const formData = new FormData()
  formData.append('image', file)

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getStoredToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const actingTenant = getActingTenant()
  if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant

  const response = await fetch(`${API_URL}/v1/catalog-items/${id}/image`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!response.ok) {
    let message = `Upload failed (HTTP ${response.status})`
    let details: unknown
    try {
      const errBody = await response.json()
      message = errBody.message || message
      details = errBody.errors || errBody.detail
    } catch {
      // ignore
    }
    throw new ApiError(response.status, 'upload_failed', message, details)
  }
  const json: ResourceResponse<CatalogItem> = await response.json()
  return json.data
}

export async function deleteCatalogItemImage(id: string): Promise<CatalogItem> {
  const response = await apiRequest<ResourceResponse<CatalogItem>>(
    `/v1/catalog-items/${id}/image`,
    { method: 'DELETE' }
  )
  return response.data
}
