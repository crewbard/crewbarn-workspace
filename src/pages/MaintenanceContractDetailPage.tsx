import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { IconChevronLeft, IconPlus, IconTrash } from '@tabler/icons-react'
import { AgreementTabs, useAgreementTab } from '@/components/contracts/AgreementTabs'
import { SeasonStrip, rhythmInWords, seasonInWords, type Rhythm } from '@/components/contracts/SeasonStrip'

/**
 * A contract, its service lines, and the rhythm each line follows.
 *
 * This is the screen the whole feature exists for. One agreement covers
 * one service quarterly and another weekly, and the weekly one drops to every other week
 * over winter — so a line is not "a cadence", it is a list of rhythms with
 * seasons, and the year strip is there because two rhythms in a form are
 * nearly impossible to check while a year drawn across twelve months takes
 * a second.
 */

type Rule = Rhythm & { id: string }

type Service = {
  id: string
  name: string
  job_type_id: string
  supervisor_account_id: string | null
  lead_tech_account_id: string | null
  rate_cents: number | null
  visit_duration_minutes: number | null
  sort_order: number
  service_location_ids: string[]
  rules: Rule[]
}

type Contract = {
  id: string
  customer_id: string
  title: string
  status: string
  supervisor_account_id: string | null
  starts_on: string | null
  ends_on: string | null
  billing_interval_unit: string
  billing_interval_count: number
  billing_amount_cents: number
  auto_renew: boolean
  renewal_mode: string
  renewal_uplift_percent: string | null
  renewal_amount_cents: number
  services: Service[]
}

