import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAssetTypes,
  getAssetType,
  createAssetType,
  updateAssetType,
  deleteAssetType,
} from "@/lib/assetTypes"
import type {
  AssetTypeInput,
  AssetTypeUpdateInput,
  AssetTypeListParams,
} from "@/types/assetType"

export const assetTypeKeys = {
  all: ["asset-types"] as const,
  lists: () => [...assetTypeKeys.all, "list"] as const,
  list: (params: AssetTypeListParams) => [...assetTypeKeys.lists(), params] as const,
  details: () => [...assetTypeKeys.all, "detail"] as const,
  detail: (id: string) => [...assetTypeKeys.details(), id] as const,
}

export function useAssetTypes(params: AssetTypeListParams = {}) {
  return useQuery({
    queryKey: assetTypeKeys.list(params),
    queryFn: () => listAssetTypes(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useAssetType(id: string | undefined) {
  return useQuery({
    queryKey: assetTypeKeys.detail(id ?? ""),
    queryFn: () => getAssetType(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreateAssetType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssetTypeInput) => createAssetType(input),
    onSuccess: (newType) => {
      queryClient.invalidateQueries({ queryKey: assetTypeKeys.lists() })
      queryClient.setQueryData(assetTypeKeys.detail(newType.id), newType)
    },
  })
}

export function useUpdateAssetType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssetTypeUpdateInput }) =>
      updateAssetType(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: assetTypeKeys.lists() })
      queryClient.setQueryData(assetTypeKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteAssetType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAssetType(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: assetTypeKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: assetTypeKeys.lists() })
    },
  })
}
