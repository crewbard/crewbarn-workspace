import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * What customers have asked for, and turning one into a proposal.
 *
 * A request is not a contract and not a job. It is somebody saying what
 * they want, with enough structure that writing the agreement is a copy
 * rather than a re-typing — which is the step where "not July, Tuesdays,
 * mornings" quietly becomes "quarterly".
 *
 * So this screen shows the schedule they asked for in full, beside the
 * button that turns it into a draft. The office is deciding whether to
 * write a plan; the detail is the decision.
 */

interface PlanRequestProperty {
  id: string
  label: string
  address: string | null
  items: { id: string; name: string; tag: string | null }[]
  whole_property: boolean
}

interface PlanRequest {
  id: string
  status: 'new' | 'proposed' | 'declined' | 'withdrawn'
  customer: { id: string; name: string | null }
  note: string | null
  rhythm: string
  preferred_weekdays: number[]
  time_window: string | null
  blackout_months: number[]
  extras: Record<string, unknown>
  properties: PlanRequestProperty[]
  contract_id: string | null
  response_note: string | null
  asked_at: string | null
  responded_at: string | null
}

/** ISO-8601: 1 is Monday. The same convention the rules table uses. */
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-amber-50 text-amber-800',
  proposed: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-slate-100 text-slate-500',
  withdrawn: 'bg-slate-100 text-slate-500',
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''

export function PlanRequestsTab() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const requests = useQuery({
    queryKey: ['service-plan-requests'],
    queryFn: () => apiRequest<{ data: PlanRequest[]; waiting: number }>('/v1/service-plan-requests'),
  })

  const propose = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: { contract_id: string } }>(`/v1/service-plan-requests/${id}/start-proposal`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['service-plan-requests'] })
      void qc.invalidateQueries({ queryKey: ['maintenance-contracts'] })
      // Straight into the draft. The office clicked this to write the
      // agreement, not to be told one exists somewhere.
      navigate(`/maintenance-contracts/${res.data.contract_id}`)
    },
    onError: (e: Error) => setError(e.message),
  })

  const decline = useMutation({
    mutationFn: (vars: { id: string; note: string }) =>
      apiRequest(`/v1/service-plan-requests/${vars.id}/decline`, {
        method: 'POST',
        body: { note: vars.note || null },
      }),
    onSuccess: () => {
      setDecliningId(null)
      setDeclineNote('')
      void qc.invalidateQueries({ queryKey: ['service-plan-requests'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const rows = requests.data?.data ?? []

  if (requests.isPending) {
    return <p className="mt-6 text-sm text-slate-500">Loading requests…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
        Nobody has asked for a service plan yet. When a customer asks from their portal, it lands
        here with the schedule they wanted, and one click turns it into a draft agreement.
      </p>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}

      {rows.map((r) => (
        <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy-950">{r.customer.name ?? 'Customer'}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Asked {when(r.asked_at)}
                {r.responded_at ? ` · answered ${when(r.responded_at)}` : ''}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.status]}`}>
              {r.status}
            </span>
          </header>

          {/* The schedule, in full. This is the part that does not survive
              a telephone call, so it is the part shown largest. */}
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-semibold text-slate-500">How often</dt>
              <dd className="font-semibold text-navy-900">{r.rhythm}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-slate-500">Time of day</dt>
              <dd className="text-slate-700">{r.time_window ?? 'Any time'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-slate-500">Best days</dt>
              <dd className="text-slate-700">
                {r.preferred_weekdays.length > 0
                  ? r.preferred_weekdays.map((d) => DAYS[d]).join(', ')
                  : 'Any day'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-slate-500">Closed</dt>
              <dd className="text-slate-700">
                {r.blackout_months.length > 0
                  ? r.blackout_months.map((m) => MONTHS[m]).join(', ')
                  : 'Never'}
              </dd>
            </div>
          </dl>

          <ul className="mt-3 space-y-1 text-[13px]">
            {r.properties.map((p) => (
              <li key={p.id} className="text-slate-700">
                <span className="font-semibold text-navy-900">{p.label}</span>
                {p.address && p.address !== p.label && (
                  <span className="text-slate-500"> — {p.address}</span>
                )}
                <span className="text-slate-600">
                  {/* "Everything here" is the common answer and has to read
                      as an answer, not as an empty list. */}
                  {p.whole_property
                    ? ' · everything at this property'
                    : ` · ${p.items.length} item${p.items.length === 1 ? '' : 's'}`}
                </span>
                {! p.whole_property && p.items.length > 0 && (
                  <span className="block pl-3 text-[12px] text-slate-500">
                    {p.items.map((i) => i.tag || i.name).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {r.note && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
              “{r.note}”
            </p>
          )}

          {r.status === 'new' && decliningId !== r.id && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => propose.mutate(r.id)}
                disabled={propose.isPending}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {propose.isPending ? 'Building the draft…' : 'Start proposal'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setDecliningId(r.id)
                }}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Decline
              </button>
            </div>
          )}

          {decliningId === r.id && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <label className="block text-[13px] font-semibold text-slate-700" htmlFor={`note-${r.id}`}>
                Why? The customer will ask, and so will whoever reads this next.
              </label>
              <textarea
                id={`note-${r.id}`}
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                placeholder="Outside our area, no capacity until spring…"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => decline.mutate({ id: r.id, note: declineNote })}
                  disabled={decline.isPending}
                  className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  Decline the request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDecliningId(null)
                    setDeclineNote('')
                  }}
                  className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Keep it
                </button>
              </div>
            </div>
          )}

          {r.status === 'proposed' && r.contract_id && (
            <button
              type="button"
              onClick={() => navigate(`/maintenance-contracts/${r.contract_id}`)}
              className="mt-3 text-sm font-semibold text-amber-700 hover:underline"
            >
              Open the draft →
            </button>
          )}

          {r.status === 'declined' && r.response_note && (
            <p className="mt-3 text-[13px] text-slate-600">Declined: {r.response_note}</p>
          )}
        </article>
      ))}
    </div>
  )
}
