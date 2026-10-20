import { API_URL, apiRequest } from '@/lib/api'
import { assertFileResponse } from '@/lib/fileResponse'
import { authHeaders, authedFormRequest } from '@/lib/companySecureFiles'

/**
 * Sub company documents (W-9, insurance, license): the sub uploads what the
 * companies it works for asked for; the hiring company sees where each one
 * stands and, unlocked like Secure Files, opens the ones it required.
 */
export type SubDocumentState = 'missing' | 'current' | 'expiring' | 'expired'

export interface SubDocumentRow {
  kind: string
  /** One row per place a document goes: the kind, or "insurance_holder:{company}". */
  key?: string
  /** The certificate naming one company as holder: that company. */
  for_hiring_tenant_id?: string | null
  label: string
  state: SubDocumentState
  required?: boolean
  document: {
    id: string
    filename: string | null
    mime_type: string | null
    size_bytes: number | null
    expires_on: string | null
    uploaded_at: string | null
  } | null
}

export interface MySubDocuments {
  documents: SubDocumentRow[]
  complete: boolean
  key_configured: boolean
  can_upload: boolean
}

export function getMySubDocuments() {
  return apiRequest<{ data: MySubDocuments }>('/v1/sub-documents')
}

/** "Finish later" on the documents screen: not asked again until the next sign-in. */
const LATER_KEY = 'crewbarn.subDocumentsLater'

export function finishSubDocumentsLater() {
  try {
    sessionStorage.setItem(LATER_KEY, '1')
  } catch {
    // Private mode: asked again on the next page load, nothing worse.
  }
}

export function subDocumentsPutOff(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    return false
  }
}

export function uploadSubDocument(kind: string, file: File, expiresOn: string | null, forHiringTenantId: string | null = null) {
  const form = new FormData()
  form.append('kind', kind)
  form.append('file', file)
  if (expiresOn) form.append('expires_on', expiresOn)
  if (forHiringTenantId) form.append('for_hiring_tenant_id', forHiringTenantId)

  return authedFormRequest<{ data: MySubDocuments & { recovery_key: string | null } }>('/v1/sub-documents', form)
}

export function getSubConnectionDocuments(connectionId: string) {
  return apiRequest<{ data: { documents: SubDocumentRow[]; complete: boolean } }>(
    `/v1/sub-connections/${encodeURIComponent(connectionId)}/documents`,
  )
}

/** A locked vault answers 423: the caller offers the emailed code. */
export class SubDocumentLockedError extends Error {}

export async function fetchSubDocumentBlob(connectionId: string, documentId: string, download = false): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/v1/sub-connections/${encodeURIComponent(connectionId)}/documents/${encodeURIComponent(documentId)}${download ? '?download=1' : ''}`,
    { headers: authHeaders() },
  )
  if (response.status === 423) throw new SubDocumentLockedError('Unlock secure files to open this.')
  if (!response.ok) throw new Error(response.status === 403 ? "You don't have permission to open company secure files." : `Request failed with status ${response.status}`)
  assertFileResponse(response)

  return response.blob()
}

export const SUB_DOCUMENT_STATE_LABEL: Record<SubDocumentState, string> = {
  missing: 'Not uploaded',
  current: 'Uploaded',
  expiring: 'Expires soon',
  expired: 'Expired',
}

export const SUB_DOCUMENT_STATE_CLASS: Record<SubDocumentState, string> = {
  missing: 'bg-slate-100 text-slate-700',
  current: 'bg-emerald-50 text-emerald-700',
  expiring: 'bg-amber-50 text-amber-800',
  expired: 'bg-red-50 text-red-700',
}
