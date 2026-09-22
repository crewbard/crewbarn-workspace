import { apiRequest } from "@/lib/api"
import type {
  Asset,
  AssetInput,
  AssetUpdateInput,
  AssetListParams,
  PaginatedResponse,
  ResourceResponse,
} from "@/types/asset"

export async function listAssets(
  params: AssetListParams = {}
): Promise<PaginatedResponse<Asset>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value))
    }
  })
  const path = "/v1/assets" + (query.toString() ? `?${query.toString()}` : "")
  return apiRequest<PaginatedResponse<Asset>>(path)
}

export interface AssetBatchResult {
  data: Asset[]
  meta: { requested: number; found: number; missing: string[] }
}

/**
 * Resolve an explicit list of asset ids for a label run.
 *
 * The batch label page used to page through assets and match ids in the
 * browser, so a property with more than one page lost labels silently. This
 * reports what it couldn't find rather than printing a short stack.
 */
export async function batchAssets(ids: string[]): Promise<AssetBatchResult> {
  return apiRequest<AssetBatchResult>("/v1/assets/batch", {
    method: "POST",
    body: { ids },
  })
}

export async function getAsset(id: string): Promise<Asset> {
  const response = await apiRequest<ResourceResponse<Asset>>(`/v1/assets/${id}`)
  return response.data
}

/**
 * Look up an asset by its scannable asset_code (printed on QR stickers
 * or assigned manually). Used by Slice 2.5 find-by-scan flow.
 *
 * Throws ApiError with status 404 if no asset has that code.
 *
 * Backend: GET /v1/assets/by-code/{code}
 */
export async function getAssetByCode(code: string): Promise<Asset> {
  const response = await apiRequest<ResourceResponse<Asset>>(
    `/v1/assets/by-code/${encodeURIComponent(code)}`
  )
  return response.data
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  const response = await apiRequest<ResourceResponse<Asset>>("/v1/assets", {
    method: "POST",
    body: input,
  })
  return response.data
}

export async function updateAsset(id: string, input: AssetUpdateInput): Promise<Asset> {
  const response = await apiRequest<ResourceResponse<Asset>>(`/v1/assets/${id}`, {
    method: "PATCH",
    body: input,
  })
  return response.data
}

export async function deleteAsset(id: string): Promise<void> {
  await apiRequest<void>(`/v1/assets/${id}`, { method: "DELETE" })
}
