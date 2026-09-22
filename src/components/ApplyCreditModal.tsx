import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'

/**
 * Draw down a customer credit against an outstanding invoice. Modeled
 * after ReceivePaymentModal but scoped to one credit → one invoice (or
 * a partial draw). Used when a customer paid a deposit before the job
 * was invoiced; once the invoice exists, the office applies the
 * existing credit instead of asking for more money.
 *
 * The backend mints a Payment row with method='credit' linked back to
 * the source credit so the audit trail stays intact.
 */

interface OutstandingInvoice {
  id: string
  invoice_number: string
  issued_at: string | null
  amount_due_cents: number
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ApplyCreditModal({
  credit,
  customerId,
  onClose,
}: {
  credit: { id: string; balance_cents: number; notes: string | null; created_at: string | null }
  customerId: string
  onClose: () => void
}) {
  const qc = useQueryClient()

  const invoicesQ = useQuery({
    queryKey: ['customer-outstanding-invoices', customerId],
    queryFn: () =>
      apiRequest<{ data: OutstandingInvoice[] }>(
        `/v1/customers/${customerId}/outstanding-invoices`,
      ),
  })
  const invoices = invoicesQ.data?.data ?? []

  const [invoiceId, setInvoiceId] = useState('')
  const [amountDollars, setAmountDollars] = useState(
    (credit.balance_cents / 100).toFixed(2),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const amountCents = Math.round(parseFloat(amountDollars || '0') * 100) || 0
  const selectedInvoice = invoices.find((i) => i.id === invoiceId)
  // Cap to whichever is smaller: credit balance OR invoice remaining.
  const maxApplicable = selectedInvoice
    ? Math.min(credit.balance_cents, selectedInvoice.amount_due_cents)
    : credit.balance_cents

  const apply = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/customer-credits/${credit.id}/apply`, {
        method: 'POST',
        body: { invoice_id: invoiceId, amount_cents: amountCents },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-credits', customerId] })
      qc.invalidateQueries({ queryKey: ['customer-outstanding-invoices', customerId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      onClose()
    },
    onError: (e: ApiError | Error) => {
      const detail = (e as ApiError)?.details as { message?: string } | undefined
      setError(detail?.message ?? (e as Error).message ?? 'Failed to apply credit.')
    },
  })

  async function submit() {
    setError(null)
    if (!invoiceId) {
      setError('Pick the invoice to apply this credit to.')
      return
    }
    if (amountCents <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (amountCents > maxApplicable) {
      setError(`That's more than the lower of the credit balance ($${dollars(credit.balance_cents)}) or invoice balance ($${dollars(selectedInvoice?.amount_due_cents ?? 0)}).`)
      return
    }
    setBusy(true)
    try {
      await apply.mutateAsync()
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
        className="bg-white rounded-2xl shadow-xl max-w-md w-full"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Apply credit</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-2xl text-slate-500 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-sky-900">Credit balance available</span>
              <span className="font-mono font-semibold text-sky-900">
                ${dollars(credit.balance_cents)}
              </span>
            </div>
            {credit.notes && (
              <div className="text-[11px] text-sky-800 mt-1 italic">{credit.notes}</div>
            )}
          </div>

          {error && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          {invoicesQ.isLoading ? (
            <div className="text-xs text-slate-500">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded p-4">
              No outstanding invoices for this customer yet. Create one first, then come back
              to apply the credit.
            </div>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Apply to invoice
                </span>
                <select
                  value={invoiceId}
                  onChange={(e) => {
                    setInvoiceId(e.target.value)
                    // Snap amount to the lower of credit/invoice balance.
                    const inv = invoices.find((i) => i.id === e.target.value)
                    if (inv) {
                      const cap = Math.min(credit.balance_cents, inv.amount_due_cents)
                      setAmountDollars((cap / 100).toFixed(2))
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                >
                  <option value="">Pick an invoice…</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoice_number} · ${dollars(inv.amount_due_cents)} owed
                      {inv.issued_at && ` · ${inv.issued_at}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount to apply
                </span>
                <div className="inline-flex items-center gap-1">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={maxApplicable / 100}
                    value={amountDollars}
                    onChange={(e) => setAmountDollars(e.target.value)}
                    className="w-32 text-right border border-slate-300 rounded px-2 py-1.5 text-sm tabular-nums"
                  />
                </div>
                <span className="block text-[11px] text-slate-500 mt-1">
                  Max ${dollars(maxApplicable)} — lower of the credit's balance or the
                  invoice's remaining amount.
                </span>
              </label>
            </>
          )}
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
            disabled={busy || invoices.length === 0 || !invoiceId || amountCents <= 0}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
          >
            {busy ? 'Applying…' : `Apply $${dollars(amountCents)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
