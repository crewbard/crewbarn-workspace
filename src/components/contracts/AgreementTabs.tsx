import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * The rest of an agreement: its visits, its money, and what happened.
 *
 * All three already existed in the data and none of it was on screen.
 * That is not a cosmetic gap — a shop looking at an agreement could not
 * answer "when are we next there", "have they paid" or "why did this
 * customer get that", which are the only three questions anybody opens
 * an agreement to ask.
 */

export type AgreementTab = 'overview' | 'visits' | 'equipment' | 'billing' | 'history'

interface Visit {
  id: string
  service_id: string
  service_location_id: string
  due_on: string | null
  status: string
  work_order_id: string | null
}

interface Billing {
  id: string
  period: string
  period_end_on: string | null
  status: string
  amount_cents: number
  invoice_id: string | null
  invoice_number: string | null
  invoice_status: string | null
  billed_at: string | null
  last_error: string | null
}

interface Event {
  id: string
  event: string
  detail: Record<string, unknown> | null
  created_at: string | null
}

const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    // Money shows exact cents. A rounded total is a total that disagrees
    // with the invoice beside it.
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const day = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** What a visit is doing, said the way somebody would say it. */
function visitState(v: Visit): { label: string; tone: string } {
  if (v.status === 'completed') return { label: 'Done', tone: 'bg-emerald-50 text-emerald-700' }
  if (v.status === 'skipped') return { label: 'Skipped', tone: 'bg-slate-100 text-slate-600' }
  if (v.status === 'cancelled') return { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600' }
  if (v.work_order_id) return { label: 'On the board', tone: 'bg-amber-50 text-amber-700' }
  return { label: 'Planned', tone: 'bg-slate-100 text-slate-600' }
}

/** Events are stored as slugs; nobody reads `period_bill_failed`. */
const EVENT_WORDS: Record<string, string> = {
  visits_planned: 'Visit dates placed',
  visit_booked: 'A visit went on the board as a job',
  visit_book_failed: 'A visit could not be put on the board',
  period_billed: 'An invoice was raised for a period',
  period_bill_failed: 'A period could not be billed',
  invoice_issue_failed: 'An invoice could not be issued and stayed a draft',
  renewal_drafted: 'Next year was drafted',
  renewal_notice_fired: 'A renewal notice went out',
  expired: 'The term ended',
  status_changed: 'Status changed',
  service_added: 'A service was added',
  service_updated: 'A service was changed',
  service_removed: 'A service was removed',
}

type CoveredItem = {
  coverage_id: string
  asset_id: string
  name: string
  asset_code: string | null
  type: string | null
  is_secured: boolean
  where: string
  service: { id: string; name: string }
  added_on: string | null
  retired_on: string | null
  last_serviced_at: string | null
  last_service_result: string | null
  open_priority: string | null
  open_needs: { what: string | null; state: string; priority: string | null }[]
  scan_url: string | null
}

type VisitItem = {
  asset_id: string
  name: string
  asset_code: string | null
  /** done | skipped | failed | not_found */
  result: string
  notes: string | null
  entries: {
    kind: string
    summary: string | null
    result: string | null
    part_name: string | null
    part_quantity: string | null
    part_unit: string | null
    need_status: string | null
    priority: string | null
    visibility: string
    at: string | null
    by: string | null
  }[]
}

/** The verdict, in the words somebody would use out loud. */
const RESULT_WORDS: Record<string, { label: string; tone: string }> = {
  done: { label: 'Serviced', tone: 'bg-emerald-50 text-emerald-700' },
  skipped: { label: 'Not serviced', tone: 'bg-amber-50 text-amber-700' },
  failed: { label: 'Left not working', tone: 'bg-red-50 text-red-700' },
  not_found: { label: 'No record', tone: 'bg-slate-100 text-slate-600' },
}

export function AgreementTabs({
  contractId,
  tab,
  onTab,
  locationLabels,
  serviceNames,
}: {
  contractId: string
  tab: AgreementTab
  onTab: (t: AgreementTab) => void
  locationLabels: Record<string, string>
  serviceNames: Record<string, string>
}) {
  const visits = useQuery({
    queryKey: ['contract-visits', contractId],
    queryFn: () => apiRequest<{ data: Visit[]; total: number }>(`/v1/maintenance-contracts/${contractId}/visits`),
  })

  const billings = useQuery({
    queryKey: ['contract-billings', contractId],
    enabled: tab === 'billing' || tab === 'overview',
    queryFn: () => apiRequest<{ data: Billing[] }>(`/v1/maintenance-contracts/${contractId}/billings`),
  })

  const history = useQuery({
    queryKey: ['contract-history', contractId],
    enabled: tab === 'history',
    queryFn: () => apiRequest<{ data: Event[] }>(`/v1/maintenance-contracts/${contractId}/history`),
  })

  const equipment = useQuery({
    queryKey: ['contract-equipment', contractId],
    enabled: tab === 'equipment',
    queryFn: () => apiRequest<{ data: CoveredItem[] }>(`/v1/maintenance-contracts/${contractId}/equipment`),
  })

  /*
   * Which visit is open. One at a time: a contract with sixteen visits
   * expanded at once is a wall nobody reads, and the question being asked
   * is always about one visit.
   */
  const [openVisit, setOpenVisit] = useState<string | null>(null)

  const visitItems = useQuery({
    queryKey: ['contract-visit-items', contractId, openVisit],
    enabled: !!openVisit,
    queryFn: () =>
      apiRequest<{ data: { items: VisitItem[] } }>(
        `/v1/maintenance-contracts/${contractId}/visits/${openVisit}/items`,
      ),
  })

  const rows = visits.data?.data ?? []
  const bills = billings.data?.data ?? []

  const billed = bills.filter((b) => b.status === 'billed')
  const paid = billed.filter((b) => b.invoice_status === 'paid')
  const next = bills.find((b) => b.status !== 'billed')

  return (
    <>
      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {(['overview', 'visits', 'equipment', 'billing', 'history'] as AgreementTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? 'border-amber-500 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-navy-900">Coming up</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              A visit goes on the board as a job 14 days before it is due.
            </p>
            {visits.isPending && <p className="mt-3 text-sm text-slate-500">Loading…</p>}
            {!visits.isPending && rows.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">
                No visits placed yet. An agreement only books work once it is active.
              </p>
            )}
            <ul className="mt-2 divide-y divide-slate-100">
              {rows
                .filter((v) => v.status === 'planned' || v.status === 'scheduled')
                .slice(0, 5)
                .map((v) => {
                  const state = visitState(v)
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-800">
                          {serviceNames[v.service_id] ?? 'Service'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {day(v.due_on)} · {locationLabels[v.service_location_id] ?? 'Property'}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${state.tone}`}>
                        {state.label}
                      </span>
                    </li>
                  )
                })}
            </ul>
            {rows.length > 5 && (
              <button
                type="button"
                onClick={() => onTab('visits')}
                className="mt-2 text-sm font-semibold text-amber-700 hover:underline"
              >
                See all {visits.data?.total ?? rows.length} visits
              </button>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-navy-900">Money</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              The fee covers the visits — they are never invoiced one by one.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billed</p>
                <p className="mt-0.5 text-lg font-bold text-navy-900">
                  {money(billed.reduce((t, b) => t + b.amount_cents, 0))}
                </p>
                <p className="text-xs text-slate-500">{billed.length} invoice{billed.length === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid</p>
                <p className="mt-0.5 text-lg font-bold text-emerald-700">
                  {money(paid.reduce((t, b) => t + b.amount_cents, 0))}
                </p>
                <p className="text-xs text-slate-500">{paid.length} of {billed.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next</p>
                <p className="mt-0.5 text-lg font-bold text-navy-900">{next ? day(next.period) : '—'}</p>
                {/* A period row only exists once it has been billed, so
                    "nothing queued" would read as if billing had stopped
                    when really the next period simply has not begun. */}
                <p className="text-xs text-slate-500">
                  {next ? money(next.amount_cents) : 'When the next period starts'}
                </p>
              </div>
            </div>
            {bills.length > 0 && (
              <button
                type="button"
                onClick={() => onTab('billing')}
                className="mt-3 text-sm font-semibold text-amber-700 hover:underline"
              >
                See every period
              </button>
            )}
          </section>
        </div>
      )}

      {tab === 'visits' && (
        <section className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {visits.isPending && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!visits.isPending && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">
              No visits yet. Dates are placed when the agreement is active.
            </p>
          )}
          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Service</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Property</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">State</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Job</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((v) => {
                  const state = visitState(v)
                  return (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-navy-800">{day(v.due_on)}</td>
                      <td className="px-4 py-2.5 text-slate-700">{serviceNames[v.service_id] ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {locationLabels[v.service_location_id] ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.tone}`}>
                          {state.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {v.work_order_id ? (
                          <Link
                            to={`/jobs/${v.work_order_id}`}
                            className="text-sm font-semibold text-amber-700 hover:underline"
                          >
                            Open
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {/* Only a visit that happened has anything to show.
                            A button on a date in March is a promise the
                            page cannot keep. */}
                        {v.work_order_id ? (
                          <button
                            type="button"
                            onClick={() => setOpenVisit(openVisit === v.id ? null : v.id)}
                            className="text-sm font-semibold text-slate-600 hover:text-navy-900"
                          >
                            {openVisit === v.id ? 'Hide' : 'What was done'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {openVisit && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50/70 px-4 py-3">
                      <VisitItems
                        loading={visitItems.isPending}
                        items={visitItems.data?.data.items ?? []}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'equipment' && (
        <section className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {equipment.isPending && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!equipment.isPending && (equipment.data?.data.length ?? 0) === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">
              No equipment is attached to this agreement yet. Add it to a service to have it
              covered, scheduled and reported on.
            </p>
          )}
          {(equipment.data?.data.length ?? 0) > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Item</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Where</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Service</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Last serviced</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Outstanding</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Covered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipment.data!.data.map((item) => (
                  <tr key={item.coverage_id} className={item.retired_on ? 'opacity-60' : undefined}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-navy-800">{item.name}</div>
                      <div className="text-xs text-slate-500">
                        {[item.type, item.asset_code].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{item.where || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.service.name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {item.last_serviced_at ? (
                        <>
                          {day(item.last_serviced_at)}
                          {item.last_service_result && (
                            <div className="text-xs text-slate-500">{item.last_service_result.replace(/_/g, ' ')}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.open_needs.length === 0 ? (
                        <span className="text-xs text-slate-400">Nothing</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {item.open_needs.slice(0, 3).map((need, i) => (
                            <li key={i} className="text-xs text-amber-800">
                              {need.what}
                              {need.state !== 'needed' && ` (${need.state})`}
                            </li>
                          ))}
                          {item.open_needs.length > 3 && (
                            <li className="text-xs text-slate-500">
                              and {item.open_needs.length - 3} more
                            </li>
                          )}
                        </ul>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {/* Retired coverage stays on the list, below the
                          line. "We took that out of the plan in August" is
                          exactly the question somebody asks in November,
                          and an item that silently disappears looks like
                          it was never covered at all. */}
                      {item.retired_on ? (
                        <span className="text-slate-500">
                          Until {day(item.retired_on)}
                        </span>
                      ) : (
                        <span>From {item.added_on ? day(item.added_on) : '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'billing' && (
        <section className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {billings.isPending && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!billings.isPending && bills.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">
              Nothing billed yet. A period is invoiced once it has begun.
            </p>
          )}
          {bills.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Period</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">State</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-navy-800">
                      {day(b.period)}
                      {b.period_end_on && <span className="text-slate-400"> – {day(b.period_end_on)}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-navy-800">{money(b.amount_cents)}</td>
                    <td className="px-4 py-2.5">
                      {/* The INVOICE's status is the one that says whether
                          the shop has been paid. The billing row only knows
                          whether it managed to raise it. */}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          b.invoice_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : b.status === 'failed'
                              ? 'bg-rose-50 text-rose-700'
                              : b.status === 'billed'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.invoice_status === 'paid'
                          ? 'Paid'
                          : b.status === 'billed'
                            ? b.invoice_status === 'draft'
                              ? 'Draft invoice'
                              : 'Invoiced'
                            : b.status === 'failed'
                              ? 'Could not bill'
                              : 'Upcoming'}
                      </span>
                      {b.last_error && <p className="mt-1 text-xs text-rose-600">{b.last_error}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {b.invoice_id ? (
                        <Link
                          to={`/accounting/invoices?open=${b.invoice_id}`}
                          className="text-sm font-semibold text-amber-700 hover:underline"
                        >
                          {b.invoice_number ?? 'Open'}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          {history.isPending && <p className="text-sm text-slate-500">Loading…</p>}
          {!history.isPending && (history.data?.data.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Nothing has happened yet.</p>
          )}
          <ul className="divide-y divide-slate-100">
            {(history.data?.data ?? []).map((e) => (
              <li key={e.id} className="py-2.5">
                <p className="text-sm font-medium text-navy-800">{EVENT_WORDS[e.event] ?? e.event}</p>
                <p className="text-xs text-slate-500">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                </p>
                {e.detail?.error != null && (
                  <p className="mt-0.5 text-xs text-rose-600">{String(e.detail.error)}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** The tab the page opens on, kept out of the URL for now. */
export function useAgreementTab() {
  return useState<AgreementTab>('overview')
}

/**
 * What was done to each item on one visit.
 *
 * The verdict comes from the visit record, written when the job
 * completed; the lines under it are the tech's own words from the
 * service log. No prices: this is work under an agreement whose fee is
 * already agreed, and a number here would be one nobody is paying.
 */
function VisitItems({ loading, items }: { loading: boolean; items: VisitItem[] }) {
  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No equipment was recorded on this visit.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const verdict = RESULT_WORDS[item.result] ?? RESULT_WORDS.not_found
        return (
          <li key={item.asset_id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-navy-800">{item.name}</span>
              {item.asset_code && (
                <span className="font-mono text-xs text-slate-500">{item.asset_code}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${verdict.tone}`}>
                {verdict.label}
              </span>
            </div>
            {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
            {item.entries.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.entries.map((entry, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <span className="text-slate-500">{entry.kind.replace(/_/g, ' ')}</span>
                    {entry.summary && <span> — {entry.summary}</span>}
                    {entry.part_name && (
                      <span className="text-slate-500">
                        {' '}({[entry.part_quantity, entry.part_unit, entry.part_name]
                          .filter(Boolean)
                          .join(' ')})
                      </span>
                    )}
                    {entry.need_status && entry.need_status !== 'needed' && (
                      <span className="ml-1 text-xs text-amber-700">{entry.need_status}</span>
                    )}
                    {entry.visibility === 'internal' && (
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        Internal
                      </span>
                    )}
                    {entry.by && <span className="ml-1 text-xs text-slate-400">{entry.by}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