const UNITS = [
  { value: 'day', label: 'days' },
  { value: 'week', label: 'weeks' },
  { value: 'month', label: 'months' },
  { value: 'year', label: 'years' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Exact cents, never rounded for display. */
const money = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function MaintenanceContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useAgreementTab()
  // Hooks live above the loading / not-found returns below. Declared
  // beside the action that uses them, they ran only on some renders,
  // which is "rendered more hooks than during the previous render".
  const [signUrl, setSignUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)



  const contract = useQuery({
    queryKey: ['maintenance-contract', id],
    queryFn: () => apiRequest<{ data: Contract }>(`/v1/maintenance-contracts/${id}`),
    enabled: !!id,
  })

  const jobTypes = useQuery({
    queryKey: ['job-types'],
    queryFn: () => apiRequest<{ data: { id: string; name: string }[] }>('/v1/job-types'),
  })

  // The properties, so a visit can say where it is rather than showing a
  // location id. The address arrives NESTED under `address`.
  const locations = useQuery({
    queryKey: ['customer-service-locations', contract.data?.data.customer_id],
    enabled: Boolean(contract.data?.data.customer_id),
    queryFn: () =>
      apiRequest<{
        data: {
          id: string
          nickname?: string | null
          address?: { street_address?: string | null; city?: string | null; formatted?: string | null } | null
        }[]
      }>(`/v1/customers/${contract.data!.data.customer_id}/service-locations`),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['maintenance-contract', id] })

  const addService = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(`/v1/maintenance-contracts/${id}/services`, { method: 'POST', body }),
    onSuccess: refresh,
    onError: (e) => setError((e as { message?: string })?.message ?? 'Could not add that service.'),
  })

  const removeService = useMutation({
    mutationFn: (serviceId: string) =>
      apiRequest(`/v1/maintenance-contracts/${id}/services/${serviceId}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => setError((e as { message?: string })?.message ?? 'Could not remove that service.'),
  })

  const saveRule = useMutation({
    mutationFn: ({ serviceId, ruleId, body }: { serviceId: string; ruleId?: string; body: Record<string, unknown> }) =>
      apiRequest(
        `/v1/maintenance-contracts/${id}/services/${serviceId}/rules${ruleId ? '/' + ruleId : ''}`,
        { method: ruleId ? 'PATCH' : 'POST', body },
      ),
    onSuccess: refresh,
    onError: (e) => setError((e as { message?: string })?.message ?? 'Could not save that rhythm.'),
  })

  const removeRule = useMutation({
    mutationFn: ({ serviceId, ruleId }: { serviceId: string; ruleId: string }) =>
      apiRequest(`/v1/maintenance-contracts/${id}/services/${serviceId}/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => setError((e as { message?: string })?.message ?? 'Could not remove that rhythm.'),
  })

  const data = contract.data?.data

  if (contract.isPending) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">Loading the contract…</div>
  }
  if (contract.isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load this contract.
        </p>
      </div>
    )
  }

  /*
   * Ids are what the visit rows carry; names are what a person reads.
   * The visits endpoint returns ids rather than repeating a service's
   * details on every one of several hundred rows, so the names are
   * matched up here where both are already in hand.
   */
  const serviceNames: Record<string, string> = Object.fromEntries(
    data.services.map((sv) => [sv.id, sv.name]),
  )
  const locationLabels: Record<string, string> = Object.fromEntries(
    (locations.data?.data ?? []).map((pl) => {
      const a = pl.address
      const street = a?.formatted || [a?.street_address, a?.city].filter(Boolean).join(', ')
      return [pl.id, pl.nickname ? `${street} (${pl.nickname})` : street || 'Property']
    }),
  )

  const uplift = Number(data.renewal_uplift_percent ?? 0)

  /*
   * The status in words, and what it means for the work.
   *
   * "draft" told nobody anything. The distinction that matters is
   * whether the agreement is doing something: only an active one is
   * looked at by the planner, the sweep and the biller, so a draft or a
   * paused one books nothing and bills nothing.
   */
  const STATUS_WORDS: Record<string, { label: string; note: string; tone: string }> = {
    draft: {
      label: 'Not started',
      note: 'It books no visits and bills nothing until you start it.',
      tone: 'bg-slate-100 text-slate-700',
    },
    pending_signature: {
      label: 'Waiting to be signed',
      note: 'Nothing is booked or billed until it is signed.',
      tone: 'bg-amber-50 text-amber-700',
    },
    active: { label: 'Running', note: '', tone: 'bg-emerald-50 text-emerald-700' },
    paused: {
      label: 'Paused',
      note: 'No visits are booked and nothing is billed while it is paused.',
      tone: 'bg-amber-50 text-amber-700',
    },
    expired: { label: 'Ended', note: 'The term is over.', tone: 'bg-slate-100 text-slate-600' },
    cancelled: { label: 'Cancelled', note: '', tone: 'bg-slate-100 text-slate-600' },
  }
  const shown = STATUS_WORDS[data.status] ?? {
    label: data.status,
    note: '',
    tone: 'bg-slate-100 text-slate-600',
  }

  /**
   * Send it to be signed.
   *
   * The wording is frozen at this point, so editing the template
   * afterwards does not change what the customer signed. The agreement
   * stays booking nothing and billing nothing until the signature lands.
   */
  const sendForSignature = async () => {
    setError(null)
    setSending(true)
    try {
      const res = await apiRequest<{ data: { sign_url: string; email_sent: boolean } }>(
        `/v1/maintenance-contracts/${id}/send`,
        { method: 'POST', body: {} },
      )
      setSignUrl(res.data.sign_url)
      await qc.invalidateQueries({ queryKey: ['maintenance-contract', id] })
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not send it.')
    } finally {
      setSending(false)
    }
  }

  /** Most agreements in this trade are still signed at a kitchen table. */
  const markSigned = async () => {
    const who = window.prompt('Who signed it?')
    if (who === null) return
    setError(null)
    try {
      await apiRequest(`/v1/maintenance-contracts/${id}/mark-signed`, {
        method: 'POST',
        body: { signed_by: who || null },
      })
      await qc.invalidateQueries({ queryKey: ['maintenance-contract', id] })
      await qc.invalidateQueries({ queryKey: ['contract-visits', id] })
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not record that.')
    }
  }

  const setStatus = async (next: string) => {
    setError(null)
    try {
      await apiRequest(`/v1/maintenance-contracts/${id}/status`, {
        method: 'POST',
        body: { status: next },
      })
      await qc.invalidateQueries({ queryKey: ['maintenance-contract', id] })
      await qc.invalidateQueries({ queryKey: ['contract-visits', id] })
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not change that.')
    }
  }

  return (
    <div className="relative w-full min-w-0 px-4 py-7 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/maintenance-contracts')}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <IconChevronLeft size={16} /> All contracts
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950">{data.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.starts_on} {data.ends_on ? `to ${data.ends_on}` : '— no end date'} ·{' '}
            {money(data.billing_amount_cents)} every {data.billing_interval_count}{' '}
            {data.billing_interval_unit}
            {data.billing_interval_count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${shown.tone}`}>{shown.label}</span>
          {(data.status === 'draft' || data.status === 'pending_signature') && (
            <>
              <button
                type="button"
                onClick={sendForSignature}
                disabled={sending}
                className="rounded-lg border border-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                {sending
                  ? 'Sending…'
                  : data.status === 'pending_signature'
                    ? 'Send again'
                    : 'Send to sign'}
              </button>
              <button
                type="button"
                onClick={markSigned}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                They signed on paper
              </button>
            </>
          )}
          {(data.status === 'draft' || data.status === 'paused') && (
            <button
              type="button"
              onClick={() => setStatus('active')}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600"
            >
              {data.status === 'draft' ? 'Start it' : 'Pick it back up'}
            </button>
          )}
          {data.status === 'active' && (
            <button
              type="button"
              onClick={() => setStatus('paused')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Pause
            </button>
          )}
        </div>
      </div>

      {/* The link itself. The email is the usual way it travels, but a
          shop that needs to text it or read it down the phone should not
          have to go looking. */}
      {signUrl && (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
          <p className="text-sm font-semibold text-emerald-900">Sent. Their signing link:</p>
          <p className="mt-0.5 break-all font-mono text-xs text-emerald-800">{signUrl}</p>
        </div>
      )}

      {/* Said out loud, because a status word on its own does not tell
          anybody that their agreement is booking nothing. */}
      {shown.note && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {shown.note}
        </p>
      )}

      {/* Renewal is shown here rather than buried in settings, because the
          number it produces is the one the customer will see. */}
      {uplift !== 0 && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Renews {data.renewal_mode === 'auto' ? 'automatically' : 'after review'} at{' '}
          <strong>{money(data.renewal_amount_cents)}</strong> — {uplift > 0 ? 'up' : 'down'}{' '}
          {Math.abs(uplift)}% from {money(data.billing_amount_cents)}.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      <AgreementTabs
        contractId={id!}
        tab={tab}
        onTab={setTab}
        locationLabels={locationLabels}
        serviceNames={serviceNames}
      />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-tight text-navy-950">What is covered</h2>
        <AddServiceButton
          jobTypes={jobTypes.data?.data ?? []}
          onAdd={(body) => { setError(null); addService.mutate(body) }}
          busy={addService.isPending}
        />
      </div>

      {data.services.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Nothing on this contract yet. Add a service — whatever you have agreed to do on a schedule —
          and then say how often it happens.
        </p>
      )}

      <div className="mt-3 space-y-4">
        {data.services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            jobTypeName={jobTypes.data?.data.find((t) => t.id === service.job_type_id)?.name}
            onRemove={() => { setError(null); removeService.mutate(service.id) }}
            onSaveRule={(ruleId, body) => { setError(null); saveRule.mutate({ serviceId: service.id, ruleId, body }) }}
            onRemoveRule={(ruleId) => { setError(null); removeRule.mutate({ serviceId: service.id, ruleId }) }}
            busy={saveRule.isPending || removeRule.isPending}
          />
        ))}
      </div>
    </div>
  )
}

function AddServiceButton({
  jobTypes,
  onAdd,
  busy,
}: {
  jobTypes: { id: string; name: string }[]
  onAdd: (body: Record<string, unknown>) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [jobTypeId, setJobTypeId] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
      >
        <IconPlus size={15} /> Add a service
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Routine service"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
      />
      {/* The job type is not optional: a generated visit has to land on the
          board as a real kind of work, and "maintenance" is not one. */}
      <select
        value={jobTypeId}
        onChange={(e) => setJobTypeId(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
      >
        <option value="">What kind of job?</option>
        {jobTypes.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!name.trim() || !jobTypeId || busy}
        onClick={() => { onAdd({ name: name.trim(), job_type_id: jobTypeId }); setName(''); setJobTypeId(''); setOpen(false) }}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Cancel
      </button>
    </div>
  )
}

function ServiceCard({
  service,
  jobTypeName,
  onRemove,
  onSaveRule,
  onRemoveRule,
  busy,
}: {
  service: Service
  jobTypeName?: string
  onRemove: () => void
  onSaveRule: (ruleId: string | undefined, body: Record<string, unknown>) => void
  onRemoveRule: (ruleId: string) => void
  busy: boolean
}) {
  const [adding, setAdding] = useState(false)

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-navy-950">{service.name}</div>
          <div className="text-xs text-slate-500">
            Books a {jobTypeName ?? 'job'} · {service.service_location_ids.length || 'no'}{' '}
            {service.service_location_ids.length === 1 ? 'property' : 'properties'}
            {service.rate_cents ? ` · ${money(service.rate_cents)} a visit` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <IconTrash size={13} /> Remove
        </button>
      </div>

      <div className="px-4 py-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">The year</div>
        <div className="mt-2">
          <SeasonStrip rhythms={service.rules} />
        </div>

        <div className="mt-4 space-y-2">
          {service.rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              canRemove={service.rules.length > 1}
              onSave={(body) => onSaveRule(rule.id, body)}
              onRemove={() => onRemoveRule(rule.id)}
              busy={busy}
            />
          ))}
        </div>

        {adding ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/40 p-3">
            <RuleRow
              rule={{ interval_count: 1, interval_unit: 'week' }}
              canRemove={false}
              onSave={(body) => { onSaveRule(undefined, body); setAdding(false) }}
              onRemove={() => setAdding(false)}
              busy={busy}
              isNew
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-400"
          >
            <IconPlus size={13} /> Add a season
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * One rhythm: how often, and when in the year.
 *
 * Reads as a sentence rather than a form — "every 2 weeks, November to
 * March" — because that is how somebody says it out loud, and a row of
 * unlabelled selects is how they get it wrong.
 */
function RuleRow({
  rule,
  canRemove,
  onSave,
  onRemove,
  busy,
  isNew = false,
}: {
  rule: Rhythm
  canRemove: boolean
  onSave: (body: Record<string, unknown>) => void
  onRemove: () => void
  busy: boolean
  isNew?: boolean
}) {
  const [count, setCount] = useState(rule.interval_count)
  const [unit, setUnit] = useState(rule.interval_unit)
  const [seasonal, setSeasonal] = useState(!!rule.season_start_month)
  const [startMonth, setStartMonth] = useState(rule.season_start_month ?? 4)
  const [endMonth, setEndMonth] = useState(rule.season_end_month ?? 10)
  const [label, setLabel] = useState(rule.label ?? '')

  const dirty =
    count !== rule.interval_count ||
    unit !== rule.interval_unit ||
    seasonal !== !!rule.season_start_month ||
    (seasonal && (startMonth !== rule.season_start_month || endMonth !== rule.season_end_month)) ||
    label !== (rule.label ?? '')

  const preview = useMemo(
    () =>
      rhythmInWords({ interval_count: count, interval_unit: unit }) +
      ' · ' +
      seasonInWords({
        interval_count: count,
        interval_unit: unit,
        season_start_month: seasonal ? startMonth : null,
        season_end_month: seasonal ? endMonth : null,
      }),
    [count, unit, seasonal, startMonth, endMonth],
  )

  const save = () =>
    onSave({
      interval_count: count,
      interval_unit: unit,
      label: label.trim() || null,
      season_start_month: seasonal ? startMonth : null,
      season_start_day: seasonal ? 1 : null,
      season_end_month: seasonal ? endMonth : null,
      // The last day of the end month. Storing 31 for a 30-day month is
      // harmless -- the comparison is month-then-day and nothing falls
      // between the 30th and the 31st.
      season_end_day: seasonal ? 31 : null,
    })

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Every</span>
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as Rhythm['interval_unit'])}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>

        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={seasonal}
            onChange={(e) => setSeasonal(e.target.checked)}
            className="size-4 accent-amber-500"
          />
          only part of the year
        </label>

        {seasonal && (
          <>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <span className="text-slate-500">to</span>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Call it…"
              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{preview}</span>
        <span className="flex items-center gap-2">
          {(dirty || isNew) && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
            >
              {isNew ? 'Add it' : 'Save'}
            </button>
          )}
          {(canRemove || isNew) && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {isNew ? 'Cancel' : 'Remove'}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
