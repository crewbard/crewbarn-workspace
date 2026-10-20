import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { customerKeys } from '@/hooks/useCustomers'
import { portalUpdatesKey, usePortalUpdates } from '@/lib/portalUpdates'

/**
 * Changes from the portal to this customer's contacts: a person's own
 * profile, their company team page, a property's billing and service
 * contacts. Nothing changes in the company's records until someone here
 * looks at it and imports it.
 */
export function PortalUpdatesBox({ customerId, canEdit, subject }: { customerId: string; canEdit: boolean; subject: 'contact' | 'address' }) {
  const qc = useQueryClient()
  const q = usePortalUpdates(customerId)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState('')

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'import' | 'dismiss' }) =>
      apiRequest(`/v1/customers/${customerId}/portal-updates/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      setError('')
      void qc.invalidateQueries({ queryKey: portalUpdatesKey(customerId) })
      void qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) })
      // An address moves the jobs waiting on it.
      if (subject === 'address') void qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const updates = (q.data ?? []).filter((u) => (u.subject ?? 'contact') === subject)
  if (updates.length === 0) return null

  return (
    <div data-tour="customer-portal-updates" className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy-800">From the portal</h3>
        <span className="text-xs text-navy-500">{updates.length} waiting</span>
      </div>
      <p className="mb-3 text-xs text-navy-500">Nothing here is in your records until you import it.</p>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="space-y-2">
        {updates.map((u) => (
          <li key={u.id} className="rounded-md border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {u.subject === 'address'
                    ? `New address: ${u.new_name ?? 'no name'}`
                    : u.kind === 'new' ? `New contact: ${u.new_name ?? 'no name'}` : `Changes to ${u.contact_name ?? 'a contact'}`}
                </div>
                {u.subject === 'address' && u.address && <div className="text-sm text-slate-700">{u.address}</div>}
                <div className="text-xs text-slate-500">
                  {u.from}
                  {u.at && ` · ${new Date(u.at).toLocaleDateString()}`}
                  {!!u.work_order_ids?.length && ` · ${u.work_order_ids.length === 1 ? '1 job is' : `${u.work_order_ids.length} jobs are`} on another address until you import it`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(open === u.id ? null : u.id)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  aria-expanded={open === u.id}
                >
                  {open === u.id ? 'Hide' : u.kind === 'new' ? 'View' : 'View changes'}
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: u.id, action: 'import' })}
                      className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      {u.subject === 'address' && u.work_order_ids?.length ? `Import and move ${u.work_order_ids.length === 1 ? 'the job' : 'the jobs'}` : 'Import'}
                    </button>
                    <button
                      type="button"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: u.id, action: 'dismiss' })}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
            {open === u.id && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Field</th>
                      {u.kind === 'change' && <th className="py-1 pr-3 font-medium">Now</th>}
                      <th className="py-1 font-medium">{u.kind === 'change' ? 'From the portal' : 'Value'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.changes.map((c) => (
                      <tr key={c.field} className="border-t border-slate-100">
                        <td className="py-1 pr-3 text-slate-600">{c.label}</td>
                        {u.kind === 'change' && <td className="py-1 pr-3 text-slate-500 line-through decoration-slate-300">{c.now ?? '—'}</td>}
                        <td className="py-1 font-medium text-slate-900">{c.new ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
