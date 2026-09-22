import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAssets,
  getAsset,
  getAssetByCode,
  createAsset,
  updateAsset,
  deleteAsset,
} from "@/lib/assets"
import type {
  AssetInput,
  AssetUpdateInput,
  AssetListParams,
} from "@/types/asset"

export const assetKeys = {
  all: ["assets"] as const,
  lists: () => [...assetKeys.all, "list"] as const,
  list: (params: AssetListParams) => [...assetKeys.lists(), params] as const,
  details: () => [...assetKeys.all, "detail"] as const,
  detail: (id: string) => [...assetKeys.details(), id] as const,
}

export function useAssets(
  params: AssetListParams = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: assetKeys.list(params),
    queryFn: () => listAssets(params),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useAsset(id: string | undefined) {
  return useQuery({
    queryKey: assetKeys.detail(id ?? ""),
    queryFn: () => getAsset(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssetInput) => createAsset(input),
    onSuccess: (newAsset) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() })
      queryClient.setQueryData(assetKeys.detail(newAsset.id), newAsset)
    },
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssetUpdateInput }) =>
      updateAsset(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() })
      queryClient.setQueryData(assetKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAsset(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: assetKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() })
    },
  })
}

/**
 * useLookupAssetByCode — imperative lookup of an asset by its scannable
 * asset_code. Used by Slice 2.5 find-by-scan flow on the assets list page.
 *
 * Returns a mutation object — call mutateAsync(code) to perform the lookup.
 * On success, hydrates the detail cache for that asset so subsequent reads
 * (e.g. opening the edit modal, navigating to the asset) are instant.
 *
 * Why useMutation (not useQuery): the lookup is triggered imperatively by
 * a user action (scanning), not declaratively on render. useQuery would
 * fire on mount; we want it to fire only when called.
 *
 * Errors propagate to the caller — typically a 404 ApiError when no asset
 * has that code, or network errors. Caller decides how to surface them.
 *
 * Backend: GET /v1/assets/by-code/{code}
 */
export function useLookupAssetByCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => getAssetByCode(code),
    onSuccess: (asset) => {
      // Hydrate the detail cache so the next render of this asset is instant
      queryClient.setQueryData(assetKeys.detail(asset.id), asset)
    },
  })
}
