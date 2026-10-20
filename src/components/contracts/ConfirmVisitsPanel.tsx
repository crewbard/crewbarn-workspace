import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

type Visit = { id: string; service_id: string; service_location_id: string; due_on: string | null; status: string }

/**
 * "Confirm visits": the visits a plan suggested instead of booking.
 *
 * A plan made from a signed agreement whose form said "Suggest the visits
 * for the office to confirm" places its dates here. Confirming puts them
 * on the schedule (those due soon go on the board straight away);
 * skipping keeps them in the history as skipped. Shows nothing when there
 * is nothing waiting.
 */
export function ConfirmVisitsPanel({ contractId, canEdit, serviceNames, locationLabels }: {
  contractId: string
  canEdit: boolean
  serviceNames: Record<string, string>
  locationLabels: Record<string, string>
}) {
  const qc = useQueryClient()
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const suggested = useQuery({
    queryKey: ['contract-visits', contractId, 'suggested'],
    queryFn: () => apiRequest<{ data: Visit[] }>(`/v1/maintenance-contracts/${contractId}/visits?status=suggested`),
  })
  const act = useMutation({
    mutationFn: (body: { action: 'confirm' | 'skip'; visit_ids?: string[]; book_from_now_on?: boolean }) =>
      apiRequest<{ data: { changed: number; booked: number; suggested: number } }>(`/v1/maintenance-contracts/${contractId}/visits/confirm`, { method: 'POST', body }),
    onSuccess: (res, body) => {
      setPicked([])
      setNote(body.book_from_now_on
        ? `This plan now books its own visits. ${res.data.changed} confirmed${res.data.booked ? `, ${res.data.booked} put on the board` : ''}.`
        : body.action === 'confirm'
          ? `${res.data.changed} confirmed${res.data.booked ? `, ${res.data.booked} put on the board` : ''}.`
          : `${res.data.changed} skipped.`)
      void qc.invalidateQueries({ queryKey: ['contract-visits', contractId] })
      void qc.invalidateQueries({ queryKey: ['maintenance-contract', contractId] })
    },
    onError: (e: Error) => setNote(e.message),
  })

  const rows = suggested.data?.data ?? []
  if (!rows.length && !note) return null
  const day = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date')
  const allPicked = rows.length > 0 && picked.length === rows.length

  return <section data-tour="contract-confirm-visits" className="mt-6 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-base font-extrabold text-navy-950">Confirm visits</h2>
        <p className="text-sm text-slate-600">{rows.length
          ? `${rows.length} suggested ${rows.length === 1 ? 'visit is' : 'visits are'} waiting. Nothing is booked until you confirm.`
          : 'Nothing waiting to confirm.'}</p>
      </div>
      {canEdit && rows.length > 0 && <button type="button" disabled={act.isPending} onClick={() => {
        if (window.confirm('Confirm every suggested visit and let this plan book its own visits from now on?')) act.mutate({ action: 'confirm', book_from_now_on: true })
      }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Book automatically from now on</button>}
    </div>
    {note && <p role="status" className="mt-2 text-sm font-semibold text-sky-900">{note}</p>}
    {rows.length > 0 && <>
      {canEdit && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={allPicked} onChange={e => setPicked(e.target.checked ? rows.map(r => r.id) : [])} />Select all</label>}
      <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {rows.map(v => <li key={v.id}><label className="flex items-center gap-3 px-3 py-2">
          {canEdit && <input type="checkbox" checked={picked.includes(v.id)} onChange={e => setPicked(old => e.target.checked ? [...old, v.id] : old.filter(x => x !== v.id))} />}
          <span className="min-w-0"><span className="block text-sm font-semibold text-navy-800">{day(v.due_on)}</span>
            <span className="block truncate text-xs text-slate-500">{serviceNames[v.service_id] ?? 'Service'} · {locationLabels[v.service_location_id] ?? 'Property'}</span></span>
        </label></li>)}
      </ul>
      {canEdit && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!picked.length || act.isPending} onClick={() => act.mutate({ action: 'confirm', visit_ids: picked })}
          className="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">Confirm {picked.length || ''} selected</button>
        <button type="button" disabled={!picked.length || act.isPending} onClick={() => act.mutate({ action: 'skip', visit_ids: picked })}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Skip selected</button>
      </div>}
    </>}
  </section>
}
