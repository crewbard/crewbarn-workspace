import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { ReceivableOrder } from '@/lib/binReceive'

export const receivableKey = ['purchase-orders', 'receivable'] as const

/**
 * Orders with something still to come in (GET /v1/purchase-orders/receivable).
 * Fetched once for the Bins screen so the menu can say up front whether
 * "Add from a purchase order" has anything to offer.
 */
export function useReceivablePurchaseOrders(enabled = true, catalogItemId?: string) {
  return useQuery({
    // One product's orders sit under the same key, so receiving refreshes both.
    queryKey: catalogItemId ? [...receivableKey, catalogItemId] : receivableKey,
    queryFn: () => apiRequest<{ data: ReceivableOrder[]; truncated: boolean }>(
      catalogItemId ? `/v1/purchase-orders/receivable?catalog_item_id=${encodeURIComponent(catalogItemId)}` : '/v1/purchase-orders/receivable',
    ),
    enabled,
    staleTime: 30_000,
  })
}
