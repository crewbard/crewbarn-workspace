import { useQuery } from '@tanstack/react-query'
import { getAssetHistory } from '@/lib/assetHistory'

export const assetHistoryKeys = {
  all: ['asset-history'] as const,
  detail: (assetId: string) => [...assetHistoryKeys.all, assetId] as const,
}

/**
 * useAssetHistory — fetches the unified history timeline for one asset.
 * Slice 7c. Disabled when assetId is falsy.
 */
export function useAssetHistory(assetId: string | undefined) {
  return useQuery({
    queryKey: assetHistoryKeys.detail(assetId ?? ''),
    queryFn: () => getAssetHistory(assetId!),
    enabled: !!assetId,
    staleTime: 30_000,
  })
}
