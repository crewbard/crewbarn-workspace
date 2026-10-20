import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { WorkOrder } from '@/types/workOrder'

/**
 * A job's own on-site contact and unit: who lets the crew in, and where in
 * the address the work is. Set when a property sends the job (the resident
 * who asked, or its maintenance person); on this job only, never on the
 * customer's contact list. The office can correct it here.
 */
export function OnSiteDetails({ wo }: { wo: WorkOrder }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', unit: '' })
  const contact = wo.site_contact

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${wo.id}`, {
        method: 'PATCH',
        body: {
          site_contact_name: form.name.trim() || null,
          site_contact_phone: form.phone.trim() || null,
          site_contact_email: form.email.trim() || null,
          site_unit: form.unit.trim() || null,
        },
      }),
    onSuccess: () => {
      setEditing(false)
      void qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  if (editing) {
    const field = 'w-full rounded border border-slate-300 px-2 py-1 text-sm'
    return (
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <input className={field} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit or area" aria-label="Unit or area" maxLength={60} />
        <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Who lets the crew in" aria-label="On-site contact name" maxLength={120} />
        <div className="grid grid-cols-2 gap-2">
          <input className={field} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" aria-label="On-site contact phone" maxLength={40} />
          <input className={field} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" aria-label="On-site contact email" maxLength={255} />
        </div>
        {save.isError && <p className="text-sm text-red-700">{(save.error as Error).message}</p>}
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-0.5">
      {wo.site_unit && <div className="font-medium">{wo.site_unit}</div>}
      {contact && (
        <div className="text-slate-600">
          {[
            contact.name,
            contact.phone ? <a key="p" href={`tel:${contact.phone}`} className="text-amber-700 hover:underline">{contact.phone}</a> : null,
            contact.email ? <a key="e" href={`mailto:${contact.email}`} className="text-amber-700 hover:underline">{contact.email}</a> : null,
          ]
            .filter(Boolean)
            .map((part, i) => <span key={i}>{i > 0 && ' · '}{part}</span>)}
        </div>
      )}
      <button
        type="button"
        className="text-xs text-amber-700 hover:underline"
        onClick={() => {
          setForm({ name: contact?.name ?? '', phone: contact?.phone ?? '', email: contact?.email ?? '', unit: wo.site_unit ?? '' })
          setEditing(true)
        }}
      >
        Change
      </button>
    </div>
  )
}
