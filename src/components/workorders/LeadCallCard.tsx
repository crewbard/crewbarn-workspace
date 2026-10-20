import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IconPhoneCall } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { workOrderKeys } from '@/hooks/useWorkOrders'
import type { WorkOrder } from '@/types/workOrder'

/** "2026-10-14T15:00" for a datetime-local input, in this browser's time. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * A lead: somebody to call, not a visit. Dispatch sets when the tech must
 * have called the customer by. The tech calls from the app, which marks it
 * called. Five minutes past the time with no call, CrewBarn calls the tech
 * (press 1 to call the customer, or a voicemail) and, if it is still not
 * called, the Schedule button flashes for dispatch.
 */
export function LeadCallCard({ wo, canEdit }: { wo: WorkOrder; canEdit: boolean }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(toLocalInput(wo.lead_call_by))
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (local: string) =>
      apiRequest(`/v1/work-orders/${encodeURIComponent(wo.id)}`, {
        method: 'PATCH',
        body: { lead_call_by: local ? new Date(local).toISOString() : null },
      }),
    onSuccess: () => {
      setError(null)
      qc.invalidateQueries({ queryKey: workOrderKeys.detail(wo.id) })
    },
    onError: (e: Error) => setError(e.message),
  })

  const tech = wo.lead_tech?.full_name ?? null
  const status = wo.lead_called_at
    ? { tone: 'text-emerald-700', text: `Called ${when(wo.lead_called_at)}.` }
    : wo.lead_call_alerted_at
      ? { tone: 'text-red-700', text: `Not called by the time. CrewBarn called ${tech ?? 'the tech'} ${when(wo.lead_call_alerted_at)}.` }
      : wo.lead_call_by
        ? { tone: 'text-slate-600', text: `${tech ?? 'The tech'} calls the customer by ${when(wo.lead_call_by)}.` }
        : { tone: 'text-slate-500', text: 'No call-by time yet.' }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 lg:col-span-2" data-tour="job-lead-call">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IconPhoneCall size={16} aria-hidden className="text-amber-700" /> Lead: call the customer
          </h2>
          <p className={`mt-0.5 text-sm ${status.tone}`}>{status.text}</p>
          {!tech && <p className="mt-0.5 text-xs text-slate-500">Assign a lead tech for CrewBarn to chase the call.</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Call by</span>
              <input
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => save.mutate(value)}
              disabled={save.isPending || value === toLocalInput(wo.lead_call_by)}
              className="rounded-md bg-navy-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-40"
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">
        A lead isn&rsquo;t a visit, so the running-late calls and reminders don&rsquo;t apply. Five minutes past the call-by
        time with no call, CrewBarn calls the tech: press 1 to call the customer, or a voicemail. If it&rsquo;s still not called,
        Schedule flashes for you.
      </p>
    </section>
  )
}
