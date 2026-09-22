import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listInventoryUnits,
  updateInventoryUnit,
  type UpdateInventoryUnitInput,
} from '@/lib/inventoryUnits'
import type { InventoryUnitListParams } from '@/types/inventoryUnit'

export const inventoryUnitKeys = {
  all: ['inventory-units'] as const,
  lists: () => [...inventoryUnitKeys.all, 'list'] as const,
  list: (p: InventoryUnitListParams) => [...inventoryUnitKeys.lists(), p] as const,
}

export function useInventoryUnits(params: InventoryUnitListParams | undefined) {
  return useQuery({
    queryKey: inventoryUnitKeys.list(params ?? {}),
    queryFn: () => listInventoryUnits(params ?? {}),
    enabled: !!params,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

export function useUpdateInventoryUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInventoryUnitInput }) =>
      updateInventoryUnit(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryUnitKeys.lists() })
      // Stock_levels qty for SN items is computed from active units, so the
      // stock-levels list also needs to refresh when a unit's status flips.
      qc.invalidateQueries({ queryKey: ['inventory-stock-levels'] })
    },
  })
}
