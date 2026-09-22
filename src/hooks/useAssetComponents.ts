import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAssetComponents,
  installAssetComponent,
  uninstallAssetComponent,
} from "@/lib/assetComponents"
import type { InstallAssetComponentInput } from "@/types/assetComponent"

export const assetComponentKeys = {
  all: ["asset-components"] as const,
  lists: () => [...assetComponentKeys.all, "list"] as const,
  list: (assetId: string) => [...assetComponentKeys.lists(), assetId] as const,
}

export function useAssetComponents(assetId: string | undefined) {
  return useQuery({
    queryKey: assetComponentKeys.list(assetId ?? ""),
    queryFn: () => listAssetComponents(assetId as string),
    enabled: !!assetId,
    staleTime: 30_000,
  })
}

export function useInstallAssetComponent(assetId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InstallAssetComponentInput) => installAssetComponent(assetId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetComponentKeys.list(assetId) })
    },
  })
}

export function useUninstallAssetComponent(assetId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId }: { unitId: string }) => uninstallAssetComponent(assetId, unitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetComponentKeys.list(assetId) })
    },
  })
}