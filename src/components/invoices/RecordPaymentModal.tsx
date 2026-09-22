import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { markInvoicePaid } from '@/lib/invoices'
import type { Invoice } from '@/types/invoice'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'

/**
 * Take a payment against one invoice.
 *
 * Lifted out of the invoice detail page so the Invoices list can use it too.
 * Collecting is the reason most people open that list, and sending them into a
 * detail page and back for each one turned a morning's receipts into a lot of
 * navigation.
 *
 * The amount defaults to the balance but is editable: part payments are normal,
 * and the endpoint allocates only the delta so re-recording never double-counts.
 */

function formatCurrency(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function RecordPaymentModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState<string>(
    (invoice.money.balance_due_cents / 100).toFixed(2),
  )
  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState<string>('')
  const tenantTimezone = useTenantTimezone()
  const [paidAt, setPaidAt] = useState<string>(() => tenantDate(tenantTimezone))

  useEffect(() => {
    setPaidAt(tenantDate(tenantTimezone))
  }, [tenantTimezone])

  const save = useMutation({
    mutationFn: () =>
      markInvoicePaid(invoice.id, {
        amount_paid_cents: Math.round(Number(amount) * 100),
        payment_method: method || null,
        payment_reference: reference || null,
        paid_at: paidAt || null,
      }),
    onSuccess: onSaved,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <h2 className="text-base font-semibold text-navy-900 mb-3">
          {/* Not "mark paid": the amount is editable and part payments are
              normal, so the old title described only one of the two outcomes. */}
          Take payment &mdash; {invoice.display_number}
        </h2>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Amount received
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Balance due: {formatCurrency(invoice.money.balance_due_cents)}
            </span>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Payment method
            </span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
              <option value="ach">ACH / Bank transfer</option>
              <option value="stripe">Stripe</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Reference (check #, txn id, etc.)
            </span>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Date received
            </span>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
        </div>

        {save.isError && (
          <div className="mt-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5">
            {(save.error as Error).message}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={save.isPending || !amount}
            onClick={() => save.mutate()}
            className="text-sm px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
