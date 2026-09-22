import { API_URL, ApiError, apiRequest, getStoredToken, getActingTenant } from "@/lib/api"
import type { AssetDocument, ResourceResponse } from "@/types/assetDocument"

/**
 * List documents for an asset.
 * Backend: GET /v1/assets/{id}/documents
 */
export async function listAssetDocuments(assetId: string): Promise<AssetDocument[]> {
  const response = await apiRequest<{ data: AssetDocument[] }>(
    `/v1/assets/${assetId}/documents`
  )
  return response.data
}

/**
 * Upload a document to an asset. Multipart POST.
 * Backend: POST /v1/assets/{id}/documents
 *
 * Mirrors the photo upload pattern: fetch directly because multipart
 * uploads cannot use the JSON Content-Type header that apiRequest forces.
 * The browser sets multipart/form-data with the right boundary automatically
 * when we pass FormData and DON'T set Content-Type.
 */
export async function uploadAssetDocument(
  assetId: string,
  file: File,
  options?: { title?: string; sort_order?: number }
): Promise<AssetDocument> {
  const formData = new FormData()
  formData.append("document", file)
  if (options?.title) formData.append("title", options.title)
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

  const response = await fetch(`${API_URL}/v1/assets/${assetId}/documents`, {
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

  const json: ResourceResponse<AssetDocument> = await response.json()
  return json.data
}