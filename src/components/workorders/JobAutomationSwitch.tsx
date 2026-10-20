import { useState } from 'react'
import { useUpdateWorkOrder } from '@/hooks/useWorkOrders'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import type { WorkOrder } from '@/types/workOrder'

/**
 * This job's automations switch, in the job's header where nobody misses it.
 *
 * Off: nothing automatic goes out for the job -- status texts and emails,
 * appointment reminders, automation rules, dormant nudges. Jobs brought in
 * from another system start off. Changing it is its own permission (Owner and
 * Admin by default); everyone else sees which way it is set.
 */
export function JobAutomationSwitch({ workOrder }: { workOrder: WorkOrder }) {
  const { has } = usePermissions()
  const update = useUpdateWorkOrder()
  const [error, setError] = useState<string | null>(null)

  const on = workOrder.automation_enabled !== false
  const label = on ? 'Automations on' : 'Automations off'
  const tone = on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'
  const explain = on
    ? 'Status messages, reminders and automation rules run for this job.'
    : 'Nothing automatic goes out for this job: no status messages, reminders, automation rules or dormant nudges.'

  if (!has(PERM.JOBS_AUTOMATION)) {
    return (
      <span data-tour="job-automation" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`} title={`${explain} An owner or admin can change it.`}>
        <span aria-hidden className={`h-2 w-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {label}
      </span>
    )
  }

  const flip = () => {
    const next = !on
    const ok = window.confirm(next
      ? 'Turn automations on for this job? From now on its status messages, reminders and automation rules run, like any other job.'
      : 'Turn automations off for this job? Nothing automatic goes out for it until someone turns them back on.')
    if (!ok) return
    setError(null)
    update.mutate(
      { id: workOrder.id, input: { automation_enabled: next } },
      { onError: (e) => setError(e instanceof Error ? e.message : 'Could not change it. Try again.') },
    )
  }

  return (
    <span data-tour="job-automation" className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={flip}
        disabled={update.isPending}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 ${tone}`}
        title={`${explain} Click to turn them ${on ? 'off' : 'on'}.`}
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {update.isPending ? 'Saving…' : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  )
}
