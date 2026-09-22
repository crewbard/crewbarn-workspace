import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TerminalWaitPanel } from '@/components/TerminalWaitPanel'
import { apiRequest, type ApiError } from '@/lib/api'

/**
 * Receive a customer payment that can cover multiple invoices in one
 * shot — used for customers who write a single check against several
 * outstanding invoices, plus the in-field tech-collection flow.
 *
 * Inputs
 *   - Payment method (cash / check / card_* / ACH / PayPal / GoDaddy / other)
 *   - Per-invoice allocation amounts (checkbox + amount, defaulted to
 *     the invoice's outstanding balance)
 *   - Optional tip (goes to a tech)
 *   - Optional customer credit (leftover that becomes a credit row)
 *   - Reference number + notes
 *
 * The total amount = allocations + tip + credit; the form refuses to
 * save until they balance. The backend re-validates so a mistuned
 * client can't sneak a mismatch through.
 *
 * What happens after save depends on who's submitting:
 *   - Cash-flow manager → payment lands status='received', invoices
 *     get amount_paid bumped, credit row created if any leftover
 *   - Anyone else (tech) → payment lands status='pending_turnover';
 *     office must confirm via the cash drawer page
 */

interface OutstandingInvoice {
  id: string
  invoice_number: string
  /** For a billed-to invoice, whose job it was; null for the payer's own. */
  bill_for?: string | null
  issued_at: string | null
  due_date: string | null
  status: string
  total_cents: number
  amount_paid_cents: number
  amount_due_cents: number
}

interface TenantAccountRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

