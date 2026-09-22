import { apiRequest } from '@/lib/api'
import type {
  Invoice,
  InvoiceCreateInput,
  InvoiceFilingSummary,
  InvoiceListParams,
  InvoiceMarkPaidInput,
} from '@/types/invoice'

export async function listInvoices(params: InvoiceListParams = {}): Promise<Invoice[]> {
  const qs = new URLSearchParams()
  if (params.customer_id)    qs.set('customer_id', params.customer_id)
  if (params.work_order_id)  qs.set('work_order_id', params.work_order_id)
  if (params.status)         qs.set('status', params.status)
  if (params.balance)        qs.set('balance', params.balance)
  if (params.include_bill_to) qs.set('include_bill_to', '1')
  if (params.q)               qs.set('q', params.q)
  if (params.overdue)         qs.set('overdue', '1')
  if (params.filing_year)     qs.set('filing_year', String(params.filing_year))
  if (params.filing_month)    qs.set('filing_month', String(params.filing_month))
  if (params.per_page)       qs.set('per_page', String(params.per_page))
  const res = await apiRequest<{ data: Invoice[] }>(
    `/v1/invoices${qs.toString() ? `?${qs.toString()}` : ''}`,
  )
  return res.data
}

export async function getInvoiceFilingSummary(params: InvoiceListParams = {}): Promise<InvoiceFilingSummary> {
  const qs = new URLSearchParams()
  if (params.q)       qs.set('q', params.q)
  if (params.status)  qs.set('status', params.status)
  if (params.overdue) qs.set('overdue', '1')
  const res = await apiRequest<{ data: InvoiceFilingSummary }>(
    `/v1/invoices/filing-summary${qs.toString() ? `?${qs.toString()}` : ''}`,
  )
  return res.data
}

export async function getInvoice(id: string): Promise<Invoice> {
  const res = await apiRequest<{ data: Invoice }>(`/v1/invoices/${id}`)
  return res.data
}

export async function createInvoice(input: InvoiceCreateInput): Promise<Invoice> {
  const res = await apiRequest<{ data: Invoice }>('/v1/invoices', {
    method: 'POST',
    body: input,
  })
  return res.data
}

export async function updateInvoice(id: string, input: Partial<InvoiceCreateInput>): Promise<Invoice> {
  const res = await apiRequest<{ data: Invoice }>(`/v1/invoices/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return res.data
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiRequest<void>(`/v1/invoices/${id}`, { method: 'DELETE' })
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const res = await apiRequest<{ data: Invoice }>(`/v1/invoices/${id}/send`, { method: 'POST' })
  return res.data
}

export async function markInvoicePaid(id: string, input: InvoiceMarkPaidInput = {}): Promise<Invoice> {
  const res = await apiRequest<{ data: Invoice }>(`/v1/invoices/${id}/mark-paid`, {
    method: 'POST',
    body: input,
  })
  return res.data
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const res = await apiRequest<{ data: Invoice }>(`/v1/invoices/${id}/cancel`, { method: 'POST' })
  return res.data
}

export interface InvoiceDocument {
  has_template: boolean
  html: string | null
  template_name: string | null
  /** Portal link a customer can open to view/pay the invoice. */
  portal_url: string
}

/** Render this invoice through the tenant's custom invoice template (if any). */
export async function getInvoiceDocument(id: string): Promise<InvoiceDocument> {
  const res = await apiRequest<{ data: InvoiceDocument }>(`/v1/invoices/${id}/document`)
  return res.data
}

/** Email this invoice to the customer (or an override address) via Resend. */
export async function emailInvoice(id: string, email?: string): Promise<{ sent: boolean; to: string }> {
  const res = await apiRequest<{ data: { sent: boolean; to: string } }>(`/v1/invoices/${id}/email`, {
    method: 'POST',
    body: email ? { email } : {},
  })
  return res.data
}

export interface InvoiceStatusCounts {
  all: number
  draft: number
  sent: number
  overdue: number
  paid: number
}

/**
 * Workflow-tab counts for a slice of the filing cabinet. Takes the folder
 * scope so the badges describe whatever is open, and never the status, so they
 * hold still while you move between them.
 */
export async function getInvoiceStatusCounts(params: {
  q?: string
  filing_year?: number
  filing_month?: number
} = {}): Promise<InvoiceStatusCounts> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.filing_year) qs.set('filing_year', String(params.filing_year))
  if (params.filing_month) qs.set('filing_month', String(params.filing_month))
  const suffix = qs.toString() ? `?${qs}` : ''
  const res = await apiRequest<{ data: InvoiceStatusCounts }>(`/v1/invoices/status-counts${suffix}`)
  return res.data
}
