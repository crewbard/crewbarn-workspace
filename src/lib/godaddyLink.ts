import { apiRequest } from '@/lib/api'

/**
 * Receive payment → Link payment: a GoDaddy sale a tech took in the app and
 * didn't record (docs/GODADDY-LINK-PAYMENT-PLAN.md). The server holds the
 * rules (one sale, one payment; never credit; the tech's own entry first);
 * these helpers only shape and search what it returns.
 */

export interface GoDaddySale {
  id: string
  /** What the card was charged, tip included. */
  amount_cents: number
  tip_cents: number
  /** What goes on the invoice: the amount less the tip. */
  applies_cents: number
  card_brand: string | null
  card_last4: string | null
  occurred_at: string | null
  tech_account_id: string | null
  tech_name: string | null
  /** Pays the invoice's open balance exactly. */
  exact: boolean
  /** Not more than the invoice's open balance. */
  fits: boolean
}

/** A GoDaddy or card payment on the invoice that isn't linked to a sale yet. */
export interface HandPayment {
  id: string
  receipt_number: string | null
  method: string
  method_label: string
  status: string
  amount_cents: number
  tip_cents: number
  allocated_cents: number
  reference: string | null
  recorded_on: string | null
}

export interface GoDaddySalesForInvoice {
  connected: boolean
  synced_at: string | null
  invoice: {
    id: string
    invoice_number: string
    status: string
    balance_due_cents: number
    issued_at: string | null
    /** Why nothing can be linked to it (cancelled, paid in full), or null. */
    why_not: string | null
  }
  window: { from: string; to: string }
  already_recorded: HandPayment[]
  sales: GoDaddySale[]
}

export interface LinkedPayment {
  id: string
  receipt_number: string | null
  status: string
  amount_cents: number
  tip_cents: number
}

export async function getGoDaddySales(invoiceId: string, earlierDays = 0): Promise<GoDaddySalesForInvoice> {
  const qs = earlierDays > 0 ? `?earlier_days=${earlierDays}` : ''
  const res = await apiRequest<{ data: GoDaddySalesForInvoice }>(`/v1/invoices/${encodeURIComponent(invoiceId)}/godaddy-sales${qs}`)
  return res.data
}

export async function linkSaleToInvoice(invoiceId: string, saleId: string, tipTechId: string | null, notes: string | null): Promise<LinkedPayment> {
  const res = await apiRequest<{ data: LinkedPayment }>(`/v1/invoices/${encodeURIComponent(invoiceId)}/godaddy-link`, {
    method: 'POST',
    body: { processor_transaction_id: saleId, tip_tech_account_id: tipTechId, notes },
  })
  return res.data
}

export async function linkSaleToPayment(paymentId: string, saleId: string, tipTechId: string | null = null): Promise<LinkedPayment> {
  const res = await apiRequest<{ data: LinkedPayment }>(`/v1/payments/${encodeURIComponent(paymentId)}/godaddy-link`, {
    method: 'POST',
    body: { processor_transaction_id: saleId, tip_tech_account_id: tipTechId },
  })
  return res.data
}

export async function syncGoDaddyNow(): Promise<void> {
  await apiRequest('/v1/processor-transactions/sync', { method: 'POST' })
}

/**
 * The payment already on the invoice that is this sale's money, if any: the
 * same amount on the invoice as the sale less its tip. (Only the invoice's
 * money is compared: a payment typed in counts its tip in its amount, and
 * the tech may have left the tip out.) The server refuses a new payment
 * while one exists; the overlay offers to link that payment instead.
 */
export function sameMoney(sale: GoDaddySale, recorded: HandPayment[]): HandPayment | undefined {
  return recorded.find((p) => p.allocated_cents === sale.applies_cents)
}

/** Search by amount ("150", "150.00", "$170") or the card's last 4. Keeps the server's order. */
export function filterSales(sales: GoDaddySale[], query: string): GoDaddySale[] {
  const q = query.trim().replace(/^\$/, '')
  if (q === '') return sales
  const asCents = /^\d+(\.\d{1,2})?$/.test(q) ? Math.round(parseFloat(q) * 100) : null
  return sales.filter(
    (s) =>
      (asCents !== null && (s.amount_cents === asCents || s.applies_cents === asCents)) ||
      (s.card_last4 ?? '').includes(q),
  )
}

export function saleLabel(sale: Pick<GoDaddySale, 'card_brand' | 'card_last4'>): string {
  return `GoDaddy · ${sale.card_brand ?? 'card'}${sale.card_last4 ? ` ${sale.card_last4}` : ''}`
}