const METHODS: Array<{ value: string; label: string }> = [
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  // portal_stripe = charge a card via Stripe Checkout. Renders an
  // extra "Charge $X via Stripe" button instead of the usual Record
  // button so the clerk sees the flow differs.
  { value: 'portal_stripe', label: 'Card via Stripe (charge now)' },
  // godaddy_terminal = push the amount to a GoDaddy Smart Terminal and
  // wait for the tap. Only offered when the tenant has ticked a terminal.
  { value: 'godaddy_terminal', label: 'Card on Smart Terminal (GoDaddy — charge now)' },
  { value: 'card_manual', label: 'Card (manual / over the phone — already charged)' },
  { value: 'card_terminal', label: 'Card (physical terminal — already charged)' },
  { value: 'ach', label: 'ACH / bank transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'godaddy', label: 'GoDaddy' },
  { value: 'other', label: 'Other' },
]

function dollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ReceivePaymentModal({
  customerId,
  customerName,
  onClose,
  onCreated,
  preSelectInvoiceId,
  workOrderId,
}: {
  customerId: string
  customerName: string
  onClose: () => void
  onCreated?: (paymentId: string) => void
  /**
   * When set (e.g. from the POS "Create + take payment" flow), the
   * allocation table only checks THIS invoice at its full balance.
   * Every other outstanding invoice loads but starts unchecked so the
   * counter clerk doesn't accidentally apply the sale's payment to old
   * open invoices the customer hasn't paid yet.
   */
  preSelectInvoiceId?: string
  /**
   * When opened from a job, the payment (and any resulting credit) is
   * tagged with this work order — so a payment taken before the job is
   * invoiced shows on the job as a down payment and auto-applies to the
   * invoice once it's created.
   */
  workOrderId?: string
}) {
  const qc = useQueryClient()

  // Backend gates NET-account payments to cash-flow managers; surface
  // that upfront so the user doesn't fill out the whole form and bounce.
  const customerQ = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () =>
      apiRequest<{ data: { id: string; display_name: string; is_net_account: boolean } }>(
        `/v1/customers/${customerId}`,
      ),
  })
  const isNetAccount = !!customerQ.data?.data.is_net_account

  const invoicesQ = useQuery({
    queryKey: ['customer-outstanding-invoices', customerId],
    queryFn: () =>
      apiRequest<{ data: OutstandingInvoice[] }>(
        `/v1/customers/${customerId}/outstanding-invoices`,
      ),
  })

  const techsQ = useQuery({
    queryKey: ['tenant-accounts'],
    queryFn: () =>
      apiRequest<{ data: TenantAccountRow[] }>('/v1/tenant-accounts'),
  })

  // Tenant-configured payment types (Tool Shed → Payment types): enabled
  // built-ins + customs. The two charge-flow entries (Stripe / terminal)
  // stay pinned — they're flows, not labels, and aren't tenant-editable.
  const methodsQ = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => apiRequest<{ data: Array<{ value: string; label: string }> }>('/v1/payment-methods'),
  })
  const methodOptions: Array<{ value: string; label: string }> = (() => {
    const dyn = methodsQ.data?.data
    if (!dyn || dyn.length === 0) return METHODS
    const flows = METHODS.filter((m) => m.value === 'portal_stripe' || m.value === 'card_terminal' || m.value === 'godaddy_terminal')
    const rest = dyn.filter((m) => m.value !== 'other')
    const other = dyn.find((m) => m.value === 'other')
    return [...rest, ...flows, ...(other ? [other] : [])]
  })()

  // GoDaddy Smart Terminals the tenant has ticked in Card payments. The
  // terminal flow only shows when there's somewhere to send the payment.
  const godaddyQ = useQuery({
    queryKey: ['godaddy-status'],
    queryFn: () =>
      apiRequest<{ data: { connected: boolean; terminals: Array<{ id: string; name: string | null; selected?: boolean }> } }>(
        '/v1/payments/godaddy/status',
      ),
    staleTime: 60_000,
  })
  const terminals = (godaddyQ.data?.data.connected ? godaddyQ.data.data.terminals : []).filter((t) => t.selected)
  const [terminalId, setTerminalId] = useState('')
  useEffect(() => {
    if (!terminalId && terminals.length > 0) setTerminalId(terminals[0].id)
  }, [terminals, terminalId])
  const visibleMethodOptions = methodOptions.filter((m) => m.value !== 'godaddy_terminal' || terminals.length > 0)

  // Once pushed, the modal becomes the waiting screen.
  const [waiting, setWaiting] = useState<{ paymentId: string; terminalName: string; amountCents: number } | null>(null)

  const [method, setMethod] = useState('check')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  // Allocation: keyed by invoice_id → cents. Defaults to each
  // invoice's outstanding balance on first load; user can uncheck or
  // edit amounts.
  const [allocs, setAllocs] = useState<Record<string, number>>({})
  const [tipDollars, setTipDollars] = useState('')
  const [tipTechId, setTipTechId] = useState('')
  const [creditDollars, setCreditDollars] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed allocation defaults once invoices arrive.
  //
  // Default behavior: every outstanding invoice starts CHECKED at its
  // full balance — matches the "customer paid one big check across all
  // their invoices" flow.
  //
  // When preSelectInvoiceId is set (POS "Create + take payment" flow):
  // only that invoice starts checked. The clerk just rang up a single
  // sale; auto-applying its tender to old invoices would be wrong.
  useEffect(() => {
    if (!invoicesQ.data) return
    setAllocs((prev) => {
      const next = { ...prev }
      for (const inv of invoicesQ.data!.data) {
        if (!(inv.id in next)) {
          if (preSelectInvoiceId) {
            next[inv.id] = inv.id === preSelectInvoiceId ? inv.amount_due_cents : 0
          } else {
            next[inv.id] = inv.amount_due_cents
          }
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicesQ.data, preSelectInvoiceId])

  const invoices = invoicesQ.data?.data ?? []
  const techs = techsQ.data?.data ?? []

  const allocSum = useMemo(
    () => Object.values(allocs).reduce((acc, v) => acc + (Number(v) > 0 ? Math.round(Number(v)) : 0), 0),
    [allocs],
  )
  const tipCents = Math.round(parseFloat(tipDollars || '0') * 100) || 0
  const creditCents = Math.round(parseFloat(creditDollars || '0') * 100) || 0
  const totalCents = allocSum + tipCents + creditCents

  function setAllocFor(id: string, cents: number) {
    setAllocs((prev) => ({ ...prev, [id]: Math.max(0, cents) }))
  }

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { id: string; status: string } }>('/v1/payments', {
        method: 'POST',
        body: {
          customer_id: customerId,
          work_order_id: workOrderId ?? null,
          amount_cents: totalCents,
          tip_cents: tipCents,
          tip_tech_account_id: tipCents > 0 ? tipTechId || null : null,
          customer_credit_cents: creditCents,
          payment_method: method,
          payment_reference: reference.trim() || null,
          notes: notes.trim() || null,
          allocations: Object.entries(allocs)
            .filter(([, c]) => c > 0)
            .map(([invoice_id, amount_cents]) => ({ invoice_id, amount_cents })),
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['customer-outstanding-invoices', customerId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['payments-pending-count'] })
      onCreated?.(res.data.id)
      onClose()
    },
  })

  // "Charge via Stripe" — backend stages a pending_stripe Payment and
  // mints a Checkout Session. We open the URL in a new tab; the user
  // can also scan a QR if they want the customer to pay on their own
  // phone (left as a follow-up). Webhook settles the payment when
  // Stripe confirms.
  const stripeCheckout = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { payment_id: string; session_id: string; url: string } }>(
        '/v1/payments/stripe-checkout',
        {
          method: 'POST',
          body: {
            customer_id: customerId,
            work_order_id: workOrderId ?? null,
            amount_cents: totalCents,
            tip_cents: tipCents,
            tip_tech_account_id: tipCents > 0 ? tipTechId || null : null,
            customer_credit_cents: creditCents,
            notes: notes.trim() || null,
            allocations: Object.entries(allocs)
              .filter(([, c]) => c > 0)
              .map(([invoice_id, amount_cents]) => ({ invoice_id, amount_cents })),
          },
        },
      ),
    onSuccess: (res) => {
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
      qc.invalidateQueries({ queryKey: ['payments'] })
      onCreated?.(res.data.payment_id)
      onClose()
    },
  })

  const terminalCharge = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { payment_id: string; terminal: { id: string; name: string }; amount_cents: number } }>(
        '/v1/payments/godaddy/terminal-charge',
        {
          method: 'POST',
          body: {
            customer_id: customerId,
            work_order_id: workOrderId ?? null,
            amount_cents: totalCents,
            tip_cents: tipCents,
            tip_tech_account_id: tipCents > 0 ? tipTechId || null : null,
            customer_credit_cents: creditCents,
            notes: notes.trim() || null,
            terminal_id: terminalId,
            allocations: Object.entries(allocs)
              .filter(([, c]) => c > 0)
              .map(([invoice_id, amount_cents]) => ({ invoice_id, amount_cents })),
          },
        },
      ),
    onSuccess: (res) => {
      setWaiting({ paymentId: res.data.payment_id, terminalName: res.data.terminal.name, amountCents: res.data.amount_cents })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  async function submit() {
    setError(null)
    if (totalCents <= 0) {
      setError('Pick at least one invoice (or enter a tip / credit amount).')
      return
    }
    if (method === 'check' && !reference.trim()) {
      setError('Enter the check number before recording this payment.')
      return
    }
    if (tipCents > 0 && !tipTechId) {
      setError('Pick which tech earned the tip.')
      return
    }
    setBusy(true)
    try {
      // Card-via-Stripe takes a different path — staged payment +
      // hosted card form in a new tab. All other methods record
      // immediately (cash, check, manual card, already-charged card).
      if (method === 'portal_stripe') {
        await stripeCheckout.mutateAsync()
      } else if (method === 'godaddy_terminal') {
        if (!terminalId) throw new Error('Pick a terminal.')
        await terminalCharge.mutateAsync()
      } else {
        await create.mutateAsync()
      }
    } catch (err) {
      const e = err as ApiError
      const fieldErrs = (e?.details as { errors?: Record<string, string[]> })?.errors
      const firstField = fieldErrs ? Object.values(fieldErrs)[0]?.[0] : undefined
      setError(firstField ?? e?.message ?? 'Failed to record payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col"
      >
        {waiting ? (
          <TerminalWaitPanel
            paymentId={waiting.paymentId}
            terminalName={waiting.terminalName}
            amountCents={waiting.amountCents}
            onSettled={() => {
              qc.invalidateQueries({ queryKey: ['invoices'] })
              qc.invalidateQueries({ queryKey: ['customer-outstanding-invoices', customerId] })
              qc.invalidateQueries({ queryKey: ['payments'] })
              qc.invalidateQueries({ queryKey: ['payments-pending-count'] })
              onCreated?.(waiting.paymentId)
              setTimeout(onClose, 1500)
            }}
            onCancelled={() => {
              qc.invalidateQueries({ queryKey: ['payments'] })
              setTimeout(() => setWaiting(null), 1500)
            }}
          />
        ) : (
        <>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Receive payment</h2>
            <div className="text-xs text-slate-500">{customerName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-2xl text-slate-500 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isNetAccount && (
            <div className="text-xs bg-sky-50 border border-sky-200 text-sky-900 rounded px-3 py-2">
              <strong>NET-terms account.</strong> Only designated cash-flow managers can
              record payments for this customer. If that's not you, the form will return
              an error on submit.
            </div>
          )}
          {error && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Invoice picker */}
          <section>
            <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-700 mb-2">
              Apply payment to
            </h3>
            {invoicesQ.isLoading ? (
              <div className="text-xs text-slate-500">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="bg-sky-50 border border-sky-200 rounded p-4 text-sm text-sky-900 space-y-2">
                <div className="font-semibold">No invoices yet — record this as a down payment</div>
                <div className="text-xs">
                  Enter the amount in the <strong>Customer credit</strong> box below. It'll
                  sit on the customer's account; you can apply it to the invoice once you
                  create one.
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Invoice</th>
                      <th className="text-left px-3 py-2 font-medium">Issued</th>
                      <th className="text-right px-3 py-2 font-medium">Due</th>
                      <th className="text-right px-3 py-2 font-medium w-36">Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const value = allocs[inv.id] ?? 0
                      const checked = value > 0
                      return (
                        <tr key={inv.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setAllocFor(inv.id, e.target.checked ? inv.amount_due_cents : 0)
                                }
                                className="rounded border-slate-300"
                              />
                              <span className="font-mono text-xs text-slate-600">
                                #{inv.invoice_number}
                                {inv.bill_for && (
                                  <span className="ml-1 font-sans text-[11px] text-slate-500">
                                    · For: {inv.bill_for}
                                  </span>
                                )}
                              </span>
                            </label>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {inv.issued_at ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-900">
                            ${dollars(inv.amount_due_cents)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-slate-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={(value / 100).toFixed(2)}
                                onChange={(e) =>
                                  setAllocFor(
                                    inv.id,
                                    Math.round(parseFloat(e.target.value || '0') * 100),
                                  )
                                }
                                disabled={!checked}
                                className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-sm tabular-nums disabled:bg-slate-50"
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase font-semibold text-slate-600">
                        Allocations subtotal
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-900 font-semibold">
                        ${dollars(allocSum)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Tip + credit */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide font-semibold text-amber-900">
                  Tip <span className="font-normal lowercase">(goes to a tech)</span>
                </div>
                <div className="inline-flex items-center gap-1">
                  <span className="text-amber-900">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tipDollars}
                    onChange={(e) => setTipDollars(e.target.value)}
                    placeholder="0.00"
                    className="w-24 text-right border border-amber-300 bg-white rounded px-2 py-1 text-sm tabular-nums"
                  />
                </div>
              </div>
              {tipCents > 0 && (
                <select
                  value={tipTechId}
                  onChange={(e) => setTipTechId(e.target.value)}
                  className="w-full text-sm border border-amber-300 bg-white rounded px-2 py-1.5"
                >
                  <option value="">Pick the tech…</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {[t.first_name, t.last_name].filter(Boolean).join(' ') || t.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide font-semibold text-sky-900">
                  Customer credit <span className="font-normal lowercase">(overpayment)</span>
                </div>
                <div className="inline-flex items-center gap-1">
                  <span className="text-sky-900">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditDollars}
                    onChange={(e) => setCreditDollars(e.target.value)}
                    placeholder="0.00"
                    className="w-24 text-right border border-sky-300 bg-white rounded px-2 py-1 text-sm tabular-nums"
                  />
                </div>
              </div>
              <p className="text-[11px] text-sky-900">
                Leftover after invoices + tip. Applies to the customer's next invoice.
              </p>
            </div>
          </section>

          {/* Method + reference + notes */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-700">
              Payment details
            </h3>
            {method === 'godaddy_terminal' && (
              <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded px-3 py-2 space-y-2">
                <div>
                  <strong>Smart Terminal.</strong> The amount appears on the terminal; the customer taps or inserts their card there. This screen waits and marks the payment received on its own.
                </div>
                {terminals.length > 1 && (
                  <label className="block">
                    <span className="font-semibold">Send to</span>
                    <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)} className="mt-1 block w-full rounded border border-emerald-300 bg-white px-2 py-1 text-sm text-slate-900">
                      {terminals.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.id}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}
            {method === 'portal_stripe' && (
              <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 rounded px-3 py-2">
                <strong>Stripe Checkout.</strong> Clicking <em>Charge via Stripe</em> opens
                a Stripe-hosted card form in a new tab. Hand the device to the customer
                or paste the URL. Payment lands as <em>received</em> automatically once
                Stripe confirms.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1">Method</span>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                >
                  {visibleMethodOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  {method === 'check' ? 'Check number' : 'Reference'}{' '}
                  <span className="text-slate-400 font-normal">{method === 'check' ? '(required)' : '(optional)'}</span>
                </span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    method === 'check' ? 'Check #' : method.startsWith('card') ? 'Last 4 / charge ID' : 'Transaction ID'
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-1">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
          </section>

          {/* Totals strip */}
          <section className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Allocations</span>
              <span className="font-mono">${dollars(allocSum)}</span>
            </div>
            {tipCents > 0 && (
              <div className="flex justify-between text-amber-900">
                <span>Tip</span>
                <span className="font-mono">${dollars(tipCents)}</span>
              </div>
            )}
            {creditCents > 0 && (
              <div className="flex justify-between text-sky-900">
                <span>Credit</span>
                <span className="font-mono">${dollars(creditCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-300 mt-2 pt-2">
              <span>Total received</span>
              <span className="font-mono">${dollars(totalCents)}</span>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || totalCents <= 0}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
          >
            {busy
              ? method === 'portal_stripe'
                ? 'Opening Stripe…'
                : method === 'godaddy_terminal'
                  ? 'Sending to terminal…'
                  : 'Recording…'
              : method === 'portal_stripe'
                ? `Charge $${dollars(totalCents)} via Stripe →`
                : method === 'godaddy_terminal'
                  ? `Send $${dollars(totalCents)} to ${terminals.find((t) => t.id === terminalId)?.name ?? 'terminal'} →`
                  : `Record ${dollars(totalCents) === '0.00' ? '' : '$' + dollars(totalCents) + ' '}payment`}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
