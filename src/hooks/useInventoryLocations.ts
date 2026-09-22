import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listInventoryLocations,
  getInventoryLocation,
  createInventoryLocation,
  updateInventoryLocation,
  deleteInventoryLocation,
} from '@/lib/inventoryLocations'
import type {
  InventoryLocationInput,
  InventoryLocationUpdateInput,
  InventoryLocationListParams,
} from '@/types/inventoryLocation'

// ---------- Query key factory ----------

export const inventoryLocationKeys = {
  all: ['inventory-locations'] as const,
  lists: () => [...inventoryLocationKeys.all, 'list'] as const,
  list: (params: InventoryLocationListParams) => [...inventoryLocationKeys.lists(), params] as const,
  details: () => [...inventoryLocationKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryLocationKeys.details(), id] as const,
}

// ---------- Queries ----------

export function useInventoryLocations(params: InventoryLocationListParams = {}) {
  return useQuery({
    queryKey: inventoryLocationKeys.list(params),
    queryFn: () => listInventoryLocations(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useInventoryLocation(id: string | undefined) {
  return useQuery({
    queryKey: inventoryLocationKeys.detail(id ?? ''),
    queryFn: () => getInventoryLocation(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

// ---------- Mutations ----------

export function useCreateInventoryLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InventoryLocationInput) => createInventoryLocation(input),
    onSuccess: (newLocation) => {
      queryClient.invalidateQueries({ queryKey: inventoryLocationKeys.lists() })
      queryClient.setQueryData(inventoryLocationKeys.detail(newLocation.id), newLocation)
    },
  })
}

export function useUpdateInventoryLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: InventoryLocationUpdateInput }) =>
      updateInventoryLocation(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: inventoryLocationKeys.lists() })
      queryClient.setQueryData(inventoryLocationKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteInventoryLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInventoryLocation(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: inventoryLocationKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: inventoryLocationKeys.lists() })
    },
  })
}
