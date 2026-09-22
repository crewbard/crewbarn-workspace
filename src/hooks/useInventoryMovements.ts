import { useQuery } from '@tanstack/react-query'
import { listInventoryMovements } from '@/lib/inventoryMovements'
import type { InventoryMovementListParams } from '@/types/inventoryMovement'

export const inventoryMovementKeys = {
  all: ['inventory-movements'] as const,
  lists: () => [...inventoryMovementKeys.all, 'list'] as const,
  list: (p: InventoryMovementListParams) =>
    [...inventoryMovementKeys.lists(), p] as const,
}

export function useInventoryMovements(params: InventoryMovementListParams = {}) {
  return useQuery({
    queryKey: inventoryMovementKeys.list(params),
    queryFn: () => listInventoryMovements(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
