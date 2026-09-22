import { API_URL, apiRequest, getStoredToken, getActingTenant } from '@/lib/api'

export interface CustomerDocument {
  id: string
  customer_id: string
  document_type: 'file' | 'rich_text'
  title: string
  file_url: string | null
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  sort_order: number
  uploaded_by_account_id: string | null
  created_at: string | null
  updated_at: string | null
}

export async function listCustomerDocuments(
  customerId: string,
): Promise<CustomerDocument[]> {
  const res = await apiRequest<{ data: CustomerDocument[] }>(
    `/v1/customers/${customerId}/documents`,
  )
  return res.data
}

/**
 * Upload via multipart form-data. `apiRequest` is JSON-only, so we hand-roll
 * the fetch with the bearer token from localStorage.
 */
export async function uploadCustomerDocument(
  customerId: string,
  file: File,
  title?: string,
): Promise<CustomerDocument> {
  const fd = new FormData()
  fd.append('document', file)
  if (title) fd.append('title', title)

  const token = getStoredToken()
  const actingTenant = getActingTenant()

  const resp = await fetch(`${API_URL}/v1/customers/${customerId}/documents`, {
    method: 'POST',
    body: fd,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
    },
  })

  if (!resp.ok) {
    let detail = ''
    try {
      const body = await resp.json()
      detail = body?.message ?? body?.detail ?? JSON.stringify(body)
    } catch { /* ignore */ }
    throw new Error(`Upload failed (HTTP ${resp.status}): ${detail}`)
  }

  const body = await resp.json()
  return body.data as CustomerDocument
}

export async function deleteCustomerDocument(
  customerId: string,
  documentId: string,
): Promise<void> {
  await apiRequest<void>(
    `/v1/customers/${customerId}/documents/${documentId}`,
    { method: 'DELETE' },
  )
}
