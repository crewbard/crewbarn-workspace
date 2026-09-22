import { apiRequest } from '@/lib/api'

export interface TenantAccount {
  id: string
  email: string | null
  name: string
  role: string | null
  /** Tech (app user) when true; non-login crew when false. */
  app_access: boolean
}

interface ListParams {
  q?: string
  per_page?: number
}

export async function listTenantAccounts(params: ListParams = {}): Promise<TenantAccount[]> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.per_page) qs.set('per_page', String(params.per_page))
  const res = await apiRequest<{ data: TenantAccount[] }>(
    `/v1/tenant-accounts${qs.toString() ? `?${qs.toString()}` : ''}`,
  )
  return res.data
}
