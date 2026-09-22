import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cleanupOrphanStockLevels,
  createStockLevel,
  deleteStockLevel,
  listStockLevels,
  updateStockLevel,
} from '@/lib/inventoryStockLevels'
import type {
  InventoryStockLevelInput,
  InventoryStockLevelUpdateInput,
  InventoryStockLevelListParams,
} from '@/types/inventoryStockLevel'

export const stockLevelKeys = {
  all: ['inventory-stock-levels'] as const,
  lists: () => [...stockLevelKeys.all, 'list'] as const,
  list: (p: InventoryStockLevelListParams) =>
    [...stockLevelKeys.lists(), p] as const,
}

export function useStockLevels(params: InventoryStockLevelListParams = {}) {
  return useQuery({
    queryKey: stockLevelKeys.list(params),
    queryFn: () => listStockLevels(params),
    staleTime: 30_000,
  })
}

export function useCreateStockLevel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InventoryStockLevelInput) => createStockLevel(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      // The bin tree's per-bin counts are derived from stock levels, so any
      // write here makes them stale. Without this the tree kept showing the
      // old figure until a manual reload.
      qc.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
    },
  })
}

export function useUpdateStockLevel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: InventoryStockLevelUpdateInput }) =>
      updateStockLevel(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      // The bin tree's per-bin counts are derived from stock levels, so any
      // write here makes them stale. Without this the tree kept showing the
      // old figure until a manual reload.
      qc.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
    },
  })
}

export function useDeleteStockLevel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStockLevel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      // The bin tree's per-bin counts are derived from stock levels, so any
      // write here makes them stale. Without this the tree kept showing the
      // old figure until a manual reload.
      qc.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
    },
  })
}

export function useCleanupOrphanStockLevels() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cleanupOrphanStockLevels,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      // Deleting orphan rows changes bin counts too.
      qc.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
    },
  })
}
