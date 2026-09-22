import { apiRequest } from '@/lib/api'
import type {
  Vendor,
  VendorInput,
  VendorUpdateInput,
  VendorListParams,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/vendor'

function buildQuery<T extends object>(params: T): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean') usp.set(k, v ? '1' : '0')
    else usp.set(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export async function listVendors(
  params: VendorListParams = {}
): Promise<PaginatedResponse<Vendor>> {
  return apiRequest<PaginatedResponse<Vendor>>(`/v1/vendors${buildQuery(params)}`)
}

export async function getVendor(id: string): Promise<Vendor> {
  const res = await apiRequest<ResourceResponse<Vendor>>(`/v1/vendors/${id}`)
  return res.data
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  const res = await apiRequest<ResourceResponse<Vendor>>('/v1/vendors', {
    method: 'POST',
    body: input,
  })
  return res.data
}

export async function updateVendor(
  id: string,
  input: VendorUpdateInput
): Promise<Vendor> {
  const res = await apiRequest<ResourceResponse<Vendor>>(`/v1/vendors/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return res.data
}

export async function deleteVendor(id: string): Promise<void> {
  await apiRequest<void>(`/v1/vendors/${id}`, { method: 'DELETE' })
}
