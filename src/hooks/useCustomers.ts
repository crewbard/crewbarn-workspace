import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  mergeCustomer,
} from '@/lib/customers'
import type {
  Customer,
  CustomerInput,
  CustomerListParams,
} from '@/types/customer'

/**
 * Query key factory — keeps all customer-related cache keys consistent.
 * Hierarchical structure means we can invalidate broadly or precisely:
 *   - invalidate ['customers'] → clears EVERYTHING customer-related
 *   - invalidate ['customers', 'list'] → clears all list queries
 *   - invalidate ['customers', 'list', { q: 'foo' }] → clears one specific list
 *   - invalidate ['customers', 'detail', id] → clears one specific customer
 */
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

/**
 * useCustomers — paginated list query.
 *
 * Returns the full paginated response (data + meta + links) so the
 * page can render pagination controls and totals.
 *
 * staleTime 30s means rapidly clicking around won't re-fetch.
 * placeholderData keeps showing previous results while a new query
 * loads (smooth pagination, no flicker).
 */
export function useCustomers(params: CustomerListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => listCustomers(params),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  })
}

/**
 * useCustomer — single customer detail query.
 */
export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: () => getCustomer(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

/**
 * useCreateCustomer — mutation for creating a new customer.
 *
 * On success: invalidates all list queries so the new customer
 * appears in the list immediately.
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      // Pre-populate the detail cache for the new customer
      queryClient.setQueryData(customerKeys.detail(newCustomer.id), newCustomer)
    },
  })
}

/**
 * useUpdateCustomer — mutation for partial customer update.
 *
 * On success: invalidates list queries and updates the detail cache
 * with the fresh data returned from the API.
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CustomerInput> }) =>
      updateCustomer(id, input),
    onSuccess: (updatedCustomer) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.setQueryData(customerKeys.detail(updatedCustomer.id), updatedCustomer)
    },
  })
}

/**
 * useDeleteCustomer — mutation for soft-deleting a customer.
 *
 * On success: removes from detail cache and invalidates lists.
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: customerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}
/**
 * useMergeCustomer — move a duplicate customer into the survivor account.
 */
export function useMergeCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ survivorCustomerId, mergeCustomerId, reason }: { survivorCustomerId: string; mergeCustomerId: string; reason?: string }) =>
      mergeCustomer(survivorCustomerId, mergeCustomerId, reason),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.setQueryData(customerKeys.detail(variables.survivorCustomerId), response.data)
      queryClient.removeQueries({ queryKey: customerKeys.detail(variables.mergeCustomerId) })
    },
  })
}

/**
 * Re-export the Customer type so consumers don't need to import from /types
 * for the common case of "I have a Customer from a hook."
 */
export type { Customer }
