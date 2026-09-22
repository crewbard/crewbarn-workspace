import { API_URL, apiRequest, getStoredToken, getActingTenant } from '@/lib/api'

export interface ImportFieldDef {
  field: string
  label: string
  required: boolean
  hint: string | null
}
export interface ImportSchema {
  label: string
  fields: ImportFieldDef[]
}

export interface ImportUploadResult {
  batch_id: string
  entity: string
  filename: string
  headers: string[]
  row_count: number
  sample_rows: Array<Record<string, string>>
  suggested_mapping: Record<string, string> // field -> source header
  ai_used: boolean
  notes: string | null
}

export interface ImportCommitResult {
  batch_id: string
  created: number
  updated: number
  skipped: number
  error_count: number
  errors: Array<{ row: number; message: string }>
}

export function getImportSchemas() {
  return apiRequest<{ data: Record<string, ImportSchema> }>('/v1/imports/schemas').then(
    (r) => r.data,
  )
}

/** Multipart upload — hand-rolled fetch (apiRequest is JSON-only). */
export async function uploadImport(entity: string, file: File): Promise<ImportUploadResult> {
  const fd = new FormData()
  fd.append('entity', entity)
  fd.append('file', file)

  const token = getStoredToken()
  const actingTenant = getActingTenant()

  const resp = await fetch(`${API_URL}/v1/imports/upload`, {
    method: 'POST',
    body: fd,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
    },
  })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(body?.message ?? `Upload failed (HTTP ${resp.status})`)
  }
  return body.data as ImportUploadResult
}

export function commitImport(
  batchId: string,
  mapping: Record<string, string>,
): Promise<ImportCommitResult> {
  return apiRequest<{ data: ImportCommitResult }>(`/v1/imports/${batchId}/commit`, {
    method: 'POST',
    body: { mapping },
  }).then((r) => r.data)
}
