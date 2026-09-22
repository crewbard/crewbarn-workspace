import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listEstimates,
  getEstimate,
  createEstimate,
  updateEstimate,
  deleteEstimate,
  sendEstimate,
  approveEstimate,
  rejectEstimate,
  attachCoveredAsset,
  detachCoveredAsset,
  listLineItems,
  createLineItem,
  updateLineItem,
  deleteLineItem,
  supersedeEstimate,
  convertEstimate,
  reorderLineItems,
  type SupersedeEstimateInput,
  type ConvertEstimateInput,
  type ConvertedWorkOrder,
} from '@/lib/estimates'
import type {
  Estimate,
  EstimateInput,
  EstimateUpdateInput,
  EstimateListParams,
} from '@/types/estimate'
import type {
  EstimateLineItem,
  EstimateLineItemInput,
  EstimateLineItemUpdateInput,
} from '@/types/estimateLineItem'

// ---------- Query key factories ----------

export const estimateKeys = {
  all: ['estimates'] as const,
  lists: () => [...estimateKeys.all, 'list'] as const,
  list: (params: EstimateListParams) => [...estimateKeys.lists(), params] as const,
  details: () => [...estimateKeys.all, 'detail'] as const,
  detail: (id: string) => [...estimateKeys.details(), id] as const,
  lineItems: (estimateId: string) =>
    [...estimateKeys.detail(estimateId), 'line-items'] as const,
}

// ---------- Estimate queries ----------

export function useEstimates(params: EstimateListParams = {}) {
  return useQuery({
    queryKey: estimateKeys.list(params),
    queryFn: () => listEstimates(params),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useEstimate(id: string | undefined) {
  return useQuery({
    queryKey: estimateKeys.detail(id ?? ''),
    queryFn: () => getEstimate(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ---------- Estimate mutations ----------

export function useCreateEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EstimateInput) => createEstimate(input),
    onSuccess: (newEstimate) => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
      queryClient.setQueryData(estimateKeys.detail(newEstimate.id), newEstimate)
    },
  })
}

export function useUpdateEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EstimateUpdateInput }) =>
      updateEstimate(id, input),
    onSuccess: (updatedEstimate) => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
      queryClient.setQueryData(estimateKeys.detail(updatedEstimate.id), updatedEstimate)
    },
  })
}

export function useDeleteEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEstimate(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: estimateKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

// ---------- Lifecycle mutations ----------

/**
 * Each lifecycle action returns the full updated estimate, so we
 * setQueryData directly + invalidate the list. No separate refetch needed.
 */

export function useSendEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sendEstimate(id),
    onSuccess: (estimate) => {
      queryClient.setQueryData(estimateKeys.detail(estimate.id), estimate)
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

export function useMarkEstimateSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sendEstimate(id, { deliver: false }),
    onSuccess: (estimate) => {
      queryClient.setQueryData(estimateKeys.detail(estimate.id), estimate)
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

export function useApproveEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => approveEstimate(id),
    onSuccess: (estimate) => {
      queryClient.setQueryData(estimateKeys.detail(estimate.id), estimate)
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

export function useRejectEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rejectEstimate(id),
    onSuccess: (estimate) => {
      queryClient.setQueryData(estimateKeys.detail(estimate.id), estimate)
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

// ---------- Slice 7a-3: re-quote / convert mutations ----------

/**
 * Re-quote: creates a new draft estimate cloned from the original.
 * Original flips to status='superseded'. Returns the new estimate so
 * caller can navigate to it.
 */
export function useSupersedeEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input = {},
    }: {
      id: string
      input?: SupersedeEstimateInput
    }) => supersedeEstimate(id, input),
    onSuccess: (newEstimate, vars) => {
      // Original's status is now 'superseded' - invalidate its detail
      queryClient.invalidateQueries({ queryKey: estimateKeys.detail(vars.id) })
      // Prime the new estimate's detail cache
      queryClient.setQueryData(estimateKeys.detail(newEstimate.id), newEstimate)
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

/**
 * Convert: creates a WorkOrder from an approved estimate. Returns the
 * new WorkOrder (skinny) so caller can navigate to it.
 */
export function useConvertEstimate() {
  const queryClient = useQueryClient()
  return useMutation<ConvertedWorkOrder, Error, { id: string; input: ConvertEstimateInput }>({
    mutationFn: ({ id, input }) => convertEstimate(id, input),
    onSuccess: (_workOrder, vars) => {
      // Estimate now has converted_to_work_order_id set
      queryClient.invalidateQueries({ queryKey: estimateKeys.detail(vars.id) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
      // Work order list needs to refresh
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}

// ---------- Covered asset mutations ----------

export function useAttachCoveredAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ estimateId, assetId }: { estimateId: string; assetId: string }) =>
      attachCoveredAsset(estimateId, assetId),
    onSuccess: (estimate) => {
      queryClient.setQueryData(estimateKeys.detail(estimate.id), estimate)
    },
  })
}

export function useDetachCoveredAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ estimateId, assetId }: { estimateId: string; assetId: string }) =>
      detachCoveredAsset(estimateId, assetId),
    onSuccess: (estimate) => {
      queryClient.setQueryData(estimateKeys.detail(estimate.id), estimate)
    },
  })
}

