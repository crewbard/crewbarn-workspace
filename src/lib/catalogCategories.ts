import { apiRequest } from '@/lib/api'
import type {
  CatalogCategory,
  CatalogCategoryInput,
  CatalogCategoryUpdateInput,
  CatalogCategoryListParams,
  ResourceResponse,
} from '@/types/catalogCategory'

/**
 * Backend returns a flat array under data when shape=flat (default).
 * NOT paginated despite the resource collection - the controller does
 * ->get() not ->paginate(). We type the response loosely to match.
 */
interface CategoryListResponse {
  data: CatalogCategory[]
}

export async function listCatalogCategories(
  params: CatalogCategoryListParams = {}
): Promise<CategoryListResponse> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/catalog-categories' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<CategoryListResponse>(path)
}

export async function getCatalogCategory(id: string): Promise<CatalogCategory> {
  const response = await apiRequest<ResourceResponse<CatalogCategory>>(
    `/v1/catalog-categories/${id}`
  )
  return response.data
}

export async function createCatalogCategory(
  input: CatalogCategoryInput
): Promise<CatalogCategory> {
  const response = await apiRequest<ResourceResponse<CatalogCategory>>(
    '/v1/catalog-categories',
    { method: 'POST', body: input }
  )
  return response.data
}

export async function updateCatalogCategory(
  id: string,
  input: CatalogCategoryUpdateInput
): Promise<CatalogCategory> {
  const response = await apiRequest<ResourceResponse<CatalogCategory>>(
    `/v1/catalog-categories/${id}`,
    { method: 'PATCH', body: input }
  )
  return response.data
}

export async function deleteCatalogCategory(id: string): Promise<void> {
  await apiRequest<void>(`/v1/catalog-categories/${id}`, {
    method: 'DELETE',
  })
}
