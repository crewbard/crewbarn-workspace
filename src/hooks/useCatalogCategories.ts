import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listCatalogCategories,
  getCatalogCategory,
  createCatalogCategory,
  updateCatalogCategory,
  deleteCatalogCategory,
} from '@/lib/catalogCategories'
import type {
  CatalogCategoryInput,
  CatalogCategoryUpdateInput,
  CatalogCategoryListParams,
} from '@/types/catalogCategory'

// ---------- Query key factory ----------

export const catalogCategoryKeys = {
  all: ['catalog-categories'] as const,
  lists: () => [...catalogCategoryKeys.all, 'list'] as const,
  list: (params: CatalogCategoryListParams) => [...catalogCategoryKeys.lists(), params] as const,
  details: () => [...catalogCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...catalogCategoryKeys.details(), id] as const,
}

// ---------- Queries ----------

export function useCatalogCategories(params: CatalogCategoryListParams = {}) {
  return useQuery({
    queryKey: catalogCategoryKeys.list(params),
    queryFn: () => listCatalogCategories(params),
    staleTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useCatalogCategory(id: string | undefined) {
  return useQuery({
    queryKey: catalogCategoryKeys.detail(id ?? ''),
    queryFn: () => getCatalogCategory(id as string),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

// ---------- Mutations ----------

export function useCreateCatalogCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogCategoryInput) => createCatalogCategory(input),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: catalogCategoryKeys.lists() })
      queryClient.setQueryData(catalogCategoryKeys.detail(newCategory.id), newCategory)
    },
  })
}

export function useUpdateCatalogCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CatalogCategoryUpdateInput }) =>
      updateCatalogCategory(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: catalogCategoryKeys.lists() })
      queryClient.setQueryData(catalogCategoryKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteCatalogCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCatalogCategory(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: catalogCategoryKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: catalogCategoryKeys.lists() })
    },
  })
}
