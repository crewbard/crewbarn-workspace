import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

type LateWatch = 'on' | 'off' | null
type AutomatedCalls = 'allowed' | 'never' | null

interface CallSettings {
  late_watch: LateWatch
  automated_calls: AutomatedCalls
  company: { late_watch: boolean; customer_calls: 'never' | 'button' | 'automatic' }
  customer?: { late_watch: LateWatch; automated_calls: AutomatedCalls } | null
  effective: {
    late_watch: boolean
    late_watch_from: string
    customer_calls: 'never' | 'button' | 'automatic'
    customer_calls_from: string
    do_not_call: boolean
    has_phone: boolean
  }
}

/**
 * Late techs and automated calls for one customer or one job.
 *
 * Two plain questions, each able to follow the level above (the company for
 * a customer, the customer for a job) or decide for itself, and a line under
 * each saying what actually happens and why.
 */
export function CallSettingsCard({ kind, id, canEdit }: { kind: 'customer' | 'job'; id: string; canEdit: boolean }) {
  const qc = useQueryClient()
  const path = kind === 'customer' ? `/v1/customers/${id}/call-settings` : `/v1/work-orders/${id}/call-settings`
  const key = ['call-settings', kind, id]
  const q = useQuery({ queryKey: key, queryFn: async () => (await apiRequest<{ data: CallSettings }>(path)).data })
  const save = useMutation({
    mutationFn: async (input: Partial<Pick<CallSettings, 'late_watch' | 'automated_calls'>>) =>
      (await apiRequest<{ data: CallSettings }>(path, { method: 'PUT', body: input })).data,
    onSuccess: (data) => {
      qc.setQueryData(key, data)
      qc.invalidateQueries({ queryKey: ['call-settings'] })
      qc.invalidateQueries({ queryKey: ['late-risks'] })
    },
  })

  if (q.isLoading || !q.data) return null
  const s = q.data
  const follows = kind === 'customer' ? 'company' : 'customer'
  const followLabel = kind === 'customer' ? 'Use the company setting' : 'Use the customer’s setting'

  const watchLine = s.effective.late_watch
    ? 'Watched: if the tech may be late, they get a warning and the Schedule button flashes.'
    : 'Not watched: no late warnings for ' + (kind === 'customer' ? 'this customer’s jobs.' : 'this job.')
  const callsLine = s.effective.do_not_call
    ? 'Never: this customer is tagged do-not-call.'
    : s.effective.customer_calls === 'never'
      ? 'CBI never calls them.'
      : s.effective.customer_calls === 'button'
        ? 'CBI calls only when the office presses CBI: call customer on the Schedule page.'
        : 'CBI calls automatically if the tech hasn’t called by the time dispatch is told.'

  return (
    <section data-tour={`call-settings-${kind}`} className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Late techs and CBI calls</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        {kind === 'customer' ? 'For all of this customer’s jobs, unless a job says otherwise.' : 'For this job only.'}
      </p>

      <label className="mt-3 block text-xs font-medium text-slate-700">
        Watch for a late tech
        <select
          value={s.late_watch ?? ''}
          disabled={!canEdit || save.isPending}
          onChange={(e) => save.mutate({ late_watch: (e.target.value || null) as LateWatch })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
        >
          <option value="">{followLabel}</option>
          <option value="on">Yes, watch</option>
          <option value="off">No, don’t watch</option>
        </select>
      </label>
      <p className="mt-1 text-xs text-slate-500">
        {watchLine} <span className="text-slate-400">(from {s.effective.late_watch_from})</span>
      </p>

      <label className="mt-3 block text-xs font-medium text-slate-700">
        CBI calls to the customer
        <select
          value={s.automated_calls ?? ''}
          disabled={!canEdit || save.isPending}
          onChange={(e) => save.mutate({ automated_calls: (e.target.value || null) as AutomatedCalls })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
        >
          <option value="">{followLabel}</option>
          <option value="allowed">Allowed</option>
          <option value="never">Never call</option>
        </select>
      </label>
      <p className="mt-1 text-xs text-slate-500">
        {callsLine} <span className="text-slate-400">(from {s.effective.customer_calls_from})</span>
      </p>
      {s.effective.customer_calls !== 'never' && !s.effective.has_phone && (
        <p className="mt-1 text-xs text-amber-700">There’s no phone number for this customer, so there’s nobody to call.</p>
      )}
      {kind === 'job' && s.customer && (s.customer.late_watch !== null || s.customer.automated_calls !== null) && (
        <p className="mt-2 text-[11px] text-slate-400">The customer has their own settings; “{followLabel}” follows them.</p>
      )}
      {follows === 'company' && (
        <p className="mt-2 text-[11px] text-slate-400">
          Company setting: {s.company.customer_calls === 'never' ? 'never call customers' : s.company.customer_calls === 'button' ? 'call when the office presses the button' : 'call automatically'} (Shop Rules → GPS check-in).
        </p>
      )}
      {save.isError && <p className="mt-2 text-xs text-red-700">That didn’t save. Try again.</p>}
    </section>
  )
}
