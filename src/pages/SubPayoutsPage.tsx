import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'

/**
 * SubPayoutsPage — accounting ledger for sub invoices.
 *
 *   - Top: three big-number tiles (lifetime paid, MTD paid, outstanding)
 *   - Middle: per-sub table (paid total + count + outstanding)
 *   - Bottom: every approved or paid invoice as a line in chronological order
 *
 * Pure read view — actions on individual invoices (approve, mark paid)
 * live on /sub-reviews, not here.
 */

interface PayoutsResponse {
  data: {
    totals: {
      paid_lifetime_cents: number
      paid_mtd_cents: number
      outstanding_cents: number
      invoice_count_paid: number
    }
    per_sub: Array<{
      subcontractor_id: string
      name: string
      paid_cents: number
      count: number
      outstanding_cents: number
    }>
    per_month: Array<{
      month: string       // YYYY-MM
      label: string       // 'Jan 2026'
      paid_cents: number
      invoice_count: number
    }>
    invoices: Array<{
      id: string
      work_order_id: string
      sub_wo_number: string | null
      subcontractor_id: string
      subcontractor_name: string | null
      invoice_number: string
      total_cents: number
      completion_date: string | null
      status: 'approved' | 'paid'
      submitted_at: string | null
      approved_at: string | null
      paid_at: string | null
      paid_via: string | null
      paid_reference: string | null
    }>
  }
}

export function SubPayoutsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sub-payouts'],
    queryFn: () => apiRequest<PayoutsResponse>('/v1/sub-payouts'),
    refetchInterval: 60_000,
  })

  return (
    <div className={easy ? 'w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6' : 'max-w-6xl mx-auto px-6 py-6'}>
      <div className="mb-6">
        <Link to="/jobs" className="inline-flex items-center text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline mb-3">
          ← Back to Jobs
        </Link>
        {easy ? <EasyPageHeading title="Subcontractor payouts" description="Review paid and outstanding amounts. Open Sub reviews to approve invoices or record payment." /> : <h1 className="text-2xl font-semibold text-slate-900">Sub payouts</h1>}
        <p className="text-sm text-slate-500 mt-1">
          What you've paid (and still owe) to subcontractors. Approve + mark paid happens on the
          {' '}<Link to="/sub-reviews" className="text-amber-700 hover:underline">Sub reviews</Link> page.
        </p>
      </div>

      {error && (
        <div role="alert" className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 mb-4">
          Failed to load: {String((error as Error).message)}
          <button type="button" onClick={() => void refetch()} className="ml-3 underline">Retry</button>
        </div>
      )}

      {isLoading && !data && (
        <div className="text-sm text-slate-500">Loading…</div>
      )}

      {data && !error && (
        <div className="space-y-6">
          {/* Big-number tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tile
              label="Paid · lifetime"
              value={`$${money(data.data.totals.paid_lifetime_cents)}`}
              sub={`${data.data.totals.invoice_count_paid} invoice${data.data.totals.invoice_count_paid === 1 ? '' : 's'}`}
              tone="emerald"
            />
            <Tile
              label="Paid · month to date"
              value={`$${money(data.data.totals.paid_mtd_cents)}`}
              sub="Resets the 1st of each month"
              tone="slate"
            />
            <Tile
              label="Outstanding · approved unpaid"
              value={`$${money(data.data.totals.outstanding_cents)}`}
              sub="Approved invoices waiting for payment"
              tone={data.data.totals.outstanding_cents > 0 ? 'amber' : 'slate'}
            />
          </div>

          {/* Per-sub breakdown */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3">By subcontractor</h2>
            {data.data.per_sub.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
                No subs paid yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Subcontractor</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Paid total</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Invoices paid</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.per_sub.map((s) => (
                      <tr key={s.subcontractor_id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-2 text-slate-900 font-medium">{s.name}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                          ${money(s.paid_cents)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-700">{s.count}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">
                          {s.outstanding_cents > 0 ? (
                            <span className="text-amber-700">${money(s.outstanding_cents)}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Monthly breakdown — last 12 months. Bar = paid total
              that month; tiny bar means quiet month, no bar means
              nothing paid. */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3">By month</h2>
            <MonthlyBars rows={data.data.per_month} />
          </section>

          {/* Invoice history */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3">All invoices</h2>
            {data.data.invoices.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
                No invoices yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">WO</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Subcontractor</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Their inv #</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Total</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Paid via</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.invoices.map((i) => (
                      <tr key={i.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link to={`/jobs/${i.work_order_id}`} className="font-mono text-xs text-amber-700 hover:underline">
                            {i.sub_wo_number ?? i.work_order_id}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-slate-800">{i.subcontractor_name ?? '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">{i.invoice_number}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">${money(i.total_cents)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${
                            i.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {i.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-700">
                          {i.paid_via ? (
                            <span>
                              {i.paid_via.toUpperCase()}
                              {i.paid_reference && <span className="text-slate-500"> · {i.paid_reference}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-slate-500">
                          {i.paid_at ? new Date(i.paid_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'emerald' | 'slate' | 'amber'
}) {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    slate: 'bg-white border-slate-200 text-slate-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }[tone]

  return (
    <div className={`border rounded-lg p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-xs opacity-70 mt-1">{sub}</div>
    </div>
  )
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 12-month bar chart of paid totals. Pure CSS — bar height %
 * computed against the max month so the busiest month always
 * reaches the top. Hover shows the exact dollar amount.
 */
function MonthlyBars({
  rows,
}: {
  rows: Array<{ month: string; label: string; paid_cents: number; invoice_count: number }>
}) {
  const max = Math.max(1, ...rows.map((r) => r.paid_cents))
  const total = rows.reduce((s, r) => s + r.paid_cents, 0)

  if (total === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
        No paid invoices in the last 12 months.
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-end gap-2 h-40 mb-3">
        {rows.map((r) => {
          const pct = r.paid_cents > 0 ? Math.max(2, Math.round((r.paid_cents / max) * 100)) : 0
          return (
            <div key={r.month} className="flex-1 flex flex-col items-center min-w-0">
              <div className="w-full flex items-end h-32" title={`${r.label}: $${money(r.paid_cents)} (${r.invoice_count} invoices)`}>
                <div
                  className={`w-full rounded-t ${r.paid_cents > 0 ? 'bg-emerald-500' : 'bg-slate-100'}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-1 truncate w-full text-center">
                {r.label.split(' ')[0]}
              </div>
              <div className="text-[10px] font-mono text-slate-700 tabular-nums">
                {r.paid_cents > 0 ? `$${shortMoney(r.paid_cents)}` : ''}
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-xs text-slate-500 text-center">
        12-month total: <span className="font-mono font-semibold text-slate-900">${money(total)}</span>
      </div>
    </div>
  )
}

/** Shortened money for the bar labels — 1.2k / 12k / 1.2M. */
function shortMoney(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000) return (dollars / 1_000_000).toFixed(1) + 'M'
  if (dollars >= 1000) return (dollars / 1000).toFixed(dollars >= 10_000 ? 0 : 1) + 'k'
  return dollars.toFixed(0)
}
