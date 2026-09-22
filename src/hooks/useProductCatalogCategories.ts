import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProductCatalogCategories,
  getProductCatalogCategory,
  createProductCatalogCategory,
  updateProductCatalogCategory,
  deleteProductCatalogCategory,
} from '@/lib/productCatalogCategories'
import type {
  ProductCatalogCategoryInput,
  ProductCatalogCategoryUpdateInput,
  ProductCatalogCategoryListParams,
} from '@/types/productCatalogCategory'

// ---------- Query key factory ----------

export const productCatalogCategoryKeys = {
  all: ['product-catalog-categories'] as const,
  lists: () => [...productCatalogCategoryKeys.all, 'list'] as const,
  list: (params: ProductCatalogCategoryListParams) => [...productCatalogCategoryKeys.lists(), params] as const,
  details: () => [...productCatalogCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productCatalogCategoryKeys.details(), id] as const,
}

// ---------- Queries ----------

export function useProductCatalogCategories(params: ProductCatalogCategoryListParams = {}) {
  return useQuery({
    queryKey: productCatalogCategoryKeys.list(params),
    queryFn: () => listProductCatalogCategories(params),
    staleTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useProductCatalogCategory(id: string | undefined) {
  return useQuery({
    queryKey: productCatalogCategoryKeys.detail(id ?? ''),
    queryFn: () => getProductCatalogCategory(id as string),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

// ---------- Mutations ----------

export function useCreateProductCatalogCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProductCatalogCategoryInput) => createProductCatalogCategory(input),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: productCatalogCategoryKeys.lists() })
      queryClient.setQueryData(productCatalogCategoryKeys.detail(newCategory.id), newCategory)
    },
  })
}

export function useUpdateProductCatalogCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductCatalogCategoryUpdateInput }) =>
      updateProductCatalogCategory(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: productCatalogCategoryKeys.lists() })
      queryClient.setQueryData(productCatalogCategoryKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteProductCatalogCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProductCatalogCategory(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: productCatalogCategoryKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productCatalogCategoryKeys.lists() })
    },
  })
}
