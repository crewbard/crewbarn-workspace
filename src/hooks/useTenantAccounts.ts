import { useQuery } from '@tanstack/react-query'
import { listTenantAccounts } from '@/lib/tenantAccounts'

export const tenantAccountKeys = {
  all: ['tenant-accounts'] as const,
  // perPage is part of the key — otherwise the same search with different
  // page sizes collides in the cache and returns the wrong slice
  // (redundancy audit phase 16).
  list: (q: string, perPage: number) => ['tenant-accounts', 'list', q, perPage] as const,
}

export function useTenantAccounts(q: string = '', perPage: number = 50) {
  return useQuery({
    queryKey: tenantAccountKeys.list(q, perPage),
    queryFn: () => listTenantAccounts({ q, per_page: perPage }),
    staleTime: 60_000,
  })
}
