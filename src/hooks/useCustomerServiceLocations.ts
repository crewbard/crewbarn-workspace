import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomerServiceLocation,
  updateCustomerServiceLocation,
  deleteCustomerServiceLocation,
  getCustomerServiceLocation,
  type CustomerServiceLocationInput,
} from '@/lib/customerServiceLocations'
import { customerKeys } from '@/hooks/useCustomers'

export const customerServiceLocationKeys = {
  all: ['customer-service-locations'] as const,
  detail: (id: string) => ['customer-service-locations', 'detail', id] as const,
}

/**
 * useCustomerServiceLocation — fetch a single service location by id.
 * Query is disabled when id is falsy.
 */
export function useCustomerServiceLocation(id: string | undefined | null) {
  return useQuery({
    queryKey: customerServiceLocationKeys.detail(id ?? ''),
    queryFn: () => getCustomerServiceLocation(id!),
    enabled: !!id,
  })
}

/**
 * useCreateCustomerServiceLocation — POST a new service location for a customer.
 *
 * On success, invalidates the customer's detail cache so the next read of
 * that customer includes the new location in its service_locations array.
 *
 * Used by WorkOrderForm when the user types a new service location inline
 * during job creation.
 */
export function useCreateCustomerServiceLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      input,
    }: {
      customerId: string
      input: CustomerServiceLocationInput
    }) => createCustomerServiceLocation(customerId, input),
    onSuccess: (_newLocation, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

/**
 * useUpdateCustomerServiceLocation — PATCH an existing service location.
 */
export function useUpdateCustomerServiceLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      locationId,
      input,
    }: {
      customerId: string
      locationId: string
      input: CustomerServiceLocationInput
    }) => updateCustomerServiceLocation(customerId, locationId, input),
    onSuccess: (updated, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.setQueryData(customerServiceLocationKeys.detail(updated.id), updated)
    },
  })
}

/**
 * useDeleteCustomerServiceLocation — DELETE an existing service location.
 */
export function useDeleteCustomerServiceLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      locationId,
    }: {
      customerId: string
      locationId: string
    }) => deleteCustomerServiceLocation(customerId, locationId),
    onSuccess: (_deleted, { customerId, locationId }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.removeQueries({ queryKey: customerServiceLocationKeys.detail(locationId) })
    },
  })
}
