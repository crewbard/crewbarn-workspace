import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { AgreementBuilderButton } from '@/components/agreements/AgreementBuilderButton'

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
 *
 * A request now also says how the equipment gets documented: the
 * customer listed it (with photos, videos and a note on each), or they
 * asked for a paid walkthrough. Opening a request shows all of it;
 * "Start proposal" adds the listed items to the customer's equipment and
 * drafts the plan, "Book the walkthrough" creates the survey job.
 */

interface PlanRequestProperty {
  id: string
  label: string
  address: string | null
  items?: { id: string; name: string; tag: string | null }[]
  whole_property?: boolean
}

type Status = 'new' | 'surveying' | 'proposed' | 'declined' | 'withdrawn'

interface PlanRequest {
  id: string
  status: Status
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
  survey_mode?: 'self' | 'walkthrough'
  /** Cents per hour. */
  survey_rate_cents?: number | null
  survey_minutes?: number | null
  survey_started_at?: string | null
  survey_finished_at?: string | null
  survey_work_order_id?: string | null
  interval_count?: number
  interval_unit?: string
  asset_count?: number
  problem_count?: number
  media_count?: number
}

interface RequestMedia {
  id: string
  kind: 'image' | 'video'
  url: string
  thumb_url: string | null
  caption: string | null
  created_at?: string | null
}

interface RequestAsset {
  id: string
  name: string
  type_name: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  location_path: string | null
  notes: string | null
  has_problem: boolean
  problem: string | null
  created_asset_id: string | null
  property_id?: string | null
  created_at?: string | null
  media: RequestMedia[]
}

interface WalkthroughPhoto {
  id: string
  thumb_url: string | null
  url: string
  caption: string | null
  created_at: string | null
}

interface WalkthroughAsset {
  id: string
  name: string
  location_path: string | null
  created_at: string | null
  photos: WalkthroughPhoto[]
}

interface PlanRequestDetail extends PlanRequest {
  assets: RequestAsset[]
  walkthrough?: {
    assets: WalkthroughAsset[]
    minutes: number | null
    started_at: string | null
    finished_at: string | null
  } | null
}

interface FinishResult {
  minutes: number
  started_at: string | null
  finished_at: string | null
  amount_cents: number
  asset_count: number
  photo_count: number
}

/** ISO-8601: 1 is Monday. The same convention the rules table uses. */
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_STYLE: Record<Status, string> = {
  new: 'bg-amber-50 text-amber-800',
  surveying: 'bg-sky-50 text-sky-800',
  proposed: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-slate-100 text-slate-500',
  withdrawn: 'bg-slate-100 text-slate-500',
}

