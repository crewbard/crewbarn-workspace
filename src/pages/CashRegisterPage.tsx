import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { OfficeDrawer } from '@/components/accounting/OfficeDrawer'

/**
 * Cash register — everything physical, before it reaches the bank.
 *
 * Three views because there are three different piles, and conflating them is
 * how money goes missing:
 *
 *   Tech tills          — cash and checks still out in trucks
 *   Office drawer       — what the office is physically holding
 *   Work done, no money — COD jobs that finished with nothing collected
 *
 * The last one is the reason this page earns its place. A job that was never
 * invoiced is invisible to A/R: it isn't overdue, because it was never billed,
 * so it appears in no aging report, no overdue count, and no statement. The
 * tech's phone already blocks on it; the office had no list.
 */

type View = 'tills' | 'drawer' | 'uncollected'

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

interface PaymentRow {
  id: string
  amount_cents: number
  payment_method: string | null
  collected_by_account_id?: string | null
  collected_by_name?: string | null
  work_order_number?: string | null
  customer_name?: string | null
  created_at?: string | null
}

interface UncollectedRow {
  id: string
  number: string | number
  title: string | null
  customer_name: string
  invoice_id: string | null
  reason: 'never_invoiced' | 'invoiced_unpaid'
  owed_cents: number
  completed_at: string | null
  days_since: number | null
  blocking: boolean
  tech_name: string | null
}

const TABS: { id: View; label: string; icon: string[] }[] = [
  {
    id: 'tills',
    label: 'Tech tills',
    icon: ['M2.5 7.5h10v8h-10z', 'M12.5 10h3.5l3.5 3.5v2h-7z', 'M6 18.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M17 18.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2'],
  },
  {
    id: 'drawer',
    label: 'Office drawer',
    icon: ['M3.5 4.5h17v5h-17zM3.5 14.5h17v5h-17z', 'M10 7h4M10 17h4'],
  },
  {
    id: 'uncollected',
    label: 'Work done, no money',
    icon: ['M12 4.2 2.8 20h18.4z', 'M12 10v4.5M12 17.2v.1'],
  },
]

