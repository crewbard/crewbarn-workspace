import { apiRequest } from '@/lib/api'
import type {
  CompanyAsset,
  CompanyAssetInput,
  CompanyAssetListParams,
  CompanyAssetUpdateInput,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/companyAsset'

export async function listCompanyAssets(
  params: CompanyAssetListParams = {}
): Promise<PaginatedResponse<CompanyAsset>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })

  const path = '/v1/company-assets' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<CompanyAsset>>(path)
}

export async function createCompanyAsset(input: CompanyAssetInput): Promise<CompanyAsset> {
  const response = await apiRequest<ResourceResponse<CompanyAsset>>('/v1/company-assets', {
    method: 'POST',
    body: input,
  })
  return response.data
}

export async function updateCompanyAsset(
  id: string,
  input: CompanyAssetUpdateInput
): Promise<CompanyAsset> {
  const response = await apiRequest<ResourceResponse<CompanyAsset>>(`/v1/company-assets/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

export async function deleteCompanyAsset(id: string): Promise<void> {
  await apiRequest<void>(`/v1/company-assets/${id}`, { method: 'DELETE' })
}
