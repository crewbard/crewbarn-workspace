import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
} from '@/lib/customerContacts'
import type { CustomerContactInput } from '@/types/customer'
import { customerKeys } from '@/hooks/useCustomers'

export function useCreateCustomerContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      input,
    }: {
      customerId: string
      input: CustomerContactInput
    }) => createCustomerContact(customerId, input),
    onSuccess: (_c, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      qc.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useUpdateCustomerContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      contactId,
      input,
    }: {
      customerId: string
      contactId: string
      input: CustomerContactInput
    }) => updateCustomerContact(customerId, contactId, input),
    onSuccess: (_c, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      qc.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useDeleteCustomerContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      contactId,
    }: {
      customerId: string
      contactId: string
    }) => deleteCustomerContact(customerId, contactId),
    onSuccess: (_v, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      qc.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}
