export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface InvoiceMoney {
  subtotal_cents: number
  tax_cents: number
  /** True at invoice-creation time when the customer was tax-exempt. */
  is_tax_exempt: boolean
  /** Equals tax_cents when is_tax_exempt is true; 0 otherwise. Shown as a
   *  negative "Tax Exempt" adjustment line on the invoice. */
  tax_exempt_adjustment_cents: number
  total_cents: number
  amount_paid_cents: number
  balance_due_cents: number
}

export interface InvoiceCustomerRef {
  id: string
  display_name: string
  /** Main-contact email/phone — present on the invoice detail (show) response. */
  email?: string | null
  phone?: string | null
}

export interface InvoiceWorkOrderRef {
  id: string
  display_number: string | null
  title: string | null
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  sort_order: number
  line_type: 'item' | 'fee' | 'discount'
  description: string
  quantity: string
  unit_label: string
  customer_cost_cents: number
  is_taxable: boolean
  tax_rate_pct: string
  subtotal_cents: number
  tax_amount_cents: number
  total_cents: number
  notes: string | null
  catalog_item_id: string | null
  asset_id: string | null
  tax_class_id: string | null
  source_work_order_line_item_id: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Invoice {
  id: string
  invoice_number: string
  display_number: string

  status: InvoiceStatus
  is_overdue: boolean

  customer_id: string
  customer?: InvoiceCustomerRef

  work_order_id: string | null
  work_order?: InvoiceWorkOrderRef | null

  money: InvoiceMoney

  issued_at: string | null
  due_at: string | null
  sent_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  bank_transfer_promised_at?: string | null
  bank_transfer_promise?: { bank_name?: string | null; sent_on?: string | null; amount_cents?: number; by?: string | null } | null

  payment_method: string | null
  payment_reference: string | null

  customer_notes: string | null
  internal_notes: string | null
  terms: string | null

  created_by_account_id: string | null

  line_items?: InvoiceLineItem[]

  created_at: string | null
  updated_at: string | null
}

export interface InvoiceListParams {
  customer_id?: string
  work_order_id?: string
  status?: InvoiceStatus
  /** 'open' = anything still owing (draft/sent/partial), server-filtered. */
  balance?: 'open'
  /** Dealer view: also include invoices billed TO this customer from sub-account jobs. */
  include_bill_to?: boolean
  q?: string
  overdue?: boolean
  filing_year?: number
  filing_month?: number
  per_page?: number
}

export interface InvoiceFilingSummaryEntry {
  count: number
  total_cents: number
  outstanding_cents: number
}

export interface InvoiceFilingSummary {
  years: Record<string, InvoiceFilingSummaryEntry>
  months: Record<string, Record<string, InvoiceFilingSummaryEntry>>
}

export interface InvoiceCreateInput {
  customer_id: string
  work_order_id?: string | null
  issued_at?: string | null
  due_at?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  terms?: string | null
  copy_line_items_from_work_order?: boolean
  /** POS / counter-sale: send inline line items + skip copy_line_items.
   *  Server runs recalculateTotals after creating each line. */
  line_items?: Array<{
    line_type?: 'item' | 'fee' | 'discount'
    description: string
    quantity: number
    unit_label?: string
    customer_cost_cents: number
    is_taxable?: boolean
    tax_rate_pct?: number
    tax_class_id?: string | null
    discount_id?: string | null
    discount_kind?: 'percent' | 'fixed' | null
    discount_value?: number
    notes?: string | null
  }>
}

export interface InvoiceMarkPaidInput {
  amount_paid_cents?: number
  payment_method?: string | null
  payment_reference?: string | null
  paid_at?: string | null
}
