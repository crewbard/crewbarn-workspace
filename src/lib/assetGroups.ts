/**
 * API client for asset groups (Slice 8).
 *
 * Backend routes registered in routes/api.php:
 *   GET    /v1/asset-groups
 *   POST   /v1/asset-groups
 *   GET    /v1/asset-groups/{id}
 *   PATCH  /v1/asset-groups/{id}
 *   DELETE /v1/asset-groups/{id}
 */

import { apiRequest } from "@/lib/api"
import type {
  AssetGroup,
  AssetGroupInput,
  AssetGroupUpdateInput,
  AssetGroupListParams,
  AssetTreeBuilderPayload,
  AssetTreeBuilderPreview,
  AssetTreeBuilderCreateResponse,
  PaginatedResponse,
  ResourceResponse,
} from "@/types/assetGroup"

function buildQuery<T extends object>(params: T): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === "boolean") {
      usp.set(k, v ? "1" : "0")
    } else {
      usp.set(k, String(v))
    }
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ""
}

export async function listAssetGroups(
  params: AssetGroupListParams = {}
): Promise<PaginatedResponse<AssetGroup>> {
  return apiRequest<PaginatedResponse<AssetGroup>>(
    `/v1/asset-groups${buildQuery(params)}`
  )
}

/**
 * Convenience: return root groups for a location with descendants nested.
 * Maps to GET /v1/asset-groups?customer_service_location_id=X&as_tree=1
 */
export async function getAssetGroupTree(
  customerServiceLocationId: string
): Promise<AssetGroup[]> {
  const response = await listAssetGroups({
    customer_service_location_id: customerServiceLocationId,
    as_tree: true,
  })
  return response.data
}

export interface AssetGroupQrCode {
  url: string
  group_code: string
}

/**
 * Mint (or fetch) the building/area QR for a group.
 *
 * The endpoint has existed since the group work landed, but nothing printed
 * it — the label pages only ever handled assets, so there was no lobby
 * placard that opens the whole site.
 */
export async function getAssetGroupQrCode(id: string): Promise<AssetGroupQrCode> {
  return apiRequest<AssetGroupQrCode>(`/v1/asset-groups/${id}/qr-code`)
}

export async function getAssetGroup(id: string): Promise<AssetGroup> {
  const response = await apiRequest<ResourceResponse<AssetGroup>>(
    `/v1/asset-groups/${id}`
  )
  return response.data
}

export async function createAssetGroup(
  input: AssetGroupInput
): Promise<AssetGroup> {
  const response = await apiRequest<ResourceResponse<AssetGroup>>(
    `/v1/asset-groups`,
    { method: "POST", body: input }
  )
  return response.data
}

export async function updateAssetGroup(
  id: string,
  input: AssetGroupUpdateInput
): Promise<AssetGroup> {
  const response = await apiRequest<ResourceResponse<AssetGroup>>(
    `/v1/asset-groups/${id}`,
    { method: "PATCH", body: input }
  )
  return response.data
}

export async function deleteAssetGroup(id: string): Promise<void> {
  await apiRequest<void>(`/v1/asset-groups/${id}`, { method: "DELETE" })
}

export async function previewAssetTreeBuilder(
  input: AssetTreeBuilderPayload
): Promise<AssetTreeBuilderPreview> {
  return apiRequest<AssetTreeBuilderPreview>(
    `/v1/asset-groups/tree-builder/preview`,
    { method: "POST", body: input }
  )
}

export async function createAssetTreeBuilder(
  input: AssetTreeBuilderPayload
): Promise<AssetTreeBuilderCreateResponse> {
  return apiRequest<AssetTreeBuilderCreateResponse>(
    `/v1/asset-groups/tree-builder/create`,
    { method: "POST", body: input }
  )
}
