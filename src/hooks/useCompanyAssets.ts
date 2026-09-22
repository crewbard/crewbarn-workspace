import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCompanyAsset,
  deleteCompanyAsset,
  listCompanyAssets,
  updateCompanyAsset,
} from '@/lib/companyAssets'
import type {
  CompanyAssetInput,
  CompanyAssetListParams,
  CompanyAssetUpdateInput,
} from '@/types/companyAsset'

export const companyAssetKeys = {
  all: ['company-assets'] as const,
  lists: () => [...companyAssetKeys.all, 'list'] as const,
  list: (params: CompanyAssetListParams) => [...companyAssetKeys.lists(), params] as const,
}

export function useCompanyAssets(params: CompanyAssetListParams = {}) {
  return useQuery({
    queryKey: companyAssetKeys.list(params),
    queryFn: () => listCompanyAssets(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateCompanyAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CompanyAssetInput) => createCompanyAsset(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAssetKeys.lists() })
    },
  })
}

export function useUpdateCompanyAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompanyAssetUpdateInput }) =>
      updateCompanyAsset(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAssetKeys.lists() })
    },
  })
}

export function useDeleteCompanyAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCompanyAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyAssetKeys.lists() })
    },
  })
}
