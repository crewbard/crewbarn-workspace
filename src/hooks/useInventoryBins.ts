import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyInventoryBinSetup,
  createInventoryBin,
  deleteInventoryBin,
  getBinContents,
  getBinStockRollup,
  getInventoryBin,
  listAllInventoryBins,
  listInventoryBins,
  updateInventoryBin,
} from '@/lib/inventoryBins'
import type {
  InventoryBinInput,
  InventoryBinUpdateInput,
  InventoryBinListParams,
  InventoryBinSetupInput,
} from '@/types/inventoryBin'

export const inventoryBinKeys = {
  all: ['inventory-bins'] as const,
  lists: () => [...inventoryBinKeys.all, 'list'] as const,
  list: (p: InventoryBinListParams) => [...inventoryBinKeys.lists(), p] as const,
  details: () => [...inventoryBinKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryBinKeys.details(), id] as const,
  contents: (id: string) => [...inventoryBinKeys.detail(id), 'contents'] as const,
}

export function useBinContents(id: string | undefined) {
  return useQuery({
    queryKey: inventoryBinKeys.contents(id ?? ''),
    queryFn: () => getBinContents(id!),
    enabled: !!id,
    staleTime: 15_000,
  })
}

/**
 * Every matching bin, not just the first page. Use this anywhere the whole
 * TREE has to be drawn — a partial page renders as missing branches, which
 * reads as data loss rather than as pagination.
 */
export function useAllInventoryBins(params: InventoryBinListParams = {}) {
  return useQuery({
    queryKey: [...inventoryBinKeys.list(params), 'all'] as const,
    queryFn: () => listAllInventoryBins(params),
    staleTime: 60_000,
  })
}

/** What is in each bin, for the counts shown on the tree. */
export function useBinStockRollup(locationId?: string) {
  return useQuery({
    queryKey: [...inventoryBinKeys.all, 'stock-rollup', locationId ?? 'all'] as const,
    queryFn: () => getBinStockRollup(locationId),
    staleTime: 30_000,
  })
}

export function useInventoryBins(params: InventoryBinListParams = {}) {
  return useQuery({
    queryKey: inventoryBinKeys.list(params),
    queryFn: () => listInventoryBins(params),
    staleTime: 60_000,
  })
}

export function useInventoryBin(id: string | undefined) {
  return useQuery({
    queryKey: inventoryBinKeys.detail(id ?? ''),
    queryFn: () => getInventoryBin(id!),
    enabled: !!id,
  })
}

export function useCreateInventoryBin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InventoryBinInput) => createInventoryBin(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryBinKeys.lists() })
    },
  })
}

export function useUpdateInventoryBin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: InventoryBinUpdateInput }) =>
      updateInventoryBin(id, input),
    onSuccess: (bin) => {
      qc.invalidateQueries({ queryKey: inventoryBinKeys.lists() })
      qc.setQueryData(inventoryBinKeys.detail(bin.id), bin)
    },
  })
}

export function useDeleteInventoryBin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) =>
      deleteInventoryBin(id, cascade),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: inventoryBinKeys.lists() })
      qc.removeQueries({ queryKey: inventoryBinKeys.detail(id) })
    },
  })
}
export function useApplyInventoryBinSetup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InventoryBinSetupInput) => applyInventoryBinSetup(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryBinKeys.lists() })
    },
  })
}
