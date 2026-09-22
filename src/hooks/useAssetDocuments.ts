import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listAssetDocuments, uploadAssetDocument } from "@/lib/assetDocuments"

export const assetDocumentKeys = {
  all: ["asset-documents"] as const,
  lists: () => [...assetDocumentKeys.all, "list"] as const,
  list: (assetId: string) => [...assetDocumentKeys.lists(), assetId] as const,
}

export function useAssetDocuments(assetId: string | undefined) {
  return useQuery({
    queryKey: assetDocumentKeys.list(assetId ?? ""),
    queryFn: () => listAssetDocuments(assetId as string),
    enabled: !!assetId,
    staleTime: 30_000,
  })
}

export function useUploadAssetDocument(assetId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) =>
      uploadAssetDocument(assetId, file, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetDocumentKeys.list(assetId) })
    },
  })
}