// ---------- Line item queries (live mode) ----------

export function useEstimateLineItems(estimateId: string | undefined) {
  return useQuery({
    queryKey: estimateKeys.lineItems(estimateId ?? ''),
    queryFn: () => listLineItems(estimateId as string),
    enabled: !!estimateId,
    staleTime: 10_000,
  })
}

// ---------- Line item mutations ----------

/**
 * Each line item mutation invalidates the line items list AND the parent
 * estimate detail (server recalculates totals on every line write).
 */

export function useCreateEstimateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ estimateId, input }: { estimateId: string; input: EstimateLineItemInput }) =>
      createLineItem(estimateId, input),
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.lineItems(estimateId) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.detail(estimateId) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

export function useUpdateEstimateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      estimateId,
      lineItemId,
      input,
    }: {
      estimateId: string
      lineItemId: string
      input: EstimateLineItemUpdateInput
    }) => updateLineItem(estimateId, lineItemId, input),

    // Optimistic update so inputs don't flash back to old values mid-save.
    onMutate: async ({ estimateId, lineItemId, input }) => {
      const lineItemsKey = estimateKeys.lineItems(estimateId)
      await queryClient.cancelQueries({ queryKey: lineItemsKey })
      const previousLines = queryClient.getQueryData<EstimateLineItem[]>(lineItemsKey)
      if (previousLines) {
        queryClient.setQueryData<EstimateLineItem[]>(
          lineItemsKey,
          previousLines.map((line) =>
            line.id === lineItemId
              ? {
                  ...line,
                  ...('description' in input ? { description: input.description! } : {}),
                  ...('quantity' in input ? { quantity: input.quantity! } : {}),
                  ...('type' in input ? { type: input.type! } : {}),
                  ...('service_catalog_item_id' in input
                    ? { service_catalog_item_id: input.service_catalog_item_id ?? null }
                    : {}),
                  ...('tax_class_id' in input
                    ? { tax_class_id: input.tax_class_id ?? null }
                    : {}),
                  ...('asset_id' in input
                    ? { asset_id: input.asset_id ?? null }
                    : {}),
                  money: {
                    ...line.money,
                    ...('unit_price_cents' in input
                      ? { unit_price_cents: input.unit_price_cents! }
                      : {}),
                    // line_total / tax / total recomputed by server
                  },
                }
              : line
          )
        )
      }
      return { previousLines }
    },

    onError: (_err, { estimateId }, context) => {
      if (context?.previousLines) {
        queryClient.setQueryData(estimateKeys.lineItems(estimateId), context.previousLines)
      }
    },

    onSettled: (_data, _err, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.lineItems(estimateId) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.detail(estimateId) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

export function useDeleteEstimateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ estimateId, lineItemId }: { estimateId: string; lineItemId: string }) =>
      deleteLineItem(estimateId, lineItemId),
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.lineItems(estimateId) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.detail(estimateId) })
      queryClient.invalidateQueries({ queryKey: estimateKeys.lists() })
    },
  })
}

// ---------- Slice 7a-3: line item reorder ----------

/**
 * Drag-reorder line items. Optimistic update for snappy feedback;
 * rolls back if the server rejects.
 */
export function useReorderEstimateLineItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ estimateId, order }: { estimateId: string; order: string[] }) =>
      reorderLineItems(estimateId, order),

    onMutate: async ({ estimateId, order }) => {
      const lineItemsKey = estimateKeys.lineItems(estimateId)
      await queryClient.cancelQueries({ queryKey: lineItemsKey })
      const previousLines = queryClient.getQueryData<EstimateLineItem[]>(lineItemsKey)
      if (previousLines) {
        const byId = new Map(previousLines.map((l) => [l.id, l]))
        const reordered = order
          .map((id) => byId.get(id))
          .filter((l): l is EstimateLineItem => l !== undefined)
          .map((l, i) => ({ ...l, display_order: i + 1 }))
        queryClient.setQueryData<EstimateLineItem[]>(lineItemsKey, reordered)
      }
      return { previousLines }
    },

    onError: (_err, { estimateId }, context) => {
      if (context?.previousLines) {
        queryClient.setQueryData(estimateKeys.lineItems(estimateId), context.previousLines)
      }
    },

    onSettled: (_, __, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: estimateKeys.lineItems(estimateId) })
    },
  })
}

// ---------- Re-exports ----------

export type { Estimate, EstimateLineItem }