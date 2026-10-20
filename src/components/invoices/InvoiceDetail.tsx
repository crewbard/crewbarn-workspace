import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInvoice,
  sendInvoice,
  cancelInvoice,
  deleteInvoice,
} from '@/lib/invoices'
import type { InvoiceStatus } from '@/types/invoice'
import type { ApiError } from '@/lib/api'
import { paymentMethodLabel } from '@/lib/paymentMethod'
import { InvoicePreviewOverlay } from '@/components/InvoicePreviewOverlay'
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal'
import { TerminalChargeButton } from '@/components/invoices/TerminalChargeButton'
import { usePermissions } from '@/hooks/usePermissions'
import { useRecordShortcuts } from '@/hooks/useShortcuts'

/**
 * Invoice detail. View-only for line items + notes (those are edited via
 * the source WO or estimate). Lifecycle actions — send / mark paid /
 * cancel / delete — are status-gated.
 *
 * Rendered two ways: as the /invoices/:id page, and embedded in the
 * overlay the job page opens so the office never leaves the job.
 */

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 border-slate-300',
  sent: 'bg-blue-100 text-blue-800 border-blue-300',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-300',
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InvoiceDetail({
  invoiceId,
  embedded = false,
  presentation = 'standard',
  onDeleted,
  onChanged,
}: {
  invoiceId: string
  /** Inside the job page's overlay: no page gutters, no "source job" link, delete closes the overlay. */
  embedded?: boolean
  /** Opt-in presentation, including invoices opened from a job. */
  presentation?: 'standard' | 'easy' | 'focus'
  onDeleted?: () => void
  /** Anything that changed the invoice (sent, paid, cancelled) — the host refetches its own view. */
  onChanged?: () => void
}) {
  const id = invoiceId
  const easy = presentation === 'easy'
  const focus = presentation === 'focus'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showMarkPaid, setShowMarkPaid] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [focusTab, setFocusTab] = useState<'overview' | 'charges' | 'payments' | 'delivery' | 'history'>('overview')
  // Viewing needs invoices.view; anything that changes the invoice needs invoices.edit.
  const { has } = usePermissions()
  const canEdit = has('invoices.edit')

  // Deep-link from the Invoices list next-step chip (?action=payment) →
  // auto-open the record-payment modal (it still confirms amount/method).
  // Clear the param so a refresh/back doesn't re-trigger it. Page only.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (!embedded && searchParams.get('action') === 'payment') {
      if (canEdit) setShowMarkPaid(true)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
  }, [embedded, searchParams, setSearchParams, canEdit])

  const changed = () => {
    qc.invalidateQueries({ queryKey: ['invoice', id] })
    qc.invalidateQueries({ queryKey: ['invoices'] })
    onChanged?.()
  }

  const q = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
    enabled: !!id,
    staleTime: 30_000,
  })

  const send = useMutation({
    mutationFn: () => sendInvoice(id),
    onSuccess: changed,
  })

  const cancel = useMutation({
    mutationFn: () => cancelInvoice(id),
    onSuccess: changed,
  })

  const destroy = useMutation({
    mutationFn: () => deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      if (onDeleted) onDeleted()
      else navigate('/accounting/invoices')
    },
  })

  const gutters = embedded ? '' : 'px-4 py-4 sm:px-6 sm:py-6 2xl:px-8'

  // Keyboard shortcuts on the invoice page: an invoice has no thread of its
  // own, so M opens its customer's messages. (Nothing here is edited in place, so no E.)
  const invoiceCustomerId = q.data?.customer?.id ?? q.data?.customer_id
  useRecordShortcuts({
    messages: invoiceCustomerId && has('customers.view') ? () => navigate(`/customers/${invoiceCustomerId}?tab=messages`) : undefined,
  }, !embedded)

  if (q.isLoading) {
    return (
      <div className={`mx-auto w-full max-w-none text-slate-500 ${gutters}`}>
        Loading…
      </div>
    )
  }

  if (q.error || !q.data) {
    return (
      <div className={`mx-auto w-full max-w-none ${gutters}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {(q.error as ApiError)?.message ?? 'Invoice not found.'}
        </div>
        {!embedded && (
          <Link to="/accounting/invoices" className="text-sm text-amber-700 hover:underline mt-3 inline-block">
            ← Back to Invoices
          </Link>
        )}
      </div>
    )
  }

  const inv = q.data
  const m = inv.money
  const isDraft = inv.status === 'draft'
  const isSent = inv.status === 'sent'
  const isPaid = inv.status === 'paid'
  const isCancelled = inv.status === 'cancelled'

  const anyMutation = send.isPending || cancel.isPending || destroy.isPending
  const actionsCard = (
    <Card title="Actions" tour="invoice-actions">
      {(send.isError || cancel.isError || destroy.isError) && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-2">
          {(send.error || cancel.error || (destroy.error as Error))?.message ?? 'Action failed.'}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          data-tour="invoice-print"
          onClick={() => setShowPreview(true)}
          className="w-full text-sm px-3 py-2 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
        >
          View / Print invoice
        </button>

        {canEdit && isDraft && (
          <div data-tour="invoice-mark-sent" className="space-y-2">
            <button
              type="button"
              disabled={anyMutation}
              onClick={() => send.mutate()}
              className="w-full text-sm px-3 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
            >
              {send.isPending ? 'Marking…' : 'Mark as sent (no email)'}
            </button>
            <p className="text-[11px] leading-snug text-slate-500">
              This only changes the status. To send it to the customer, open View / Print invoice and use
              Email or Text.
            </p>
          </div>
        )}

        {canEdit && (isDraft || isSent) && (
          <button
            type="button"
            data-tour="invoice-mark-paid"
            disabled={anyMutation}
            onClick={() => setShowMarkPaid(true)}
            className="w-full text-sm px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            Mark paid…
          </button>
        )}

        {/* Push the balance to a GoDaddy Smart Terminal. Only renders
            when the tenant has a terminal ticked in Card payments. */}
        {canEdit && isSent && (
          <div data-tour="invoice-terminal">
            <TerminalChargeButton
              invoice={inv}
              disabled={anyMutation}
              onSettled={changed}
            />
          </div>
        )}

        {canEdit && (isDraft || isSent) && (
          <button
            type="button"
            data-tour="invoice-cancel"
            disabled={anyMutation}
            onClick={() => {
              if (confirm(`Cancel invoice ${inv.display_number}? This cannot be undone.`)) {
                cancel.mutate()
              }
            }}
            className="w-full text-sm px-3 py-2 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel invoice'}
          </button>
        )}

        {canEdit && isDraft && (
          <button
            type="button"
            data-tour="invoice-delete"
            disabled={anyMutation}
            onClick={() => destroy.mutate()}
            className="w-full text-sm px-3 py-2 rounded text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {destroy.isPending ? 'Deleting…' : 'Delete draft'}
          </button>
        )}

        {(isPaid || isCancelled) && (
          <p className="text-xs text-slate-500 italic">
            No actions — this invoice is {inv.status}.
          </p>
        )}
        {!canEdit && !isPaid && !isCancelled && (
          <p className="text-xs text-slate-500 italic">
            Your role can view this invoice but can&apos;t change it.
          </p>
        )}
      </div>
    </Card>
  )

  return (
    <div data-focus-record="invoice" data-focus-invoice-tab={focus ? focusTab : undefined} className={`mx-auto w-full max-w-none space-y-4 sm:space-y-6 ${gutters}`}>
      <div data-tour="invoice-header" data-status={inv.status} data-overdue={inv.is_overdue && !isPaid && !isCancelled ? 'yes' : 'no'} data-transfer={inv.bank_transfer_promised_at && !isPaid && !isCancelled ? 'promised' : 'none'} className={easy ? 'flex flex-wrap items-baseline gap-3 rounded-2xl bg-emerald-950 p-5 sm:p-7' : 'flex items-baseline gap-2 sm:gap-3 flex-wrap'}>
        {easy && <p className="w-full text-xs font-semibold uppercase tracking-widest text-emerald-200">Customer billing</p>}
        <span className={`text-sm font-mono ${easy ? 'text-emerald-200' : 'text-slate-500'}`}>#{inv.display_number}</span>
        <h1 className={easy ? 'break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl' : 'text-xl sm:text-2xl font-bold text-navy-900'}>
          {inv.work_order?.title ?? `Invoice for ${inv.customer?.display_name ?? '—'}`}
        </h1>
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_COLOR[inv.status]}`}
        >
          {inv.status}
        </span>
        {inv.is_overdue && !isPaid && !isCancelled && (
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-red-100 text-red-800 border-red-300">
            Overdue
          </span>
        )}
        {inv.bank_transfer_promised_at && !isPaid && !isCancelled && (
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-sky-100 text-sky-800 border-sky-300"
            title={`Customer says they sent a bank transfer${inv.bank_transfer_promise?.bank_name ? ` from ${inv.bank_transfer_promise.bank_name}` : ''}${inv.bank_transfer_promise?.sent_on ? ` on ${inv.bank_transfer_promise.sent_on}` : ''}. It matches automatically when it lands in the bank feed.`}
          >
            Bank transfer on the way
          </span>
        )}
      </div>

      {(easy || focus) && <section aria-label="Invoice summary" data-tour="invoice-glance" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">At a glance</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-slate-500">Invoice total</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(m.total_cents)}</dd></div>
          <div><dt className="text-sm text-slate-500">Payments recorded</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(m.amount_paid_cents)}</dd></div>
          <div><dt className="text-sm text-slate-500">{isCancelled ? 'Invoice status' : isPaid ? 'Payment status' : 'Still to pay'}</dt><dd className={`mt-1 text-2xl font-bold tabular-nums ${isCancelled ? 'text-slate-600' : isPaid ? 'text-emerald-700' : 'text-rose-700'}`}>{isCancelled ? 'Cancelled' : isPaid ? 'Paid' : formatCurrency(m.balance_due_cents)}</dd></div>
        </dl>
        <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">{isCancelled ? 'This invoice is cancelled. Review its details and existing records below.' : isPaid ? 'Payment is recorded. Review the invoice and payment details below.' : 'Review the customer, due date and line items before using the invoice actions below. Nothing is sent or charged by opening this page.'}</p>
      </section>}

      {focus && <nav data-tour="invoice-sections" aria-label="Invoice sections" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {([['overview', 'Overview'], ['charges', `Charges (${inv.line_items?.length ?? 0})`], ['payments', 'Payments'], ['delivery', 'Delivery & files'], ['history', 'History']] as const).map(([tab, label]) => (
          <button key={tab} type="button" data-tour={`invoice-section-${tab}`} aria-pressed={focusTab === tab} onClick={() => setFocusTab(tab)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${focusTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </button>
        ))}
      </nav>}

      <div className={`grid grid-cols-1 gap-6 ${focus ? '' : 'md:grid-cols-3'}`}>
        {/* Main column: line items + totals */}
        <div className={`${focus && focusTab !== 'charges' ? 'hidden' : ''} ${focus ? '' : 'md:col-span-2'} space-y-6`}>
          <Card title="Line items" tour="invoice-lines">
            {(inv.line_items ?? []).length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">No line items.</p>
            ) : (
              <>
                {/* Mobile: each line item is its own card with the money
                    fields stacked on the right. Tax row hidden when
                    non-taxable since the total already reflects it. */}
                <div className="md:hidden space-y-2">
                  {(inv.line_items ?? []).map((li) => (
                    <div
                      key={li.id}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900 leading-snug">
                            {li.description}
                          </div>
                          {li.notes && (
                            <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">
                              {li.notes}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-slate-600 tabular-nums">
                            {li.quantity} {li.unit_label} ×{' '}
                            {formatCurrency(li.customer_cost_cents)}
                            {li.is_taxable && (
                              <span className="text-slate-500">
                                {' '}· tax {formatCurrency(li.tax_amount_cents)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="font-mono text-sm font-semibold tabular-nums shrink-0">
                          {formatCurrency(li.total_cents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: original table */}
                <table className="hidden md:table w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-2">Description</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">Unit</th>
                      <th className="py-2 px-2 text-right">Tax</th>
                      <th className="py-2 pl-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inv.line_items ?? []).map((li) => (
                      <tr key={li.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{li.description}</div>
                          {li.notes && (
                            <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">
                              {li.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {li.quantity} {li.unit_label}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatCurrency(li.customer_cost_cents)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-600">
                          {li.is_taxable ? formatCurrency(li.tax_amount_cents) : '—'}
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums font-semibold">
                          {formatCurrency(li.total_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Totals strip — full-width on mobile (was max-w-xs/ml-auto
                which made it sit awkwardly in a narrow column). */}
            <div data-tour="invoice-totals" className="mt-4 sm:ml-auto sm:max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" value={formatCurrency(m.subtotal_cents)} />
              <Row label="Tax" value={formatCurrency(m.tax_cents)} />
              {(m.tax_exempt_adjustment_cents ?? 0) > 0 && (
                <Row
                  label={
                    <span className="text-amber-700">
                      Tax exempt
                      <span className="text-[10px] uppercase tracking-wide ml-1 font-semibold">
                        (per certificate)
                      </span>
                    </span>
                  }
                  value={
                    <span className="text-amber-700 font-mono">
                      -{formatCurrency(m.tax_exempt_adjustment_cents)}
                    </span>
                  }
                />
              )}
              <Row
                label="Total"
                value={<strong>{formatCurrency(m.total_cents)}</strong>}
                divider
              />
              {m.amount_paid_cents > 0 && (
                <Row label="Paid" value={formatCurrency(m.amount_paid_cents)} />
              )}
              {!isPaid && !isCancelled && (
                <Row
                  label="Balance due"
                  value={<strong>{formatCurrency(m.balance_due_cents)}</strong>}
                />
              )}
            </div>
          </Card>

          {!focus && (inv.customer_notes || inv.terms || inv.internal_notes) && (
            <Card title="Notes & terms" tour="invoice-notes">
              {inv.customer_notes && (
                <Field label="Customer-visible notes">
                  <p className="text-sm whitespace-pre-wrap">{inv.customer_notes}</p>
                </Field>
              )}
              {inv.terms && (
                <Field label="Terms">
                  <p className="text-sm whitespace-pre-wrap">{inv.terms}</p>
                </Field>
              )}
              {inv.internal_notes && (
                <Field label="Internal (staff only)">
                  <p className="text-sm whitespace-pre-wrap text-slate-600">
                    {inv.internal_notes}
                  </p>
                </Field>
              )}
            </Card>
          )}
        </div>

        {/* Side column: meta + actions */}
        <div className={`${focus && focusTab !== 'overview' ? 'hidden' : ''} ${focus ? 'grid grid-cols-1 items-start gap-3 lg:grid-cols-2' : 'space-y-6'}`}>
          {focus && actionsCard}
          <Card title="Bill to" tour="invoice-bill-to">
            {inv.customer ? (
              <Link
                to={`/customers/${inv.customer.id}`}
                className="text-sm font-medium text-amber-700 hover:underline"
              >
                {inv.customer.display_name}
              </Link>
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
            {inv.work_order && !embedded && (
              <div data-tour="invoice-source-job" className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Source job
                </div>
                <Link
                  to={`/jobs/${inv.work_order.id}`}
                  className="text-sm text-amber-700 hover:underline font-mono"
                >
                  {inv.work_order.display_number ?? `#${inv.work_order.id}`} {inv.work_order.title}
                </Link>
                {(inv.work_order.their_work_order_number || inv.work_order.their_po_number) && (
                  <div className="mt-1 text-xs text-slate-600">
                    {[
                      inv.work_order.their_work_order_number ? `Their WO # ${inv.work_order.their_work_order_number}` : null,
                      inv.work_order.their_po_number ? `PO # ${inv.work_order.their_po_number}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Dates" tour="invoice-dates">
            <Row label="Issued" value={formatDate(inv.issued_at)} />
            <Row label="Due" value={formatDate(inv.due_at)} />
            {inv.sent_at && <Row label="Sent" value={formatDate(inv.sent_at)} />}
            {inv.paid_at && <Row label="Paid" value={formatDate(inv.paid_at)} />}
            {inv.cancelled_at && (
              <Row label="Cancelled" value={formatDate(inv.cancelled_at)} />
            )}
          </Card>

          {!focus && isPaid && (inv.payment_method || inv.payment_reference) && (
            <Card title="Payment" tour="invoice-payment">
              {inv.payment_method && <Row label="Method" value={paymentMethodLabel(inv.payment_method)} />}
              {inv.payment_reference && (
                <Row label="Reference" value={inv.payment_reference} />
              )}
            </Card>
          )}

          {!focus && actionsCard}
        </div>
      </div>

      {focus && focusTab === 'payments' && <section data-tour="invoice-payment-workspace" className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Card title="Payment position" tour="invoice-payment-position">
          <Row label="Invoice total" value={formatCurrency(m.total_cents)} />
          <Row label="Payments recorded" value={formatCurrency(m.amount_paid_cents)} />
          <Row label="Balance due" value={<strong>{isCancelled ? 'Cancelled' : formatCurrency(m.balance_due_cents)}</strong>} divider />
          {inv.paid_at && <Row label="Paid on" value={formatDate(inv.paid_at)} />}
        </Card>
        <Card title="Recorded payment" tour="invoice-payment">
          {(inv.receipts ?? []).map((r, i) => (
            <Row
              key={r.receipt_number ?? i}
              label={`${r.receipt_number ?? 'Payment'}${r.received_at ? ` · ${formatDate(r.received_at)}` : ''}${r.payment_method ? ` · ${paymentMethodLabel(r.payment_method)}` : ''}`}
              value={formatCurrency(r.amount_cents)}
            />
          ))}
          {(inv.receipts ?? []).length === 0 && inv.payment_method && <Row label="Method" value={paymentMethodLabel(inv.payment_method)} />}
          {inv.payment_reference && <Row label="Reference" value={inv.payment_reference} />}
          {(inv.receipts ?? []).length === 0 && !inv.payment_method && !inv.payment_reference && <p className="text-sm text-slate-600">No payment method or reference is recorded on this invoice.</p>}
          {canEdit && (isDraft || isSent) && <button type="button" data-tour="invoice-payment-record" disabled={anyMutation} onClick={() => setShowMarkPaid(true)} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Record payment…</button>}
          {canEdit && isSent && <div className="mt-3"><TerminalChargeButton invoice={inv} disabled={anyMutation} onSettled={changed} /></div>}
        </Card>
      </section>}

      {focus && focusTab === 'delivery' && <section data-tour="invoice-delivery-workspace" className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Card title="Customer copy" tour="invoice-delivery-preview">
          <p className="mb-3 text-sm text-slate-600">Preview the invoice before printing, emailing, or texting it to the customer.</p>
          <button type="button" data-tour="invoice-delivery-print" onClick={() => setShowPreview(true)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">View / Print invoice</button>
          {inv.sent_at && <p className="mt-3 text-sm text-slate-600">Marked sent {formatDate(inv.sent_at)}.</p>}
          {inv.work_order && <p className="mt-3 text-sm"><Link to={`/jobs/${inv.work_order.id}`} className="font-semibold text-amber-700 hover:underline">Open source job and files →</Link></p>}
        </Card>
        <Card title="Notes & terms" tour="invoice-notes">
          {inv.customer_notes && <Field label="Customer-visible notes"><p className="text-sm whitespace-pre-wrap">{inv.customer_notes}</p></Field>}
          {inv.terms && <Field label="Terms"><p className="text-sm whitespace-pre-wrap">{inv.terms}</p></Field>}
          {inv.internal_notes && <Field label="Internal (staff only)"><p className="text-sm whitespace-pre-wrap text-slate-600">{inv.internal_notes}</p></Field>}
          {!inv.customer_notes && !inv.terms && !inv.internal_notes && <p className="text-sm text-slate-600">No notes or terms are recorded on this invoice.</p>}
        </Card>
      </section>}

      {focus && focusTab === 'history' && <section data-tour="invoice-history-workspace" className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Card title="Invoice milestones" tour="invoice-history">
          <Row label="Issued" value={formatDate(inv.issued_at)} />
          <Row label="Due" value={formatDate(inv.due_at)} />
          {inv.sent_at && <Row label="Sent" value={formatDate(inv.sent_at)} />}
          {inv.paid_at && <Row label="Paid" value={formatDate(inv.paid_at)} />}
          {inv.cancelled_at && <Row label="Cancelled" value={formatDate(inv.cancelled_at)} />}
        </Card>
        <Card title="Related records" tour="invoice-related-records">
          {inv.customer && <p className="mb-3 text-sm"><span className="mr-2 text-slate-500">Customer</span><Link to={`/customers/${inv.customer.id}`} className="font-semibold text-amber-700 hover:underline">{inv.customer.display_name}</Link></p>}
          {inv.work_order && !embedded && <p className="text-sm"><span className="mr-2 text-slate-500">Source job</span><Link to={`/jobs/${inv.work_order.id}`} className="font-semibold text-amber-700 hover:underline">{inv.work_order.display_number ?? `#${inv.work_order.id}`} {inv.work_order.title}</Link></p>}
          {!inv.customer && !inv.work_order && <p className="text-sm text-slate-600">No related records are available here.</p>}
        </Card>
      </section>}

      {showMarkPaid && canEdit && (
        <RecordPaymentModal
          invoice={inv}
          onClose={() => setShowMarkPaid(false)}
          onSaved={() => {
            setShowMarkPaid(false)
            changed()
          }}
        />
      )}

      {showPreview && (
        <InvoicePreviewOverlay invoice={inv} onClose={() => setShowPreview(false)} canTakePayment={canEdit} />
      )}
    </div>
  )
}

function Card({ title, children, tour }: { title: string; children: React.ReactNode; tour?: string }) {
  return (
    <section data-tour={tour} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({
  label,
  value,
  divider,
}: {
  label: React.ReactNode
  value: React.ReactNode
  divider?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${divider ? 'border-t border-slate-200 pt-2 mt-1' : ''}`}
    >
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      {children}
    </div>
  )
}
