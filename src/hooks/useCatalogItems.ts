import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listCatalogItems,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  uploadCatalogItemImage,
  deleteCatalogItemImage,
} from '@/lib/catalogItems'
import type {
  CatalogItemInput,
  CatalogItemUpdateInput,
  CatalogItemListParams,
} from '@/types/catalogItem'

// ---------- Query key factory ----------

export const catalogItemKeys = {
  all: ['catalog-items'] as const,
  lists: () => [...catalogItemKeys.all, 'list'] as const,
  list: (params: CatalogItemListParams) => [...catalogItemKeys.lists(), params] as const,
  details: () => [...catalogItemKeys.all, 'detail'] as const,
  detail: (id: string) => [...catalogItemKeys.details(), id] as const,
}

// ---------- Queries ----------

/**
 * useCatalogItems - paginated list with FTS search.
 *
 * Shorter staleTime (1min) than tax classes / categories because items
 * change more frequently during catalog management work, and search
 * results need to feel responsive when the user is debouncing typing.
 */
export function useCatalogItems(params: CatalogItemListParams = {}) {
  return useQuery({
    queryKey: catalogItemKeys.list(params),
    queryFn: () => listCatalogItems(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useCatalogItem(id: string | undefined) {
  return useQuery({
    queryKey: catalogItemKeys.detail(id ?? ''),
    queryFn: () => getCatalogItem(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

// ---------- Mutations ----------

export function useCreateCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogItemInput) => createCatalogItem(input),
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: catalogItemKeys.lists() })
      queryClient.setQueryData(catalogItemKeys.detail(newItem.id), newItem)
    },
  })
}

export function useUpdateCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CatalogItemUpdateInput }) =>
      updateCatalogItem(id, input),
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({ queryKey: catalogItemKeys.lists() })
      queryClient.setQueryData(catalogItemKeys.detail(updatedItem.id), updatedItem)
    },
  })
}

export function useDeleteCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCatalogItem(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: catalogItemKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: catalogItemKeys.lists() })
    },
  })
}

export function useUploadCatalogItemImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadCatalogItemImage(id, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(catalogItemKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: catalogItemKeys.lists() })
    },
  })
}

export function useDeleteCatalogItemImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCatalogItemImage(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(catalogItemKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: catalogItemKeys.lists() })
    },
  })
}
