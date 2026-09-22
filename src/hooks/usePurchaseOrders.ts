import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPurchaseOrder,
  createPurchaseOrderItem,
  deletePurchaseOrder,
  deletePurchaseOrderItem,
  getPurchaseOrder,
  listPurchaseOrderItems,
  listPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderItem,
} from '@/lib/purchaseOrders'
import type {
  PurchaseOrderInput,
  PurchaseOrderUpdateInput,
  PurchaseOrderListParams,
  PurchaseOrderItemInput,
  PurchaseOrderItemUpdateInput,
  PurchaseOrderReceiveInput,
} from '@/types/purchaseOrder'

export const purchaseOrderKeys = {
  all: ['purchase-orders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (p: PurchaseOrderListParams) => [...purchaseOrderKeys.lists(), p] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
  items: (id: string) => [...purchaseOrderKeys.detail(id), 'items'] as const,
}

export function usePurchaseOrders(params: PurchaseOrderListParams = {}) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(params),
    queryFn: () => listPurchaseOrders(params),
    staleTime: 30_000,
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id ?? ''),
    queryFn: () => getPurchaseOrder(id!),
    enabled: !!id,
  })
}

export function usePurchaseOrderItems(id: string | undefined) {
  return useQuery({
    queryKey: purchaseOrderKeys.items(id ?? ''),
    queryFn: () => listPurchaseOrderItems(id!),
    enabled: !!id,
  })
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseOrderInput) => createPurchaseOrder(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() })
    },
  })
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PurchaseOrderUpdateInput }) =>
      updatePurchaseOrder(id, input),
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() })
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(po.id) })
    },
  })
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePurchaseOrder(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() })
      qc.removeQueries({ queryKey: purchaseOrderKeys.detail(id) })
    },
  })
}

export function useCreatePurchaseOrderItem(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseOrderItemInput) =>
      createPurchaseOrderItem(poId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId) })
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.items(poId) })
    },
  })
}

export function useUpdatePurchaseOrderItem(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: PurchaseOrderItemUpdateInput }) =>
      updatePurchaseOrderItem(poId, itemId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId) })
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.items(poId) })
    },
  })
}

export function useDeletePurchaseOrderItem(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => deletePurchaseOrderItem(poId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId) })
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.items(poId) })
    },
  })
}

export function useReceivePurchaseOrder(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseOrderReceiveInput) =>
      receivePurchaseOrder(poId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId) })
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() })
      // Inventory levels changed too; bust low-stock + stock list caches.
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      qc.invalidateQueries({ queryKey: ['inventory-stock-levels'] })
      qc.invalidateQueries({ queryKey: ['inventory-units'] })
    },
  })
}
