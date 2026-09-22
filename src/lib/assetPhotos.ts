import { API_URL, ApiError, apiRequest, getStoredToken, getActingTenant } from "@/lib/api"
import type { AssetPhoto, ResourceResponse } from "@/types/assetPhoto"

/**
 * List photos for an asset.
 * Backend: GET /v1/assets/{id}/photos
 */
export async function listAssetPhotos(assetId: string): Promise<AssetPhoto[]> {
  const response = await apiRequest<{ data: AssetPhoto[] }>(`/v1/assets/${assetId}/photos`)
  return response.data
}

/**
 * Upload a photo to an asset. Multipart POST.
 * Backend: POST /v1/assets/{id}/photos
 *
 * Uses fetch directly instead of apiRequest because multipart uploads
 * cannot use the JSON Content-Type header that apiRequest forces.
 * The browser sets multipart/form-data with the right boundary automatically
 * when we pass FormData and DON'T set Content-Type.
 */
export async function uploadAssetPhoto(
  assetId: string,
  file: File,
  options?: { caption?: string; sort_order?: number }
): Promise<AssetPhoto> {
  const formData = new FormData()
  formData.append("photo", file)
  if (options?.caption) formData.append("caption", options.caption)
  if (options?.sort_order !== undefined) {
    formData.append("sort_order", String(options.sort_order))
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    // NO Content-Type — browser sets multipart/form-data with boundary
  }

  const token = getStoredToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const actingTenant = getActingTenant()
  if (actingTenant) {
    headers["X-Act-As-Tenant"] = actingTenant
  }

  const response = await fetch(`${API_URL}/v1/assets/${assetId}/photos`, {
    method: "POST",
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
      // Response wasn't JSON; use the status-based fallback
    }
    throw new ApiError(response.status, "upload_failed", message, details)
  }

  const json: ResourceResponse<AssetPhoto> = await response.json()
  return json.data
}
