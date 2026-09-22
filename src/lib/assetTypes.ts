import { apiRequest } from "@/lib/api"
import type {
  AssetType,
  AssetTypeInput,
  AssetTypeUpdateInput,
  AssetTypeListParams,
  PaginatedResponse,
  ResourceResponse,
} from "@/types/assetType"

export async function listAssetTypes(
  params: AssetTypeListParams = {}
): Promise<PaginatedResponse<AssetType>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value))
    }
  })
  const path = "/v1/asset-types" + (query.toString() ? `?${query.toString()}` : "")
  return apiRequest<PaginatedResponse<AssetType>>(path)
}

export async function getAssetType(id: string): Promise<AssetType> {
  const response = await apiRequest<ResourceResponse<AssetType>>(`/v1/asset-types/${id}`)
  return response.data
}

export async function createAssetType(input: AssetTypeInput): Promise<AssetType> {
  const response = await apiRequest<ResourceResponse<AssetType>>("/v1/asset-types", {
    method: "POST",
    body: input,
  })
  return response.data
}

export async function updateAssetType(
  id: string,
  input: AssetTypeUpdateInput
): Promise<AssetType> {
  const response = await apiRequest<ResourceResponse<AssetType>>(`/v1/asset-types/${id}`, {
    method: "PATCH",
    body: input,
  })
  return response.data
}

export async function deleteAssetType(id: string): Promise<void> {
  await apiRequest<void>(`/v1/asset-types/${id}`, { method: "DELETE" })
}
