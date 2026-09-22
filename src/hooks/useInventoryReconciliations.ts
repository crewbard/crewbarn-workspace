import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listInventoryReconciliations,
  resolveInventoryReconciliation,
} from '@/lib/inventoryReconciliations'
import type {
  InventoryReconciliationListParams,
  ReconciliationResolveInput,
} from '@/types/inventoryReconciliation'

export const inventoryReconciliationKeys = {
  all: ['inventory-reconciliations'] as const,
  lists: () => [...inventoryReconciliationKeys.all, 'list'] as const,
  list: (p: InventoryReconciliationListParams) =>
    [...inventoryReconciliationKeys.lists(), p] as const,
}

export function useInventoryReconciliations(params: InventoryReconciliationListParams = {}) {
  return useQuery({
    queryKey: inventoryReconciliationKeys.list(params),
    queryFn: () => listInventoryReconciliations(params),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

export function useResolveInventoryReconciliation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReconciliationResolveInput }) =>
      resolveInventoryReconciliation(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryReconciliationKeys.lists() })
    },
  })
}
