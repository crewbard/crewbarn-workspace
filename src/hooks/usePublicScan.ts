import { useQuery } from '@tanstack/react-query'
import { getPublicScan, PublicScanNotFoundError } from '@/lib/publicScan'

// React Query hook for the public scan endpoint.
// Disables retry on 404 ? the asset_code either resolves or it doesn't.
// Other errors get a single retry (matches the app-wide default).
export function usePublicScan(code: string | undefined, tenantId?: string) {
  return useQuery({
    queryKey: ['public-scan', tenantId ?? null, code],
    queryFn: () => getPublicScan(code!, tenantId),
    enabled: !!code,
    retry: (failureCount, error) => {
      if (error instanceof PublicScanNotFoundError) return false
      return failureCount < 1
    },
    staleTime: 60_000,
  })
}
