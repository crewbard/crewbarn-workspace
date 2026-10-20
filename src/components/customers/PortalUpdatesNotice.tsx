import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { customerKeys } from '@/hooks/useCustomers'
import { portalUpdatesKey, usePortalUpdates } from '@/lib/portalUpdates'

/**
 * On a job from the portal: what the portal sent that the office hasn't taken
 * yet. When it's this job's own address (a property's building the company
 * didn't have, so the job went on another address meanwhile), it says so and
 * imports right here, which moves the job there. Otherwise a line to the
 * customer's changes. Nothing when there are none.
 */
export function PortalUpdatesNotice({ customerId, customerName, workOrderId }: { customerId: string; customerName: string | null; workOrderId: string }) {
  const qc = useQueryClient()
  const { has } = usePermissions()
  const updates = usePortalUpdates(customerId).data ?? []
  const place = updates.find((u) => u.subject === 'address' && u.work_order_ids?.includes(workOrderId))
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'import' | 'dismiss' }) =>
      apiRequest(`/v1/customers/${customerId}/portal-updates/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portalUpdatesKey(customerId) })
      void qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      void qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  if (place) {
    return (
      <div data-tour="job-portal-address" className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-slate-700">
        <p className="m-0">
          <strong>{place.from}</strong> says this job is at <strong>{place.address}</strong>
          {place.new_name && place.new_name !== place.address ? ` (${place.new_name})` : ''}. That address isn't on {customerName ?? 'the customer'}'s
          account yet, so the job is on another of their addresses for now.
        </p>
        {act.isError && <p role="alert" className="mt-1 text-red-700">{(act.error as Error).message}</p>}
        {has('customers.edit') ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={act.isPending} onClick={() => act.mutate({ id: place.id, action: 'import' })}
              className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              Add the address and move the job
            </button>
            <button type="button" disabled={act.isPending} onClick={() => act.mutate({ id: place.id, action: 'dismiss' })}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Keep it where it is
            </button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Someone who can edit customers can add it.</p>
        )}
      </div>
    )
  }

  if (updates.length === 0) return null
  const tab = updates.some((u) => u.subject !== 'address') ? 'contacts' : 'locations'

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-slate-700">
      <span>
        {customerName ?? 'This customer'} has {updates.length === 1 ? 'a change' : `${updates.length} changes`} from the portal waiting for you.
      </span>
      <Link to={`/customers/${customerId}?tab=${tab}`} className="font-medium text-amber-700 hover:underline">
        Look them over
      </Link>
    </div>
  )
}
