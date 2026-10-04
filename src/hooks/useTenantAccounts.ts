import { useQuery } from '@tanstack/react-query'
import { listTenantAccounts } from '@/lib/tenantAccounts'

export const tenantAccountKeys = {
  all: ['tenant-accounts'] as const,
  // perPage is part of the key — otherwise the same search with different
  // page sizes collides in the cache and returns the wrong slice
  // (redundancy audit phase 16).
  list: (q: string, perPage: number) => ['tenant-accounts', 'list', q, perPage] as const,
}

export function useTenantAccounts(q: string = '', perPage: number = 50, techOnly = false) {
  return useQuery({
    queryKey: [...tenantAccountKeys.list(q, perPage), techOnly],
    queryFn: () => listTenantAccounts({ q, per_page: perPage, tech_only: techOnly }),
    staleTime: 60_000,
  })
}
