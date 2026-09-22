import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

export interface PaymentTerm {
  id: string
  name: string
  days_until_due: number
  description: string | null
  active: boolean
  is_default: boolean
  sort_order: number
  created_at: string | null
  updated_at: string | null
}

export interface PaymentTermInput {
  name: string
  days_until_due: number
  description?: string | null
  active?: boolean
  is_default?: boolean
  sort_order?: number
}

const KEY = ['payment-terms'] as const

export function usePaymentTerms(params: { active?: boolean } = {}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      apiRequest<{ data: PaymentTerm[] }>(
        `/v1/payment-terms${params.active !== undefined ? `?active=${params.active}` : ''}`,
      ).then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useCreatePaymentTerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentTermInput) =>
      apiRequest<{ data: PaymentTerm }>('/v1/payment-terms', {
        method: 'POST',
        body: input,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdatePaymentTerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<PaymentTermInput>
    }) =>
      apiRequest<{ data: PaymentTerm }>(`/v1/payment-terms/${id}`, {
        method: 'PATCH',
        body: input,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeletePaymentTerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/v1/payment-terms/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
