import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInventorySettings,
  updateInventorySettings,
} from '@/lib/tenantSettings'
import type {
  InventorySettings,
  InventorySettingsUpdate,
} from '@/types/tenantSettings'

const QUERY_KEY = ['tenant-settings', 'inventory'] as const

/**
 * Read hook — caches inventory settings for 30s (queryClient default).
 */
export function useInventorySettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getInventorySettings,
  })
}

/**
 * Mutation with optimistic update + rollback on error. Server response
 * is written into the cache directly on success — no extra refetch.
 *
 * Pattern matches useUpdateLineItem from Day 7 (work order line items).
 */
export function useUpdateInventorySettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (update: InventorySettingsUpdate) =>
      updateInventorySettings(update),

    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<InventorySettings>(QUERY_KEY)
      if (previous) {
        queryClient.setQueryData<InventorySettings>(QUERY_KEY, {
          ...previous,
          ...update,
        })
      }
      return { previous }
    },

    onError: (_err, _update, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
    },

    onSuccess: (fresh) => {
      queryClient.setQueryData<InventorySettings>(QUERY_KEY, fresh)
    },
  })
}
