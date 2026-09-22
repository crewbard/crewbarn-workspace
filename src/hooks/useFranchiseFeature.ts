import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Whether the CURRENT tenant has the franchise feature — read from the server
 * so it respects acting-as (a platform admin's own account has no tenant, so
 * account.tenant can't tell us; this endpoint reflects the acted-as tenant).
 *
 * Drives the Franchise Dashboard nav tab + the franchise-only Tool Shed entry.
 * Degrades to { enabled: false, isFranchise: false } on any failure.
 */
interface FeatureResponse {
  data: { enabled: boolean; is_franchise: boolean }
}

export function useFranchiseFeature(): { enabled: boolean; isFranchise: boolean } {
  const { data } = useQuery({
    queryKey: ['franchise-feature'],
    queryFn: () =>
      apiRequest<FeatureResponse>('/v1/franchises/feature').catch(
        () => ({ data: { enabled: false, is_franchise: false } }) as FeatureResponse,
      ),
    staleTime: 5 * 60_000,
  })

  return {
    enabled: !!data?.data.enabled,
    isFranchise: !!data?.data.is_franchise,
  }
}
