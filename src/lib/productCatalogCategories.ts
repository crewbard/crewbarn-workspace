import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'
import type {
  ProductCatalogCategory,
  ProductCatalogCategoryInput,
  ProductCatalogCategoryUpdateInput,
  ProductCatalogCategoryListParams,
  ResourceResponse,
} from '@/types/productCatalogCategory'

/**
 * Backend returns a flat array under data when shape=flat (default).
 * NOT paginated - the controller does ->get() not ->paginate(). We type
 * the response loosely to match.
 */
interface CategoryListResponse {
  data: ProductCatalogCategory[]
}

export async function listProductCatalogCategories(
  params: ProductCatalogCategoryListParams = {}
): Promise<CategoryListResponse> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/product-categories' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<CategoryListResponse>(path)
}

export async function getProductCatalogCategory(id: string): Promise<ProductCatalogCategory> {
  const response = await apiRequest<ResourceResponse<ProductCatalogCategory>>(
    `/v1/product-categories/${id}`
  )
  return response.data
}

export async function createProductCatalogCategory(
  input: ProductCatalogCategoryInput
): Promise<ProductCatalogCategory> {
  const response = await apiRequest<ResourceResponse<ProductCatalogCategory>>(
    '/v1/product-categories',
    { method: 'POST', body: input }
  )
  return response.data
}

export async function updateProductCatalogCategory(
  id: string,
  input: ProductCatalogCategoryUpdateInput
): Promise<ProductCatalogCategory> {
  const response = await apiRequest<ResourceResponse<ProductCatalogCategory>>(
    `/v1/product-categories/${id}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

export async function deleteProductCatalogCategory(id: string): Promise<void> {
  await apiRequest<void>(`/v1/product-categories/${id}`, {
    method: 'DELETE',
  })
}


/**
 * Multipart upload of a category tile photo. fetch directly rather than
 * apiRequest, which forces a JSON Content-Type — the browser has to set that
 * header itself so it can include the multipart boundary.
 */
export async function uploadProductCategoryImage(
  id: string,
  file: File,
): Promise<ProductCatalogCategory> {
  const formData = new FormData()
  formData.append('image', file)

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getStoredToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const actingTenant = getActingTenant()
  if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant

  const response = await fetch(`${API_URL}/v1/product-categories/${id}/image`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!response.ok) {
    let message = `Upload failed (HTTP ${response.status})`
    try {
      const errBody = await response.json()
      message = errBody.message || message
    } catch {
      // keep the default
    }
    throw new Error(message)
  }
  const json: ResourceResponse<ProductCatalogCategory> = await response.json()
  return json.data
}

export async function deleteProductCategoryImage(id: string): Promise<ProductCatalogCategory> {
  return (
    await apiRequest<ResourceResponse<ProductCatalogCategory>>(
      `/v1/product-categories/${id}/image`,
      { method: 'DELETE' },
    )
  ).data
}
