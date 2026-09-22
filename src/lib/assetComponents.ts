import { apiRequest } from "@/lib/api"
import type { AssetComponent, InstallAssetComponentInput, ResourceResponse } from "@/types/assetComponent"

/**
 * List components currently installed on an asset.
 * Backend: GET /v1/assets/{id}/components
 */
export async function listAssetComponents(assetId: string): Promise<AssetComponent[]> {
  const response = await apiRequest<{ data: AssetComponent[] }>(`/v1/assets/${assetId}/components`)
  return response.data
}

/**
 * Install an inventory unit (by serial number) onto an asset.
 * Backend: POST /v1/assets/{id}/components
 */
export async function installAssetComponent(
  assetId: string,
  input: InstallAssetComponentInput
): Promise<AssetComponent> {
  const response = await apiRequest<ResourceResponse<AssetComponent>>(
    `/v1/assets/${assetId}/components`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
  return response.data
}

/**
 * Uninstall a component from an asset (sets status back to available,
 * clears the installed_at_* bridge fields).
 * Backend: DELETE /v1/assets/{id}/components/{unitId}
 */
export async function uninstallAssetComponent(assetId: string, unitId: string): Promise<void> {
  await apiRequest<void>(`/v1/assets/${assetId}/components/${unitId}`, {
    method: "DELETE",
  })
}