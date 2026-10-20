import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest, type ApiError } from '@/lib/api'

/**
 * Floating panel on the dispatch board showing incoming marketplace
 * estimate requests for the acting tenant. Vendor inline-submits a
 * quote or declines without leaving the board. Hides itself when
 * zero pending.
 */

interface Invitation {
  id: string
  status: 'pending' | 'viewed' | 'declined' | 'quoted' | 'awarded' | 'lost'
  quote_cents: number | null
  customer_id?: string | null
  estimate_id?: string | null
  work_order_id?: string | null
  submitted_at: string | null
  awarded_at: string | null
  /** Awarded and already scheduled/closed here — nothing left to do on the board. */
  handled?: boolean
  created_at: string | null
  request: {
    id: string
    title: string
    description: string | null
    priority: string
    request_kind?: 'estimate' | 'service' | 'service_plan'
    plan_rhythm?: { interval_count?: number; interval_unit?: string; time_window?: string | null; blackout_months?: number[] } | null
    their_work_order_number: string | null
    their_po_number: string | null
    deadline: string | null
    service: {
      street: string | null
      city: string | null
      state: string | null
      zip: string
    }
    requester?: {
      name: string
      email: string
      phone: string | null
    }
  } | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dollars(c: number | null): string {
  if (c === null) return '—'
  if (c === 0) return 'On-site estimate'
  return '$' + (c / 100).toFixed(2)
}

/**
 * Awarded rows stay (up to a week) only until the office has acted on
 * them — scheduled the job, or moved the estimate along. Then they're gone.
 */
function recentlyAwarded(i: Invitation): boolean {
  if (i.status !== 'awarded' || !i.awarded_at || i.handled) return false
  return Date.now() - new Date(i.awarded_at).getTime() < 7 * 86400 * 1000
}

export function IncomingEstimateRequestsPanel() {
  const q = useQuery({
    queryKey: ['incoming-estimate-requests'],
    queryFn: () =>
      apiRequest<{ data: Invitation[] }>('/v1/estimate-requests/incoming'),
    refetchInterval: 30000,
  })

  const requests = q.data?.data ?? []
  const active = requests.filter((i) => ['pending', 'viewed', 'quoted'].includes(i.status) || recentlyAwarded(i))
  if (q.isLoading || active.length === 0) return null

  return (
    <section data-tour="dash-incoming-marketplace" className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">
          Estimate requests · {active.length}
        </h3>
        <span className="text-[11px] text-blue-700">From marketplace</span>
      </div>
      <div className="space-y-3">
        {active.map((i) => (
          <InvitationRow key={i.id} inv={i} />
        ))}
      </div>
    </section>
  )
}

function InvitationRow({ inv }: { inv: Invitation }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'idle' | 'quote' | 'decline'>('idle')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [validity, setValidity] = useState('30')
  const [reason, setReason] = useState('')
  // A service plan answer: what the price is per, visits, months, cover, terms.
  const isPlan = inv.request?.request_kind === 'service_plan'
  const [per, setPer] = useState<'month' | 'quarter' | 'year' | 'visit'>('month')
  const [visits, setVisits] = useState('')
  const [months, setMonths] = useState<number[]>([])
  const [coverage, setCoverage] = useState('')
  const [terms, setTerms] = useState('')
  const [termMonths, setTermMonths] = useState('12')

  const submit = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/estimate-requests/${inv.id}/submit`, {
        method: 'POST',
        body: {
          quote_cents: Math.round(Number(amount) * 100),
          quote_notes: notes.trim() || null,
          quote_validity_days: validity ? Number(validity) : null,
          ...(isPlan
            ? {
                plan_price_per: per,
                plan_visits_per_year: visits ? Number(visits) : null,
                plan_visit_months: months,
                plan_coverage: coverage.trim() || null,
                plan_terms: terms.trim() || null,
                plan_term_months: termMonths ? Number(termMonths) : null,
              }
            : {}),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incoming-estimate-requests'] })
      // A sole-provider request awards itself on quote: the estimate/job
      // now exists, so the board and the customer's account change too.
      qc.invalidateQueries({ queryKey: ['dispatch-board'] })
      qc.invalidateQueries({ queryKey: ['estimates'] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      setMode('idle')
    },
  })

  const decline = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/estimate-requests/${inv.id}/decline`, {
        method: 'POST',
        body: { reason: reason.trim() || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incoming-estimate-requests'] })
      setMode('idle')
    },
  })

  const busy = submit.isPending || decline.isPending
  const r = inv.request

