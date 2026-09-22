import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  listLineItems,
  createLineItem,
  updateLineItem,
  deleteLineItem,
  reorderLineItems,
} from '@/lib/workOrders'
import type {
  WorkOrder,
  WorkOrderInput,
  WorkOrderUpdateInput,
  WorkOrderListParams,
} from '@/types/workOrder'
import type {
  WorkOrderLineItem,
  WorkOrderLineItemInput,
  WorkOrderLineItemUpdateInput,
} from '@/types/workOrderLineItem'

// ---------- Query key factories ----------

export const workOrderKeys = {
  all: ['work-orders'] as const,
  lists: () => [...workOrderKeys.all, 'list'] as const,
  list: (params: WorkOrderListParams) => [...workOrderKeys.lists(), params] as const,
  details: () => [...workOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...workOrderKeys.details(), id] as const,
  lineItems: (workOrderId: string) => [...workOrderKeys.detail(workOrderId), 'line-items'] as const,
}

// ---------- Work Order queries ----------

export function useWorkOrders(params: WorkOrderListParams = {}) {
  return useQuery({
    queryKey: workOrderKeys.list(params),
    queryFn: () => listWorkOrders(params),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
    // Live-ish: refetch every 60s when the tab is focused, and on
    // every window-focus / mount so status changes / new portal
    // submissions surface without a manual reload.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: workOrderKeys.detail(id ?? ''),
    queryFn: () => getWorkOrder(id as string),
    enabled: !!id,
    staleTime: 30_000,
    // Status / scope / AI map all change asynchronously — keep the
    // detail page hot so a tech action shows up without a refresh.
    // While a template PDF is waiting on AI field detection, poll
    // every 5s so the result shows up the moment the worker writes
    // it (vs. a 30s gap that feels broken). Drop back to 30s once
    // the map lands (success or error).
    refetchInterval: (query) => {
      const wo = query.state.data as
        | { template_pdf_url?: string | null; ai_field_map?: unknown }
        | undefined
      if (wo?.template_pdf_url && !wo.ai_field_map) return 5_000
      return 30_000
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

// ---------- Work Order mutations ----------

export function useCreateWorkOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkOrderInput) => createWorkOrder(input),
    onSuccess: (newWorkOrder) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() })
      queryClient.setQueryData(workOrderKeys.detail(newWorkOrder.id), newWorkOrder)
    },
  })
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkOrderUpdateInput }) =>
      updateWorkOrder(id, input),
    onSuccess: (updatedWorkOrder) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() })
      queryClient.setQueryData(workOrderKeys.detail(updatedWorkOrder.id), updatedWorkOrder)
    },
  })
}

export function useDeleteWorkOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkOrder(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: workOrderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() })
    },
  })
}

// ---------- Line Item queries (live mode) ----------

/**
 * useLineItems — fetch line items for a work order.
 *
 * Used by detail page (live mode). Buffer-mode (create form) keeps
 * lines in local React state until the parent WO is saved, then
 * POSTs them sequentially via createLineItem.
 */
export function useLineItems(workOrderId: string | undefined) {
  return useQuery({
    queryKey: workOrderKeys.lineItems(workOrderId ?? ''),
    queryFn: () => listLineItems(workOrderId as string),
    enabled: !!workOrderId,
    staleTime: 10_000,
  })
}

// ---------- Line Item mutations ----------

/**
 * Each line item mutation invalidates the line items list AND the parent
 * work order detail (since totals get recalculated by the controller).
 */

export function useCreateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workOrderId, input }: { workOrderId: string; input: WorkOrderLineItemInput }) =>
      createLineItem(workOrderId, input),
    onSuccess: (_, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lineItems(workOrderId) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(workOrderId) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() })
    },
  })
}

export function useUpdateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      workOrderId,
      lineItemId,
      input,
    }: {
      workOrderId: string
      lineItemId: string
      input: WorkOrderLineItemUpdateInput
    }) => updateLineItem(workOrderId, lineItemId, input),

    // Optimistic update: patch the cache instantly so the input doesn't flash
    // back to the old value while the server processes the request.
    onMutate: async ({ workOrderId, lineItemId, input }) => {
      const lineItemsKey = workOrderKeys.lineItems(workOrderId)
      // Cancel any in-flight refetch so it can't overwrite our optimistic value
      await queryClient.cancelQueries({ queryKey: lineItemsKey })
      // Snapshot for rollback
      const previousLines = queryClient.getQueryData<WorkOrderLineItem[]>(lineItemsKey)
      // Optimistically patch the line in the cache
      if (previousLines) {
        queryClient.setQueryData<WorkOrderLineItem[]>(
          lineItemsKey,
          previousLines.map((line) =>
            line.id === lineItemId
              ? {
                  ...line,
                  ...('description' in input ? { description: input.description! } : {}),
                  ...('quantity' in input ? { quantity: input.quantity! } : {}),
                  ...('unit_label' in input ? { unit_label: input.unit_label! } : {}),
                  ...('show_image_on_doc' in input ? { show_image_on_doc: input.show_image_on_doc! } : {}),
                  money: {
                    ...line.money,
                    ...('customer_cost_cents' in input ? { customer_cost_cents: input.customer_cost_cents! } : {}),
                    ...('owner_cost_cents' in input ? { owner_cost_cents: input.owner_cost_cents! } : {}),
                    ...('is_taxable' in input ? { is_taxable: input.is_taxable! } : {}),
                    ...('tax_rate_pct' in input ? { tax_rate_pct: input.tax_rate_pct! } : {}),
                  },
                }
              : line
          )
        )
      }
      return { previousLines }
    },

    // Rollback on error
    onError: (_err, { workOrderId }, context) => {
      if (context?.previousLines) {
        queryClient.setQueryData(workOrderKeys.lineItems(workOrderId), context.previousLines)
      }
    },

    // After success OR error: refetch to sync server-recalculated totals (tax, margin, totals)
    onSettled: (_data, _err, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lineItems(workOrderId) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(workOrderId) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() })
    },
  })
}

export function useDeleteLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workOrderId, lineItemId }: { workOrderId: string; lineItemId: string }) =>
      deleteLineItem(workOrderId, lineItemId),
    onSuccess: (_, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lineItems(workOrderId) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(workOrderId) })
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() })
    },
  })
}

export function useReorderLineItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workOrderId, order }: { workOrderId: string; order: string[] }) =>
      reorderLineItems(workOrderId, order),

    // Optimistic reorder so the UI feels instant
    onMutate: async ({ workOrderId, order }) => {
      const lineItemsKey = workOrderKeys.lineItems(workOrderId)
      await queryClient.cancelQueries({ queryKey: lineItemsKey })
      const previousLines = queryClient.getQueryData<WorkOrderLineItem[]>(lineItemsKey)
      if (previousLines) {
        // Rebuild the array in the new order
        const byId = new Map(previousLines.map((l) => [l.id, l]))
        const reordered = order
          .map((id) => byId.get(id))
          .filter((l): l is WorkOrderLineItem => !!l)
        queryClient.setQueryData<WorkOrderLineItem[]>(lineItemsKey, reordered)
      }
      return { previousLines }
    },

    onError: (_err, { workOrderId }, context) => {
      if (context?.previousLines) {
        queryClient.setQueryData(workOrderKeys.lineItems(workOrderId), context.previousLines)
      }
    },

    onSettled: (_data, _err, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lineItems(workOrderId) })
    },
  })
}

// ---------- Re-exports for consumer convenience ----------

export type { WorkOrder, WorkOrderLineItem }