function TabIcon({ d }: { d: string[] }) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" aria-hidden="true" className="shrink-0">
      {d.map((p) => (
        <path key={p} d={p} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function CashRegisterPage() {
  const [view, setView] = useState<View>('tills')
  const qc = useQueryClient()
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const tills = useQuery({
    queryKey: ['register', 'tills'],
    queryFn: () =>
      apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=pending_turnover&per_page=100'),
  })
  const uncollected = useQuery({
    queryKey: ['register', 'uncollected'],
    queryFn: () =>
      apiRequest<{ data: UncollectedRow[]; meta: { total_owed_cents: number; blocking_count: number } }>(
        '/v1/work-orders/uncollected?per_page=50',
      ),
  })

  // One till per tech: the payments they're holding, grouped by who took them.
  const byTech = useMemo(() => {
    const groups = new Map<string, { name: string; rows: PaymentRow[] }>()
    for (const p of tills.data?.data ?? []) {
      const key = p.collected_by_account_id ?? p.collected_by_name ?? 'unknown'
      const name = p.collected_by_name ?? 'Unassigned'
      if (!groups.has(key)) groups.set(key, { name, rows: [] })
      groups.get(key)!.rows.push(p)
    }
    return [...groups.entries()].map(([id, g]) => ({
      id,
      name: g.name,
      rows: g.rows,
      total: g.rows.reduce((n, r) => n + r.amount_cents, 0),
      cash: g.rows.filter((r) => (r.payment_method ?? '') === 'cash').reduce((n, r) => n + r.amount_cents, 0),
      checks: g.rows.filter((r) => (r.payment_method ?? '').includes('check')).reduce((n, r) => n + r.amount_cents, 0),
    }))
  }, [tills.data])

  const outInTrucks = byTech.reduce((n, t) => n + t.total, 0)

  const takeIn = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiRequest(`/v1/payments/${id}/mark-received`, { method: 'PATCH' })
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not take that in.'),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['register'] })
    },
  })

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B45309]">Money in</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="mt-1 text-[25px] font-extrabold tracking-[-0.02em] text-[#0A1220]">
            Cash register
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">
            {view === 'tills' &&
              'One till per person. Cash and checks sit here from the moment they are collected — by a tech or by you — until someone physically takes the money and counts it in.'}
            {view === 'drawer' &&
              "Everything the office is physically holding: money taken in off the trucks, net-30 checks from the mail, and payments taken at the counter. It stays here until you deposit it."}
            {view === 'uncollected' &&
              'COD jobs the crew closed out where no money ever came in. Not overdue invoices — these are finished jobs nobody collected on, and they are invisible until someone goes looking.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
            {view === 'uncollected' ? 'Never collected' : 'Collected, not checked in'}
          </p>
          <p className="tnum mt-0.5 text-[22px] font-extrabold text-[#B45309]">
            {view === 'uncollected'
              ? money(uncollected.data?.meta?.total_owed_cents ?? 0)
              : money(outInTrucks)}
          </p>
        </div>
      </div>

      {/* view switch */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = view === t.id
          const count =
            t.id === 'tills'
              ? byTech.length
              : t.id === 'uncollected'
                ? (uncollected.data?.data?.length ?? 0)
                : 0
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={[
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13.5px] font-bold transition',
                on
                  ? 'border-[#E8902C] bg-[#FDF3E4] text-[#86521A]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <TabIcon d={t.icon} />
              {t.label}
              {count > 0 && (
                <span
                  className={[
                    'tnum rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                    on ? 'bg-[#E8902C] text-white' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-[11px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {error}
        </div>
      )}

      {/* ── tech tills ── */}
      {view === 'tills' && (
        <div className="mt-5">
          {tills.isLoading && <p className="text-sm text-slate-500">Loading tills…</p>}
          {!tills.isLoading && byTech.length === 0 && (
            <div className="rounded-[13px] border border-[#A7D9B8] bg-[#EFF7F1] px-5 py-4 text-[14px] font-bold text-[#166534]">
              Nothing is being held. Every till is counted in.
            </div>
          )}

          {/* A card appears only when someone is holding money — a wall of
              zeroes would bury the two people you need. But absence has to be
              legible, or "no card" reads the same as "no data". */}
          {!tills.isLoading && byTech.length > 0 && (
            <p className="mb-3 text-[12.5px] text-slate-500">
              {byTech.length} {byTech.length === 1 ? 'person is' : 'people are'} holding money.
              Anyone not listed has nothing to hand in — a till appears the moment a payment
              reaches CrewBarn, so a collection taken offline shows once that phone syncs.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {byTech.map((t) => {
              const key = t.id
              const typed = counted[key] ?? String((t.total / 100).toFixed(2))
              return (
                <section key={key} className="rounded-[13px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDF3E4] text-[11px] font-extrabold text-[#86521A]">
                      {t.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-[#0A1220]">{t.name}</span>
                      <span className="block text-[12px] text-slate-500">
                        {t.rows.length} payment{t.rows.length === 1 ? '' : 's'} holding
                      </span>
                    </span>
                    <span className="tnum shrink-0 rounded-full bg-[#FDF3E4] px-2.5 py-1 text-[11.5px] font-bold text-[#86521A]">
                      {money(t.total)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cash</p>
                      <p className="tnum text-[15px] font-bold text-[#0A1220]">{money(t.cash)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Checks</p>
                      <p className="tnum text-[15px] font-bold text-[#0A1220]">{money(t.checks)}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    What they're holding
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {t.rows.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 text-[12.5px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8902C]" />
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {[r.work_order_number ? `WO-${r.work_order_number}` : null, r.customer_name, r.payment_method]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="tnum shrink-0 font-semibold text-[#0A1220]">
                          {money(r.amount_cents)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 rounded-lg border border-[#F0D9AE] bg-[#FFFCF7] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-[#86521A]">Count it in</span>
                      <span className="tnum text-[12px] text-slate-500">Expected {money(t.total)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-slate-500">$</span>
                      <input
                        value={typed}
                        onChange={(e) => setCounted((c) => ({ ...c, [key]: e.target.value }))}
                        inputMode="decimal"
                        className="tnum min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-[14px]"
                      />
                      <button
                        type="button"
                        disabled={takeIn.isPending}
                        onClick={() => takeIn.mutate(t.rows.map((r) => r.id))}
                        className="shrink-0 rounded-md bg-[#E8902C] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                      >
                        {takeIn.isPending ? 'Working…' : 'Take it in'}
                      </button>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
                      Type what you actually counted. If it doesn't match, CrewBarn records the
                      difference instead of silently accepting it.
                    </p>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {view === 'drawer' && <OfficeDrawer />}

      {/* ── work done, no money ── */}
      {view === 'uncollected' && (
        <div className="mt-5">
          {uncollected.isLoading && <p className="text-sm text-slate-500">Checking closed jobs…</p>}

          {(uncollected.data?.meta?.blocking_count ?? 0) > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-[11px] border border-rose-200 bg-rose-50 px-4 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#9F1239] text-[11px] font-extrabold text-white">
                !
              </span>
              <p className="text-[13px] text-[#9F1239]">
                {uncollected.data!.meta.blocking_count} of these {uncollected.data!.meta.blocking_count === 1 ? 'is' : 'are'} blocking a
                tech from starting their next job. Settle or override it from Dispatch.
              </p>
            </div>
          )}

          {!uncollected.isLoading && (uncollected.data?.data?.length ?? 0) === 0 && (
            <div className="rounded-[13px] border border-[#A7D9B8] bg-[#EFF7F1] px-5 py-4 text-[14px] font-bold text-[#166534]">
              Every closed COD job has been collected on.
            </div>
          )}

          {(uncollected.data?.data?.length ?? 0) > 0 && (
            <div className="overflow-hidden rounded-[13px] border border-slate-200 bg-white">
              <div className="flex items-baseline gap-2 px-5 py-3.5">
                <span className="text-[14px] font-extrabold text-[#0A1220]">
                  Finished jobs with nothing collected
                </span>
                <span className="tnum text-[12.5px] text-slate-500">
                  {uncollected.data!.data.length} jobs · {money(uncollected.data!.meta.total_owed_cents)}
                </span>
              </div>

              {uncollected.data!.data.map((r, i) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                  style={{
                    borderTop: '1px solid #F1F5F9',
                    background: (r.days_since ?? 0) >= 7 ? '#FFFCF7' : '#fff',
                    marginTop: i === 0 ? 0 : undefined,
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tnum text-[12.5px] font-medium text-slate-500">
                        WO-{r.number}
                      </span>
                      <span className="text-[14px] font-bold text-[#0A1220]">{r.customer_name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={
                          r.reason === 'never_invoiced'
                            ? { background: '#FBE8ED', color: '#9F1239' }
                            : { background: '#FDF3E4', color: '#86521A' }
                        }
                      >
                        {r.reason === 'never_invoiced' ? 'Never invoiced' : 'Invoiced, nothing paid'}
                      </span>
                      {r.blocking && (
                        <span className="rounded-full bg-[#FBE8ED] px-2 py-0.5 text-[10.5px] font-bold text-[#9F1239]">
                          Blocking {r.tech_name ?? 'a tech'}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      {[r.tech_name, r.days_since !== null ? `closed ${r.days_since} day${r.days_since === 1 ? '' : 's'} ago` : null, 'COD']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>

                  <span className="tnum shrink-0 text-[15px] font-bold text-[#0A1220]">
                    {money(r.owed_cents)}
                  </span>

                  <Link
                    to={r.invoice_id ? `/accounting/invoices/${r.invoice_id}` : `/jobs/${r.id}`}
                    className="shrink-0 rounded-md bg-[#E8902C] px-3.5 py-2 text-[12.5px] font-bold text-white"
                  >
                    {r.reason === 'never_invoiced' ? 'Invoice it' : 'Open invoice'}
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-[13px] border-l-4 border-[#E8902C] border-y border-r border-slate-200 bg-white p-5">
            <p className="text-[14px] font-bold text-[#0A1220]">Why this list has to exist</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              A job that was never invoiced is invisible to A/R — it isn't overdue, because it was
              never billed. It won't show up in aging, in the overdue count, or on a statement. The
              only trace is a closed work order with line items and no payment.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              The app already enforces this on the tech's phone: the COD gate stops them starting
              the next job while one is unsettled, and dispatch can override it. This is the office
              view of the same thing, so the answer isn't "whoever remembers".
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