  return (
    <div data-tour="dispatch-market-request" data-kind={isPlan ? 'plan' : 'one-off'} data-status={inv.status} className="bg-white border border-blue-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-navy-900">{r?.title ?? 'Estimate request'}</h4>
          {r?.requester && (
            <div className="text-xs text-slate-600 mt-0.5">
              {r.requester.name} · {r.requester.email}
              {r.requester.phone && ` · ${r.requester.phone}`}
            </div>
          )}
          {r && (
            <div className="text-xs text-slate-500 mt-0.5">
              {[r.service.street, r.service.city, r.service.state, r.service.zip].filter(Boolean).join(', ')}
              {' · '}{r.priority}
              {r.deadline && ` · need by ${r.deadline}`}
            </div>
          )}
          {r && (r.their_work_order_number || r.their_po_number) && (
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              {r.their_work_order_number && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                  <strong>WO#</strong> {r.their_work_order_number}
                </span>
              )}
              {r.their_po_number && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                  <strong>PO#</strong> {r.their_po_number}
                </span>
              )}
            </div>
          )}
          {isPlan && r?.plan_rhythm && (
            <div data-tour="dispatch-market-plan" className="mt-1 text-xs font-medium text-teal-800">
              Service plan · every {r.plan_rhythm.interval_count ?? 1} {r.plan_rhythm.interval_unit ?? 'month'}
              {(r.plan_rhythm.interval_count ?? 1) > 1 ? 's' : ''}
              {r.plan_rhythm.time_window ? ` · ${r.plan_rhythm.time_window}s` : ''}
              {r.plan_rhythm.blackout_months?.length ? ` · not ${r.plan_rhythm.blackout_months.map((m) => MONTHS[m - 1]).join(', ')}` : ''}
            </div>
          )}
          {r?.description && (
            <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap line-clamp-4">
              {r.description}
            </p>
          )}
        </div>
        {inv.status === 'quoted' && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded whitespace-nowrap">
            Quoted {dollars(inv.quote_cents)} · waiting on customer
          </span>
        )}
        {inv.status === 'awarded' && (
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded whitespace-nowrap">
            You got it
          </span>
        )}
      </div>

      {inv.status === 'awarded' && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          {inv.estimate_id && (
            <Link to={`/estimates/${inv.estimate_id}`} className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Open estimate → schedule the visit
            </Link>
          )}
          {inv.work_order_id && (
            <Link to={`/jobs/${inv.work_order_id}`} className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Open job → schedule it
            </Link>
          )}
          {inv.customer_id && (
            <Link to={`/customers/${inv.customer_id}`} className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
              Customer account
            </Link>
          )}
          {isPlan && (
            <Link to="/maintenance-contracts?tab=requests" className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Open Plan requests → write up the agreement
            </Link>
          )}
          {!isPlan && !inv.estimate_id && !inv.work_order_id && (
            <span className="text-slate-500">Awarded before this was wired up: open the customer and add the estimate by hand.</span>
          )}
        </div>
      )}

      {(submit.isError || decline.isError) && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-2">
          {((submit.error ?? decline.error) as ApiError)?.message ?? 'Action failed.'}
        </div>
      )}

      {mode === 'idle' && inv.status !== 'quoted' && inv.status !== 'awarded' && (
        <div data-tour="dispatch-market-actions" className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            onClick={() => { setAmount('0'); setNotes((n) => n || 'We need to see it first: free on-site estimate, no obligation.'); setMode('quote') }}
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            title="No price yet: offer to come look"
          >
            Offer on-site estimate
          </button>
          <button
            type="button"
            onClick={() => setMode('quote')}
            className="text-xs px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            Quote a price
          </button>
          <button
            type="button"
            onClick={() => setMode('decline')}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Pass
          </button>
        </div>
      )}

      {mode === 'idle' && inv.status === 'quoted' && (
        <button
          type="button"
          onClick={() => {
            setAmount(((inv.quote_cents ?? 0) / 100).toFixed(2))
            setMode('quote')
          }}
          className="text-xs text-amber-700 hover:underline"
        >
          Revise quote
        </button>
      )}

      {mode === 'quote' && (
        <div className="space-y-2 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 text-sm rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="number"
              min={1}
              max={365}
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
              className="w-16 text-sm rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              title="Valid days"
            />
            <span className="text-xs text-slate-500">days valid</span>
          </div>
          {isPlan && (
            <div data-tour="dispatch-market-plan-fields" className="space-y-2 rounded-md border border-teal-100 bg-teal-50/50 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <span>The price is per</span>
                <select value={per} onChange={(e) => setPer(e.target.value as typeof per)} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="month">month</option>
                  <option value="quarter">quarter</option>
                  <option value="year">year</option>
                  <option value="visit">visit</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={visits}
                  onChange={(e) => setVisits(e.target.value)}
                  placeholder="Visits"
                  className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <span>visits a year, for</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <span>months</span>
              </div>
              <div className="flex flex-wrap gap-1" aria-label="Months the visits fall in">
                {MONTHS.map((m, i) => {
                  const on = months.includes(i + 1)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths((cur) => (on ? cur.filter((x) => x !== i + 1) : [...cur, i + 1].sort((a, b) => a - b)))}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${on ? 'bg-teal-600 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
              <textarea
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
                rows={2}
                placeholder="What is covered: the equipment, the checks, reports…"
                className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={2}
                placeholder="Terms: notice to cancel, renewal, parts and repairs…"
                className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Scope / assumptions / exclusions (optional)…"
            className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => submit.mutate()}
              disabled={busy || amount === '' || Number(amount) < 0}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
            >
              {submit.isPending ? 'Submitting…' : Number(amount) === 0 ? 'Offer on-site estimate' : 'Send quote'}
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'decline' && (
        <div className="space-y-2 mt-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional, shown to customer)…"
            className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => decline.mutate()}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
            >
              {decline.isPending ? 'Declining…' : 'Confirm decline'}
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
