import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type {
  CreateReturnInput,
  InventoryReturn,
} from '@/types/inventoryReturn'

export async function listReturns(params: { status?: string; type?: string } = {}): Promise<{
  data: InventoryReturn[]
}> {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.type) q.set('type', params.type)
  const qs = q.toString()
  return apiRequest<{ data: InventoryReturn[] }>(
    `/v1/inventory-returns${qs ? '?' + qs : ''}`,
  )
}

export async function getReturn(id: string): Promise<{ data: InventoryReturn }> {
  return apiRequest<{ data: InventoryReturn }>(`/v1/inventory-returns/${id}`)
}

export async function createReturn(input: CreateReturnInput): Promise<{ data: InventoryReturn }> {
  return apiRequest<{ data: InventoryReturn }>('/v1/inventory-returns', {
    method: 'POST',
    body: input,
  })
}

/**
 * Upload a supplier-provided return label (PDF or image). Uses multipart
 * form-data — apiRequest is JSON-only so we fetch directly here. Adds the
 * standard auth + tenant headers manually.
 */
export async function uploadReturnLabel(
  id: string,
  file: File,
): Promise<{ data: InventoryReturn }> {
  const form = new FormData()
  form.append('label', file)
  const token = getStoredToken()
  const tenant = getActingTenant()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenant) headers['X-Act-As-Tenant'] = tenant

  const res = await fetch(`${API_URL}/v1/inventory-returns/${id}/label`, {
    method: 'POST',
    headers,
    body: form,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Label upload failed (${res.status}): ${txt}`)
  }
  return res.json()
}
