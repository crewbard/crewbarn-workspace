import { useQuery } from '@tanstack/react-query'
import { listLowStock } from '@/lib/lowStock'

export const lowStockKeys = {
  all: ['low-stock'] as const,
  list: () => [...lowStockKeys.all, 'list'] as const,
}

export function useLowStock(enabled = true) {
  return useQuery({
    queryKey: lowStockKeys.list(),
    queryFn: () => listLowStock(),
    enabled,
    staleTime: 30_000,
  })
}
