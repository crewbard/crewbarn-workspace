import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listAssetPhotos, uploadAssetPhoto } from "@/lib/assetPhotos"

export const assetPhotoKeys = {
  all: ["asset-photos"] as const,
  lists: () => [...assetPhotoKeys.all, "list"] as const,
  list: (assetId: string) => [...assetPhotoKeys.lists(), assetId] as const,
}

export function useAssetPhotos(assetId: string | undefined) {
  return useQuery({
    queryKey: assetPhotoKeys.list(assetId ?? ""),
    queryFn: () => listAssetPhotos(assetId as string),
    enabled: !!assetId,
    staleTime: 30_000,
  })
}

export function useUploadAssetPhoto(assetId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) =>
      uploadAssetPhoto(assetId, file, { caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetPhotoKeys.list(assetId) })
    },
  })
}
