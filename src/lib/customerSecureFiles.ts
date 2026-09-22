import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'

export interface CustomerSecureFile {
  id: string
  customer_id: string
  title: string
  description: string | null
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  source: string
  visibility: string
  created_by_account_id: string | null
  created_by_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SecureFileStatus {
  key: {
    configured: boolean
    key_version: number | null
    recovery_key_shown_at: string | null
    recovery_key_acknowledged_at: string | null
    status: string | null
  }
  unlocked_until: string | null
  can_manage: boolean
}

export interface SecureFileListResponse {
  data: CustomerSecureFile[]
  meta: {
    unlocked: boolean
    unlocked_until: string | null
  }
}

export interface SecureFileAuditRow {
  id: string
  event: string
  actor: string | null
  created_at: string | null
  meta: Record<string, unknown>
}

export function getSecureFileStatus(customerId: string) {
  return apiRequest<{ data: SecureFileStatus }>(`/v1/customers/${customerId}/secure-files/status`)
}

export function setupSecureFiles(customerId: string) {
  return apiRequest<{ data: { key: SecureFileStatus['key']; recovery_key: string | null; already_configured: boolean } }>(
    `/v1/customers/${customerId}/secure-files/setup`,
    { method: 'POST', body: {} },
  )
}

export function rotateSecureFileRecoveryKey(customerId: string) {
  return apiRequest<{ data: { key: SecureFileStatus['key']; recovery_key: string } }>(
    `/v1/customers/${customerId}/secure-files/recovery-key/rotate`,
    { method: 'POST', body: {} },
  )
}

export function recoverSecureFileKey(customerId: string, recoveryKey: string) {
  return apiRequest<{ data: { key: SecureFileStatus['key'] } }>(
    `/v1/customers/${customerId}/secure-files/recovery-key/recover`,
    { method: 'POST', body: { recovery_key: recoveryKey } },
  )
}

export function listCustomerSecureFiles(customerId: string) {
  return apiRequest<SecureFileListResponse>(`/v1/customers/${customerId}/secure-files`)
}

export function requestSecureFileAccess(customerId: string, channel: 'sms' | 'email') {
  return apiRequest<{ data: { sent: boolean; channel: string; to: string | null; expires_at: string | null; error?: string | null } }>(
    `/v1/customers/${customerId}/secure-files/access-token`,
    { method: 'POST', body: { channel } },
  )
}

export function verifySecureFileAccess(customerId: string, code: string) {
  return apiRequest<{ data: { unlocked_until: string | null } }>(
    `/v1/customers/${customerId}/secure-files/verify-token`,
    { method: 'POST', body: { code } },
  )
}

export async function uploadCustomerSecureFile(customerId: string, file: File, title?: string, description?: string) {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  if (description) form.append('description', description)

  return authedFormRequest<{ data: CustomerSecureFile }>(`/v1/customers/${customerId}/secure-files`, form)
}

export function createCustomerSecureNote(customerId: string, title: string, body: string, description?: string) {
  return apiRequest<{ data: CustomerSecureFile }>(
    `/v1/customers/${customerId}/secure-files`,
    { method: 'POST', body: { title, body, description } },
  )
}

export function updateCustomerSecureFile(
  customerId: string,
  fileId: string,
  body: { title?: string; description?: string | null; body?: string },
) {
  return apiRequest<{ data: CustomerSecureFile }>(
    `/v1/customers/${customerId}/secure-files/${fileId}`,
    { method: 'PATCH', body },
  )
}

export function deleteCustomerSecureFile(customerId: string, fileId: string) {
  return apiRequest<void>(`/v1/customers/${customerId}/secure-files/${fileId}`, { method: 'DELETE' })
}

export function listCustomerSecureFileAudit(customerId: string, fileId: string) {
  return apiRequest<{ data: SecureFileAuditRow[] }>(`/v1/customers/${customerId}/secure-files/${fileId}/audit`)
}

export async function fetchCustomerSecureFileBlob(customerId: string, fileId: string, download = false): Promise<Blob> {
  const response = await fetch(`${API_URL}/v1/customers/${customerId}/secure-files/${fileId}${download ? '/download' : ''}`, {
    headers: authHeaders(),
  })
  if (!response.ok) {
    throw new Error(response.status === 423 ? 'Secure files are locked.' : `Request failed with status ${response.status}`)
  }
  return response.blob()
}

async function authedFormRequest<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      if (typeof body.message === 'string') message = body.message
    } catch {
      // ignore non-json
    }
    throw new Error(message)
  }
  return response.json()
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const actingTenant = getActingTenant()
  if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
  return headers
}