const STATUS_WORD: Record<Status, string> = {
  new: 'new',
  surveying: 'walkthrough booked',
  proposed: 'proposed',
  declined: 'declined',
  withdrawn: 'withdrawn',
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''

const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function rateWords(cents: number | null | undefined): string {
  return cents ? `${dollars(cents)}/hr` : 'no charge'
}

/** 75 → "1 hr 15 min". */
function durationWords(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr${h === 1 ? '' : 's'}` : `${h} hr ${m} min`
}

/** Date and time, for time stamps. */
const stamp = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

/** Time of day only, for a timeline inside one visit. */
const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''

/** The open/actionable states. A booked walkthrough still ends in a proposal or a decline. */
const isOpen = (s: Status) => s === 'new' || s === 'surveying'

export function PlanRequestsTab() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { has } = usePermissions()
  const canEdit = has('contracts.edit')
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [booked, setBooked] = useState<Record<string, { id: string; number: string | null }>>({})
  const [finishingId, setFinishingId] = useState<string | null>(null)
  const [finishMinutes, setFinishMinutes] = useState('')
  const [finished, setFinished] = useState<Record<string, FinishResult>>({})

  const requests = useQuery({
    queryKey: ['service-plan-requests'],
    queryFn: () => apiRequest<{ data: PlanRequest[]; waiting: number }>('/v1/service-plan-requests'),
  })

  const refresh = (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['service-plan-requests'] })
    if (id) void qc.invalidateQueries({ queryKey: ['service-plan-request', id] })
  }

  const propose = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: { contract_id: string } }>(`/v1/service-plan-requests/${id}/start-proposal`, {
        method: 'POST',
      }),
    onSuccess: (res, id) => {
      refresh(id)
      void qc.invalidateQueries({ queryKey: ['maintenance-contracts'] })
      // Straight into the draft. The office clicked this to write the
      // agreement, not to be told one exists somewhere.
      navigate(`/maintenance-contracts/${res.data.contract_id}`)
    },
    onError: (e: Error) => setError(e.message),
  })

  const book = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: { work_order_id: string; work_order_number: string | null } }>(
        `/v1/service-plan-requests/${id}/book-walkthrough`,
        { method: 'POST' },
      ),
    onSuccess: (res, id) => {
      setBooked((b) => ({ ...b, [id]: { id: res.data.work_order_id, number: res.data.work_order_number } }))
      refresh(id)
    },
    onError: (e: Error) => setError(e.message),
  })

  const finish = useMutation({
    mutationFn: (vars: { id: string; minutes: number | null }) =>
      apiRequest<{ data: FinishResult }>(`/v1/service-plan-requests/${vars.id}/finish-walkthrough`, {
        method: 'POST',
        body: vars.minutes ? { minutes: vars.minutes } : {},
      }),
    onSuccess: (res, vars) => {
      setFinished((f) => ({ ...f, [vars.id]: res.data }))
      setFinishingId(null)
      setFinishMinutes('')
      refresh(vars.id)
    },
    onError: (e: Error) => setError(e.message),
  })

  const decline = useMutation({
    mutationFn: (vars: { id: string; note: string }) =>
      apiRequest(`/v1/service-plan-requests/${vars.id}/decline`, {
        method: 'POST',
        body: { note: vars.note || null },
      }),
    onSuccess: (_res, vars) => {
      setDecliningId(null)
      setDeclineNote('')
      refresh(vars.id)
    },
    onError: (e: Error) => setError(e.message),
  })

  const rows = requests.data?.data ?? []

  if (requests.isPending) {
    return <p data-tour="contracts-requests-panel" className="mt-6 text-sm text-slate-500">Loading requests…</p>
  }

  if (rows.length === 0) {
    return (
      <p data-tour="contracts-requests-panel" className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
        Nobody has asked for a service plan yet. When a customer asks from their portal, it lands
        here with the schedule they wanted and the equipment they listed, and one click turns it into
        a draft agreement.
      </p>
    )
  }

  /** The buttons, shared by the list row and the detail panel. */
  const actions = (r: PlanRequest, tour?: string) => {
    if (!canEdit || !isOpen(r.status)) return null
    const walkthrough = r.survey_mode === 'walkthrough'
    const woId = booked[r.id]?.id ?? r.survey_work_order_id ?? null
    const woNumber = booked[r.id]?.number ?? null

    if (decliningId === r.id) {
      return (
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
      )
    }

    const finishedNow = finished[r.id] ?? null
    const isFinished = !!finishedNow || !!r.survey_finished_at
    const needsBooking = walkthrough && r.status === 'new' && !woId
    const needsFinish = walkthrough && !needsBooking && !isFinished
    const minutes = finishedNow?.minutes ?? r.survey_minutes ?? null
    const primary = 'rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60'
    const secondary = 'rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60'
    const minutesText = finishMinutes.trim()
    const minutesOk = minutesText === '' || (/^\d+$/.test(minutesText) && Number(minutesText) >= 1 && Number(minutesText) <= 1440)

    const proposeButton = (style: string) => (
      <button
        type="button"
        onClick={() => {
          setError(null)
          propose.mutate(r.id)
        }}
        disabled={propose.isPending}
        className={style}
      >
        {propose.isPending && propose.variables === r.id ? 'Building the draft…' : 'Start proposal'}
      </button>
    )

    return (
      <div data-tour={tour} data-step={needsBooking ? 'book' : needsFinish ? 'finish' : isFinished ? 'finished' : 'propose'} className="mt-3 space-y-2">
        {woId && !isFinished && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-900">
            Walkthrough booked.{' '}
            <Link to={`/jobs/${woId}`} className="font-semibold underline">
              Open job {woNumber ?? ''}
            </Link>{' '}
            The tech records each piece of equipment and its photos at the property with the usual asset tools; each one
            is time stamped. Finish the walkthrough when they are done.
          </p>
        )}

        {isFinished && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
            Walkthrough finished
            {minutes ? `: ${durationWords(minutes)}` : ''}
            {finishedNow
              ? ` · ${dollars(finishedNow.amount_cents)} on the job · ${plural(finishedNow.asset_count, 'item')}, ${plural(finishedNow.photo_count, 'photo')}`
              : r.survey_rate_cents
                ? ` at ${rateWords(r.survey_rate_cents)}`
                : ''}
            .
            {woId && (
              <>
                {' '}
                <Link to={`/jobs/${woId}`} className="font-semibold underline">
                  Open job {woNumber ?? ''}
                </Link>
              </>
            )}
          </p>
        )}

        {finishingId === r.id ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="block text-[13px] font-semibold text-slate-700" htmlFor={`minutes-${r.id}`}>
              Time to bill, in minutes (optional)
            </label>
            <p className="text-[12px] text-slate-500">
              Leave it blank to use the time stamps: from the first item or photo recorded to the last, rounded up to
              15 minutes.
            </p>
            <input
              id={`minutes-${r.id}`}
              type="text"
              inputMode="numeric"
              value={finishMinutes}
              onChange={(e) => setFinishMinutes(e.target.value)}
              placeholder="e.g. 90"
              className="mt-1.5 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
            {!minutesOk && <p className="mt-1 text-[12px] text-rose-700">Enter whole minutes, from 1 to 1440.</p>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  finish.mutate({ id: r.id, minutes: minutesText === '' ? null : Number(minutesText) })
                }}
                disabled={finish.isPending || !minutesOk}
                className={primary}
              >
                {finish.isPending ? 'Finishing…' : 'Finish walkthrough'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinishingId(null)
                  setFinishMinutes('')
                }}
                className={secondary}
              >
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {needsBooking ? (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  book.mutate(r.id)
                }}
                disabled={book.isPending}
                className={primary}
              >
                {book.isPending && book.variables === r.id ? 'Booking…' : 'Book the walkthrough'}
              </button>
            ) : needsFinish ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setFinishMinutes('')
                    setFinishingId(r.id)
                  }}
                  className={primary}
                >
                  Finish walkthrough
                </button>
                {proposeButton(secondary)}
              </>
            ) : (
              proposeButton(primary)
            )}
            {!needsBooking && (
              <AgreementBuilderButton
                source={{ type: 'plan_request', id: r.id }}
                tour={tour ? `${tour}-agreement` : 'contracts-request-build-agreement'}
                className={secondary}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setError(null)
                setDecliningId(r.id)
              }}
              className={secondary}
            >
              Decline
            </button>
          </div>
        )}

        <p className="text-[12px] leading-relaxed text-slate-500">
          {needsBooking
            ? `Creates a job at the property for this customer with a "Walkthrough / site survey" line (${rateWords(r.survey_rate_cents)}). Schedule it like any job.`
            : needsFinish
              ? 'Finishing works out the time from the time stamps and puts it on the job at the hourly rate. Start proposal drafts a plan covering everything now on file at the property.'
              : walkthrough
                ? 'Start proposal drafts a plan covering everything now on file at the property.'
                : (r.asset_count ?? 0) > 0
                  ? `Start proposal adds the ${plural(r.asset_count ?? 0, 'listed item')} to the customer's equipment at the property (with their photos and notes, and any problems as findings), then drafts the plan covering them.`
                  : 'Start proposal drafts a plan covering what is on file at the property.'}
        </p>
      </div>
    )
  }

  return (
    <div data-tour="contracts-requests-panel" className="mt-4 space-y-3">
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}

      {rows.map((r) => (
        <article key={r.id} data-tour="contracts-request" data-status={r.status} data-walkthrough={r.survey_mode === 'walkthrough' ? 'yes' : 'no'} className="rounded-xl border border-slate-200 bg-white p-4">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy-950">{r.customer.name ?? 'Customer'}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Asked {when(r.asked_at)}
                {r.responded_at ? ` · answered ${when(r.responded_at)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {r.survey_mode === 'walkthrough' && (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">
                  Walkthrough · {rateWords(r.survey_rate_cents)}
                  {r.survey_minutes && r.survey_finished_at ? ` · ${durationWords(r.survey_minutes)}` : ''}
                </span>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.status] ?? STATUS_STYLE.new}`}>
                {STATUS_WORD[r.status] ?? r.status}
              </span>
            </div>
          </header>

          {/* The schedule, in full. This is the part that does not survive
              a telephone call, so it is the part shown largest. */}
          <Schedule r={r} />

          <ul className="mt-3 space-y-1 text-[13px]">
            {r.properties.map((p) => (
              <li key={p.id} className="text-slate-700">
                <span className="font-semibold text-navy-900">{p.label}</span>
                {p.address && p.address !== p.label && (
                  <span className="text-slate-500"> — {p.address}</span>
                )}
                {p.whole_property !== undefined && (
                  <span className="text-slate-600">
                    {/* "Everything here" is the common answer and has to read
                        as an answer, not as an empty list. */}
                    {p.whole_property
                      ? ' · everything at this property'
                      : ` · ${plural(p.items?.length ?? 0, 'item')}`}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* What came with it: the counts that say whether to open it. */}
          {r.survey_mode !== 'walkthrough' && (r.asset_count ?? 0) > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate-600">
              <span>{plural(r.asset_count ?? 0, 'item')} listed</span>
              {(r.media_count ?? 0) > 0 && <span>{plural(r.media_count ?? 0, 'photo/video', 'photos/videos')}</span>}
              {(r.problem_count ?? 0) > 0 && (
                <span className="font-semibold text-rose-700">{plural(r.problem_count ?? 0, 'problem')} reported</span>
              )}
            </p>
          )}

          {r.note && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
              “{r.note}”
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpenId(r.id)}
            className="mt-3 text-sm font-semibold text-amber-700 hover:underline"
          >
            Open the request →
          </button>

          {actions(r, 'contracts-request-actions')}

          {r.status === 'proposed' && r.contract_id && (
            <button
              type="button"
              onClick={() => navigate(`/maintenance-contracts/${r.contract_id}`)}
              className="ml-4 mt-3 text-sm font-semibold text-amber-700 hover:underline"
            >
              Open the draft →
            </button>
          )}

          {r.status === 'declined' && r.response_note && (
            <p className="mt-3 text-[13px] text-slate-600">Declined: {r.response_note}</p>
          )}
        </article>
      ))}

      {openId && (
        <RequestDetail
          id={openId}
          summary={rows.find((r) => r.id === openId) ?? null}
          error={error}
          actions={actions}
          onOpenDraft={(contractId) => navigate(`/maintenance-contracts/${contractId}`)}
          onClose={() => {
            setOpenId(null)
            setDecliningId(null)
          }}
        />
      )}
    </div>
  )
}

function Schedule({ r }: { r: PlanRequest }) {
  return (
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
          {r.preferred_weekdays.length > 0 ? r.preferred_weekdays.map((d) => DAYS[d]).join(', ') : 'Any day'}
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="font-semibold text-slate-500">Closed</dt>
        <dd className="text-slate-700">
          {r.blackout_months.length > 0 ? r.blackout_months.map((m) => MONTHS[m]).join(', ') : 'Never'}
        </dd>
      </div>
    </dl>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h4>
      <div className="mt-1.5">{children}</div>
    </section>
  )
}

/**
 * One request, all of it: the property, the schedule, how the equipment
 * gets documented, and every listed item with its photos and videos.
 */
function RequestDetail({
  id,
  summary,
  error,
  actions,
  onOpenDraft,
  onClose,
}: {
  id: string
  summary: PlanRequest | null
  error: string | null
  actions: (r: PlanRequest) => ReactNode
  onOpenDraft: (contractId: string) => void
  onClose: () => void
}) {
  const q = useQuery({
    queryKey: ['service-plan-request', id],
    queryFn: () => apiRequest<{ data: PlanRequestDetail }>(`/v1/service-plan-requests/${id}`),
  })
  const [viewing, setViewing] = useState<{ list: RequestMedia[]; index: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewing) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, viewing])

  // The list row is the freshest status (it refetches after every action);
  // the detail carries the items.
  const d = q.data?.data
  const r: PlanRequest | null = d ? { ...d, ...(summary ?? {}) } : summary
  const assets = d?.assets ?? []
  const problems = assets.filter((a) => a.has_problem)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Service plan request"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-navy-950">{r?.customer.name ?? 'Customer'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Asked for a service plan {r?.asked_at ? when(r.asked_at) : ''}
              {r ? ` · ${STATUS_WORD[r.status] ?? r.status}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>
          )}

          {q.isPending && <p className="mt-6 text-sm text-slate-500">Loading the request…</p>}
          {q.isError && (
            <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Could not load this request. {(q.error as Error).message}
            </p>
          )}

          {r && (
            <>
              <Section title="Property">
                <ul className="space-y-1 text-[13px]">
                  {r.properties.map((p) => (
                    <li key={p.id}>
                      <span className="font-semibold text-navy-900">{p.label}</span>
                      {p.address && p.address !== p.label && <span className="text-slate-500"> — {p.address}</span>}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Schedule they asked for">
                <Schedule r={r} />
                {r.note && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700">“{r.note}”</p>
                )}
              </Section>

              <Section title="Equipment">
                {r.survey_mode === 'walkthrough' ? (
                  <>
                    <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[13px] text-violet-900">
                      They asked you to come out and list the equipment, at {rateWords(r.survey_rate_cents)} for the time
                      spent documenting.
                    </p>
                    {d && (
                      <WalkthroughTimeline
                        w={d.walkthrough ?? null}
                        rateCents={r.survey_rate_cents ?? null}
                        onView={(list, index) => setViewing({ list, index })}
                      />
                    )}
                  </>
                ) : d && assets.length === 0 ? (
                  <p className="text-[13px] text-slate-600">
                    Nothing listed. They asked for everything already on file at the property.
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] text-slate-600">
                      The customer listed {plural(assets.length, 'item')}
                      {problems.length > 0 && (
                        <span className="font-semibold text-rose-700"> · {plural(problems.length, 'problem')} reported</span>
                      )}
                      .
                    </p>
                    <ul className="mt-3 space-y-3">
                      {assets.map((a) => (
                        <AssetCard key={a.id} a={a} onView={(index) => setViewing({ list: a.media, index })} />
                      ))}
                    </ul>
                  </>
                )}
              </Section>

              {r.status === 'proposed' && r.contract_id && (
                <button
                  type="button"
                  onClick={() => onOpenDraft(r.contract_id!)}
                  className="mt-5 text-sm font-semibold text-amber-700 hover:underline"
                >
                  Open the draft →
                </button>
              )}
              {r.status === 'declined' && r.response_note && (
                <p className="mt-5 text-[13px] text-slate-600">Declined: {r.response_note}</p>
              )}
            </>
          )}
        </div>

        {r && isOpen(r.status) && <footer className="border-t border-slate-200 px-5 pb-4">{actions(r)}</footer>}
      </aside>

      {viewing && (
        <Lightbox
          list={viewing.list}
          index={viewing.index}
          onIndex={(index) => setViewing({ ...viewing, index })}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/**
 * What the tech recorded on the walkthrough, in the order they recorded
 * it. The time stamps are what the bill is worked out from, so they are
 * shown on everything.
 */
function WalkthroughTimeline({
  w,
  rateCents,
  onView,
}: {
  w: PlanRequestDetail['walkthrough'] | null
  rateCents: number | null
  onView: (list: RequestMedia[], index: number) => void
}) {
  const assets = w?.assets ?? []
  if (assets.length === 0) {
    return <p className="mt-3 text-[13px] text-slate-500">Nothing recorded at the property yet.</p>
  }
  const photoCount = assets.reduce((n, a) => n + a.photos.length, 0)
  return (
    <div className="mt-3">
      <dl className="grid gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[13px] sm:grid-cols-3">
        <div className="flex gap-2">
          <dt className="font-semibold text-slate-500">Started</dt>
          <dd className="text-slate-800">{w?.started_at ? stamp(w.started_at) : stamp(assets[0].created_at) || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-slate-500">Finished</dt>
          <dd className="text-slate-800">{w?.finished_at ? stamp(w.finished_at) : 'Not yet'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-slate-500">Time</dt>
          <dd className="font-semibold text-navy-900">
            {w?.minutes ? durationWords(w.minutes) : '—'}
            {w?.minutes && rateCents ? ` at ${rateWords(rateCents)}` : ''}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] text-slate-500">
        {plural(assets.length, 'item')} and {plural(photoCount, 'photo')} recorded.
      </p>

      <ol className="mt-3 border-l-2 border-slate-200 pl-4">
        {assets.map((a) => {
          const media: RequestMedia[] = a.photos.map((p) => ({
            id: p.id,
            kind: 'image',
            url: p.url,
            thumb_url: p.thumb_url,
            caption: p.caption,
            created_at: p.created_at,
          }))
          return (
            <li key={a.id} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500" aria-hidden />
              <p className="text-[12px] font-semibold tabular-nums text-slate-500">{clock(a.created_at)}</p>
              <p className="text-sm font-bold text-navy-900">{a.name}</p>
              {a.location_path && <p className="text-[12px] text-slate-500">{a.location_path}</p>}
              {media.length > 0 && (
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m, i) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => onView(media, i)}
                        className="block aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                        aria-label="View photo"
                      >
                        <img src={m.thumb_url ?? m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                      <p className="mt-0.5 text-[10.5px] tabular-nums text-slate-400">{clock(m.created_at)}</p>
                      {m.caption && <p className="line-clamp-2 text-[11px] leading-snug text-slate-600">{m.caption}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function AssetCard({ a, onView }: { a: RequestAsset; onView: (index: number) => void }) {
  const facts: [string, string | null][] = [
    ['Type', a.type_name],
    ['Make', a.manufacturer],
    ['Model', a.model],
    ['Serial', a.serial_number],
  ]
  return (
    <li className={`rounded-xl border p-3 ${a.has_problem ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h5 className="text-sm font-bold text-navy-900">{a.name}</h5>
          {a.location_path && <p className="text-[12px] text-slate-500">{a.location_path}</p>}
          {a.created_at && <p className="text-[11px] text-slate-400">Added {stamp(a.created_at)}</p>}
        </div>
        {a.created_asset_id && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">On file</span>
        )}
      </div>

      {a.has_problem && (
        <p className="mt-2 rounded-lg bg-rose-100 px-2.5 py-1.5 text-[13px] font-semibold text-rose-800">
          Problem: {a.problem || 'not described'}
        </p>
      )}

      {facts.some(([, v]) => v) && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px]">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800">{v}</dd>
              </div>
            ))}
        </dl>
      )}

      {a.notes && <p className="mt-2 whitespace-pre-line text-[13px] text-slate-700">{a.notes}</p>}

      {a.media.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {a.media.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onView(i)}
                className="relative block aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
                aria-label={m.kind === 'video' ? 'Play video' : 'View photo'}
              >
                {m.kind === 'video' && !m.thumb_url ? (
                  <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-90" />
                ) : (
                  <img src={m.thumb_url ?? m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
                {m.kind === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow">
                      <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                )}
              </button>
              {m.caption && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">{m.caption}</p>}
              {m.created_at && <p className="text-[10.5px] text-slate-400">{stamp(m.created_at)}</p>}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Lightbox({
  list,
  index,
  onIndex,
  onClose,
}: {
  list: RequestMedia[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const m = list[index]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < list.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, list.length, onClose, onIndex])
  if (!m) return null
  const nav = 'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25'
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
        aria-label="Close"
      >
        ×
      </button>
      {index > 0 && (
        <button
          type="button"
          className={`${nav} left-3`}
          onClick={(e) => {
            e.stopPropagation()
            onIndex(index - 1)
          }}
          aria-label="Previous"
        >
          ‹
        </button>
      )}
      {index < list.length - 1 && (
        <button
          type="button"
          className={`${nav} right-3`}
          onClick={(e) => {
            e.stopPropagation()
            onIndex(index + 1)
          }}
          aria-label="Next"
        >
          ›
        </button>
      )}
      <figure className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {m.kind === 'video' ? (
          <video key={m.id} src={m.url} controls autoPlay playsInline className="max-h-[80vh] max-w-full rounded-lg" />
        ) : (
          <img src={m.url} alt={m.caption ?? ''} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
        )}
        <figcaption className="mt-2 text-center text-sm text-white/90">
          {m.caption || ''}
          {m.created_at && <span className="ml-2 text-white/60">{stamp(m.created_at)}</span>}
          <span className="ml-2 text-white/50">
            {index + 1} of {list.length}
          </span>
        </figcaption>
      </figure>
    </div>
  )
}
