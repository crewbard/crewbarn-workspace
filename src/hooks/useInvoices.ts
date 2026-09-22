import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  markInvoicePaid,
  cancelInvoice,
  getInvoiceFilingSummary,
  getInvoiceStatusCounts,
} from '@/lib/invoices'
import type {
  InvoiceListParams,
  InvoiceCreateInput,
  InvoiceMarkPaidInput,
} from '@/types/invoice'

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (params: InvoiceListParams) => ['invoices', 'list', params] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
}

export function useInvoices(params: InvoiceListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => listInvoices(params),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  })
}

export function useInvoiceStatusCounts(params: {
  q?: string
  filing_year?: number
  filing_month?: number
} = {}) {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'status-counts', params],
    queryFn: () => getInvoiceStatusCounts(params),
    staleTime: 30_000,
  })
}

export function useInvoiceFilingSummary(params: InvoiceListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'filing-summary', params],
    queryFn: () => getInvoiceFilingSummary(params),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  })
}

export function useInvoice(id: string | undefined | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    queryFn: () => getInvoice(id as string),
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvoiceCreateInput) => createInvoice(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InvoiceCreateInput> }) =>
      updateInvoice(id, input),
    onSuccess: (_inv, { id }) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all })
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  })
}

export function useSendInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sendInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  })
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: InvoiceMarkPaidInput }) =>
      markInvoicePaid(id, input ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  })
}

export function useCancelInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  })
}
