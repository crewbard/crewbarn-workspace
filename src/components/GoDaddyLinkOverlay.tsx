import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ApiError } from '@/lib/api'
import { useTenantTimezone } from '@/hooks/useTenantTime'
import {
  filterSales,
  getGoDaddySales,
  linkSaleToPayment,
  sameMoney,
  saleLabel,
  syncGoDaddyNow,
  type GoDaddySale,
  type HandPayment,
} from '@/lib/godaddyLink'

/**
 * Link a GoDaddy payment: the sales from the day this invoice was issued and
 * before, for a tech who took the payment in the GoDaddy app and didn't
 * record it. Picking one hands it back to Receive payment, which records it
 * against this one invoice. If the tech did record it by hand, that payment
 * is linked to the sale instead, and nothing new is recorded.
 */
export function GoDaddyLinkOverlay({
  invoiceId,
  onPick,
  onLinkedExisting,
  onClose,
}: {
  invoiceId: string
  onPick: (sale: GoDaddySale) => void
  onLinkedExisting: (payment: HandPayment, sale: GoDaddySale) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const zone = useTenantTimezone()
  const [earlierDays, setEarlierDays] = useState(0)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const salesQ = useQuery({
    queryKey: ['godaddy-sales', invoiceId, earlierDays],
    queryFn: () => getGoDaddySales(invoiceId, earlierDays),
  })
  const sync = useMutation({
    mutationFn: syncGoDaddyNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['godaddy-sales', invoiceId] }),
    onError: (e) => setError((e as ApiError)?.message ?? 'GoDaddy didn\'t answer. Try again in a minute.'),
  })
  const linkExisting = useMutation({
    mutationFn: ({ payment, sale }: { payment: HandPayment; sale: GoDaddySale }) => linkSaleToPayment(payment.id, sale.id, sale.tech_account_id),
    onSuccess: (_res, { payment, sale }) => {
      qc.invalidateQueries({ queryKey: ['godaddy-sales'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      onLinkedExisting(payment, sale)
    },
    onError: (e) => setError((e as ApiError)?.message ?? 'That link didn\'t go through.'),
  })

  const d = salesQ.data
  const shown = d ? filterSales(d.sales, query) : []
  const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const when = (iso: string | null, withTime = true) =>
    iso
      ? new Date(iso).toLocaleString('en-US', {
          timeZone: zone,
          month: 'short',
          day: 'numeric',
          ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
        })
      : '—'

  function linkTheirs(payment: HandPayment, sale: GoDaddySale) {
    setError(null)
    const ok = window.confirm(
      `Link ${payment.receipt_number ?? 'this payment'} (${payment.method_label}, ${money(payment.allocated_cents)}, recorded ${payment.recorded_on ?? ''}) to the GoDaddy sale ${saleLabel(sale)} on ${when(sale.occurred_at)}? Nothing new is recorded.` +
        (sale.tip_cents !== payment.tip_cents ? ` The ${money(sale.tip_cents)} tip from GoDaddy goes on it${sale.tech_name ? ` for ${sale.tech_name}` : ''}.` : ''),
    )
    if (ok) linkExisting.mutate({ payment, sale })
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Link a GoDaddy payment"
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[88vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Link a GoDaddy payment</h3>
            {d && (
              <p className="text-xs text-slate-500">
                Invoice #{d.invoice.invoice_number} · {money(d.invoice.balance_due_cents)} left to pay · sales from{' '}
                {when(d.window.from, false)} to {when(d.window.to, false)}, the day it was invoiced
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 text-2xl text-slate-500 leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {salesQ.isLoading && <p className="text-sm text-slate-500">Loading GoDaddy sales…</p>}
          {salesQ.isError && <p className="text-sm text-red-700">GoDaddy sales didn't load. Close this and try again.</p>}
          {error && <p className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">{error}</p>}

          {d && !d.connected && (
            <p className="text-sm text-slate-700">
              GoDaddy Payments isn't connected, so there are no sales to link. Connect it in Tool Shed → Payments.
            </p>
          )}
          {d && d.connected && d.invoice.why_not && <p className="text-sm text-slate-700">{d.invoice.why_not} Nothing can be linked to it.</p>}

          {d && d.connected && !d.invoice.why_not && (
            <>
              {d.already_recorded.length > 0 && (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-2 space-y-1">
                  <p className="font-semibold">Already on this invoice, not linked to a GoDaddy sale:</p>
                  {d.already_recorded.map((p) => (
                    <p key={p.id}>
                      {p.receipt_number ?? 'A payment'} · {p.method_label} · {money(p.allocated_cents)} · recorded {p.recorded_on}
                      {p.status === 'pending_turnover' ? ' · waiting to be confirmed' : ''}
                    </p>
                  ))}
                  <p>If one of these is the sale below, link it to that payment instead of recording it again.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Amount or last 4"
                  aria-label="Search by amount or the card's last 4"
                  className="flex-1 min-w-[10rem] px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    sync.mutate()
                  }}
                  disabled={sync.isPending}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                >
                  {sync.isPending ? 'Checking GoDaddy…' : 'Check GoDaddy now'}
                </button>
                <button
                  type="button"
                  onClick={() => setEarlierDays((n) => n + 14)}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Show earlier
                </button>
              </div>

              {shown.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {d.sales.length === 0
                    ? 'No GoDaddy sales in these days that aren\'t already recorded. Check GoDaddy now for one made in the last few minutes, or show earlier days.'
                    : 'Nothing matches that search.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {shown.map((s) => {
                    const theirs = sameMoney(s, d.already_recorded)
                    return (
                      <li key={s.id} className="px-3 py-2 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[12rem]">
                          <div className="text-sm text-slate-900">
                            <span className="font-mono font-semibold">{money(s.applies_cents)}</span>
                            {s.tip_cents > 0 && <span className="text-xs text-amber-800"> + {money(s.tip_cents)} tip</span>}
                            {s.exact && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5">
                                Pays it in full
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {when(s.occurred_at)} · {s.card_brand ?? 'Card'}
                            {s.card_last4 ? ` •••• ${s.card_last4}` : ''}
                            {s.tech_name ? ` · ${s.tech_name}` : ''}
                          </div>
                        </div>
                        {theirs ? (
                          <button
                            type="button"
                            onClick={() => linkTheirs(theirs, s)}
                            disabled={linkExisting.isPending}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            Link to {theirs.receipt_number ?? 'that payment'}
                          </button>
                        ) : s.fits ? (
                          <button
                            type="button"
                            onClick={() => onPick(s)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800"
                          >
                            Use this sale
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500" title="A linked sale only pays this invoice and never turns into credit.">
                            More than this invoice owes
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
