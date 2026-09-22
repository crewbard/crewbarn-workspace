/**
 * React Query hooks for asset groups (Slice 8).
 *
 * Backend: routes/api.php /v1/asset-groups CRUD
 * Companion to: lib/assetGroups.ts
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { assetKeys } from "@/hooks/useAssets"
import {
  listAssetGroups,
  getAssetGroupTree,
  getAssetGroup,
  createAssetGroup,
  updateAssetGroup,
  deleteAssetGroup,
  previewAssetTreeBuilder,
  createAssetTreeBuilder,
} from "@/lib/assetGroups"
import type {
  AssetGroupInput,
  AssetGroupUpdateInput,
  AssetGroupListParams,
  AssetTreeBuilderPayload,
} from "@/types/assetGroup"

export const assetGroupKeys = {
  all: ["asset-groups"] as const,
  lists: () => [...assetGroupKeys.all, "list"] as const,
  list: (params: AssetGroupListParams) =>
    [...assetGroupKeys.lists(), params] as const,
  trees: () => [...assetGroupKeys.all, "tree"] as const,
  tree: (locationId: string) =>
    [...assetGroupKeys.trees(), locationId] as const,
  details: () => [...assetGroupKeys.all, "detail"] as const,
  detail: (id: string) => [...assetGroupKeys.details(), id] as const,
}

export function useAssetGroups(params: AssetGroupListParams = {}) {
  return useQuery({
    queryKey: assetGroupKeys.list(params),
    queryFn: () => listAssetGroups(params),
    // If filtering by location, only enable when the id is non-empty
    enabled:
      params.customer_service_location_id === undefined ||
      params.customer_service_location_id.length > 0,
  })
}

export function useAssetGroupTree(locationId: string | undefined) {
  return useQuery({
    queryKey: assetGroupKeys.tree(locationId ?? ""),
    queryFn: () => getAssetGroupTree(locationId!),
    enabled: !!locationId,
  })
}

export function useAssetGroup(id: string | undefined) {
  return useQuery({
    queryKey: assetGroupKeys.detail(id ?? ""),
    queryFn: () => getAssetGroup(id!),
    enabled: !!id,
  })
}

export function useCreateAssetGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AssetGroupInput) => createAssetGroup(input),
    onSuccess: (group) => {
      qc.invalidateQueries({ queryKey: assetGroupKeys.lists() })
      qc.invalidateQueries({
        queryKey: assetGroupKeys.tree(group.customer_service_location_id),
      })
    },
  })
}

export function useUpdateAssetGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: AssetGroupUpdateInput
    }) => updateAssetGroup(id, input),
    onSuccess: (group) => {
      qc.invalidateQueries({ queryKey: assetGroupKeys.lists() })
      qc.invalidateQueries({
        queryKey: assetGroupKeys.tree(group.customer_service_location_id),
      })
      qc.setQueryData(assetGroupKeys.detail(group.id), group)
    },
  })
}

export function useDeleteAssetGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAssetGroup(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: assetGroupKeys.lists() })
      qc.invalidateQueries({ queryKey: assetGroupKeys.trees() })
      qc.removeQueries({ queryKey: assetGroupKeys.detail(id) })
    },
  })
}

export function usePreviewAssetTreeBuilder() {
  return useMutation({
    mutationFn: (input: AssetTreeBuilderPayload) => previewAssetTreeBuilder(input),
  })
}

export function useCreateAssetTreeBuilder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AssetTreeBuilderPayload) => createAssetTreeBuilder(input),
    onSuccess: (_response, input) => {
      qc.invalidateQueries({ queryKey: assetGroupKeys.lists() })
      qc.invalidateQueries({ queryKey: assetKeys.lists() })
      qc.invalidateQueries({
        queryKey: assetGroupKeys.tree(input.customer_service_location_id),
      })
    },
  })
}
