import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'
import { useAssetTypes } from '@/hooks/useAssetTypes'
import { Modal } from '@/components/ui/Modal'
import type { CustomerServiceLocation } from '@/types/customer'

interface Ask {
  id?: string
  status?: 'pending' | 'approved' | 'declined' | 'stopped'
  asked_by?: string | null
  asked_at?: string | null
  decided_by?: string | null
  decided_at?: string | null
  copied?: { equipment: number; projects: number } | null
}

interface PropertyRecordsSummary {
  property: { id: string; name: string }
  trade: string | null
  theirs: {
    equipment: number
    projects: number
    state: 'none' | 'can_ask' | 'pending' | 'approved' | 'declined' | 'stopped' | 'no_trade'
    ask: Ask
    ask_again_on: string | null
  }
  ours: { equipment: number; projects: number; ask: Ask } | null
}

interface TheirRecords {
  records: {
    id: string
    title: string
    done_at: string | null
    building: string | null
    unit: string | null
    notes: { body: string }[]
    entries: { date: string | null; kind: string | null; summary: string | null; result: string | null; part: { name: string; number: string | null } | null; equipment: string | null }[]
    photos: { name: string; url: string }[]
  }[]
  equipment: {
    id: string
    name: string
    tag: string | null
    type: string | null
    manufacturer: string | null
    model: string | null
    serial_number: string | null
    install_date: string | null
    last_service_at: string | null
    building: string | null
    unit: string | null
    added_asset_id: string | null
  }[]
}

const key = (customerId: string) => ['customers', customerId, 'property-records']
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : '')
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Records between this company and the property this customer is
 * (RecordsAccess). Two things, each shown only when there's something to
 * say:
 *
 *  - the property has records for your trade from other companies' work:
 *    counts only, until the property says yes; then View records, where
 *    items can be added to your equipment with their history;
 *  - the property asks for your records of its addresses: share them or
 *    say no. They get what a customer can already see, never prices.
 */
export function PropertyRecordsCard({ customerId, canEdit, locations }: { customerId: string; canEdit: boolean; locations: CustomerServiceLocation[] }) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: key(customerId),
    queryFn: () => apiRequest<{ data: PropertyRecordsSummary[] }>(`/v1/customers/${customerId}/property-records`).then((r) => r.data),
  })
  const [viewing, setViewing] = useState<PropertyRecordsSummary | null>(null)
  const [error, setError] = useState('')
  const done = () => {
    setError('')
    void qc.invalidateQueries({ queryKey: key(customerId) })
  }
  const ask = useMutation({
    mutationFn: (propertyId: string) => apiRequest(`/v1/customers/${customerId}/property-records/${propertyId}/ask`, { method: 'POST' }),
    onSuccess: done,
    onError: (e: Error) => setError(e.message),
  })
  const decide = useMutation({
    mutationFn: ({ propertyId, askId, share }: { propertyId: string; askId: string; share: boolean }) =>
      apiRequest(`/v1/customers/${customerId}/property-records/${propertyId}/asks/${askId}`, { method: 'POST', body: JSON.stringify({ share }) }),
    onSuccess: done,
    onError: (e: Error) => setError(e.message),
  })

  const shown = (q.data ?? []).filter((s) => s.theirs.state !== 'none' && s.theirs.state !== 'no_trade' || s.ours)
  if (shown.length === 0) return null

  return (
    <div data-tour="customer-property-records" className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {shown.map((s) => {
        const trade = (s.trade ?? '').toLowerCase()
        const t = s.theirs
        const o = s.ours
        return (
          <div key={s.property.id} className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-sm">
            <h3 className="font-semibold text-navy-800">Records with {s.property.name}</h3>

            {t.state !== 'none' && t.state !== 'no_trade' && (
              <div className="mt-2">
                <p className="text-slate-800">
                  {t.state === 'approved'
                    ? `${s.property.name} lets you see its ${trade} records: ${count(t.equipment, 'equipment item', 'equipment items')}, ${count(t.projects, 'project', 'projects')}.`
                    : `${s.property.name} has ${trade} records from earlier work: ${count(t.equipment, 'equipment item', 'equipment items')}, ${count(t.projects, 'project', 'projects')}.`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.state === 'can_ask' && 'Ask the property to see them. They come from other companies\' work, and you only see records for your trade.'}
                  {t.state === 'pending' && `Asked ${day(t.ask.asked_at)}. Waiting for the property to answer.`}
                  {t.state === 'approved' && `They said yes on ${day(t.ask.decided_at)}. You can add any equipment to your own, with its history.`}
                  {t.state === 'declined' && `The property said no on ${day(t.ask.decided_at)}. You can ask again on ${day(t.ask_again_on)}.`}
                  {t.state === 'stopped' && `The property stopped sharing on ${day(t.ask.decided_at)}. You can ask again on ${day(t.ask_again_on)}.`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.state === 'can_ask' && canEdit && (
                    <button type="button" disabled={ask.isPending} onClick={() => ask.mutate(s.property.id)}
                      className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                      Ask to see them
                    </button>
                  )}
                  {t.state === 'approved' && (
                    <button type="button" onClick={() => setViewing(s)}
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      View records
                    </button>
                  )}
                </div>
              </div>
            )}

            {o && (
              <div className="mt-3 border-t border-sky-200 pt-3">
                {o.ask.status === 'pending' ? (
                  <>
                    <p className="text-slate-800">
                      {o.ask.asked_by ?? 'The property'} asks for your records of {s.property.name}: {count(o.equipment, 'equipment item', 'equipment items')}, {count(o.projects, 'project', 'projects')}.
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      They'd get a copy of what a customer can already see: the equipment, what was done, public notes and shared photos. Never prices, internal notes or secured details.
                    </p>
                    {canEdit && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ propertyId: s.property.id, askId: o.ask.id ?? '', share: true })}
                          className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                          Share them
                        </button>
                        <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ propertyId: s.property.id, askId: o.ask.id ?? '', share: false })}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          Say no
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    {o.ask.status === 'approved'
                      ? `You shared your records with ${s.property.name} on ${day(o.ask.decided_at)}${o.ask.copied ? `: ${count(o.ask.copied.equipment, 'equipment item', 'equipment items')}, ${count(o.ask.copied.projects, 'project', 'projects')}` : ''}.`
                      : `You said no to sharing your records with ${s.property.name} on ${day(o.ask.decided_at)}.`}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
      {viewing && (
        <TheirRecordsModal summary={viewing} customerId={customerId} canEdit={canEdit} locations={locations} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

function TheirRecordsModal({ summary, customerId, canEdit, locations, onClose }: {
  summary: PropertyRecordsSummary
  customerId: string
  canEdit: boolean
  locations: CustomerServiceLocation[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const base = `/v1/customers/${customerId}/property-records/${summary.property.id}`
  const q = useQuery({
    queryKey: [...key(customerId), summary.property.id, 'records'],
    queryFn: () => apiRequest<{ data: TheirRecords }>(`${base}/records`).then((r) => r.data),
  })
  const [tab, setTab] = useState<'equipment' | 'projects'>('equipment')
  const [adding, setAdding] = useState<string | null>(null)
  const [typeId, setTypeId] = useState('')
  const [locationId, setLocationId] = useState(locations.find((l) => l.is_primary)?.id ?? locations[0]?.id ?? '')
  const [error, setError] = useState('')
  const types = useAssetTypes({ active: true, per_page: 200 }).data?.data ?? []
  const add = useMutation({
    mutationFn: (itemId: string) => apiRequest(`${base}/equipment/${itemId}/add`, { method: 'POST', body: JSON.stringify({ asset_type_id: typeId, location_id: locationId }) }),
    onSuccess: () => {
      setAdding(null)
      setError('')
      void qc.invalidateQueries({ queryKey: [...key(customerId), summary.property.id, 'records'] })
      void qc.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (e: Error) => setError(e.message),
  })
  const startAdding = (item: TheirRecords['equipment'][number]) => {
    setError('')
    setAdding(item.id)
    // The type with the same name, when there is one.
    const same = types.find((t) => t.name.toLowerCase() === (item.type ?? '').toLowerCase())
    setTypeId(same?.id ?? '')
  }
  const data = q.data

  return (
    <Modal isOpen onClose={onClose} size="lg" title={`${summary.property.name}: ${(summary.trade ?? '').toLowerCase()} records`}
      subtitle="From other companies' work there. Never prices.">
      <Modal.Body>
        <div className="mb-3 flex gap-2" role="tablist">
          {(['equipment', 'projects'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${tab === t ? 'bg-navy-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {t === 'equipment' ? `Equipment (${data?.equipment.length ?? 0})` : `Projects (${data?.records.length ?? 0})`}
            </button>
          ))}
        </div>
        {q.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {q.isError && <p role="alert" className="text-sm text-red-700">{(q.error as Error).message}</p>}
        {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}

        {data && tab === 'equipment' && (
          <ul className="divide-y divide-slate-100">
            {data.equipment.length === 0 && <li className="py-3 text-sm text-slate-500">No equipment.</li>}
            {data.equipment.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{e.name}{e.tag && <span className="ml-1 text-slate-500">({e.tag})</span>}</div>
                    <div className="text-xs text-slate-500">
                      {[e.type, [e.manufacturer, e.model].filter(Boolean).join(' '), e.serial_number && `Serial ${e.serial_number}`, [e.building, e.unit && `Unit ${e.unit}`].filter(Boolean).join(', '), e.last_service_at && `Last serviced ${day(e.last_service_at)}`]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {e.added_asset_id ? (
                    <span className="text-xs font-medium text-emerald-700">Added to your equipment</span>
                  ) : canEdit && adding !== e.id && (
                    <button type="button" onClick={() => startAdding(e)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                      Add to our equipment
                    </button>
                  )}
                </div>
                {adding === e.id && (
                  <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-2">
                    <label className="text-xs text-slate-600">
                      Type
                      <select value={typeId} onChange={(ev) => setTypeId(ev.target.value)} className="mt-0.5 block w-48 rounded border border-slate-300 px-2 py-1 text-sm">
                        <option value="">Pick a type</option>
                        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">
                      Address
                      <select value={locationId} onChange={(ev) => setLocationId(ev.target.value)} className="mt-0.5 block w-64 rounded border border-slate-300 px-2 py-1 text-sm">
                        {locations.map((l) => <option key={l.id} value={l.id}>{l.nickname || l.address.formatted}</option>)}
                      </select>
                    </label>
                    <button type="button" disabled={!typeId || !locationId || add.isPending} onClick={() => add.mutate(e.id)}
                      className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                      {add.isPending ? 'Adding…' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setAdding(null)} className="px-2 py-1.5 text-xs text-slate-600 hover:underline">Cancel</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {data && tab === 'projects' && (
          <ul className="space-y-3">
            {data.records.length === 0 && <li className="text-sm text-slate-500">No projects.</li>}
            {data.records.map((r) => (
              <li key={r.id} className="rounded-md border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500">{[day(r.done_at), r.building, r.unit && `Unit ${r.unit}`].filter(Boolean).join(' · ')}</div>
                {r.entries.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-700">
                    {r.entries.map((e, i) => (
                      <li key={i}>
                        {[e.date, e.kind, e.equipment].filter(Boolean).join(' · ')}{e.summary && `: ${e.summary}`}{e.result && ` (${e.result})`}
                        {e.part?.number && <span className="text-slate-500"> · part {e.part.number}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {r.notes.map((n, i) => <p key={i} className="mt-1 text-xs text-slate-600">{n.body}</p>)}
                {r.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.photos.map((p) => <AuthedPhoto key={p.url} src={`${API_URL}${p.url}`} alt={p.name} />)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
    </Modal>
  )
}

/** A record photo: it needs the sign-in, so it's fetched rather than linked. */
function AuthedPhoto({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    const headers: Record<string, string> = { Accept: 'image/*' }
    const token = getStoredToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const tenant = getActingTenant()
    if (tenant) headers['X-Act-As-Tenant'] = tenant
    void fetch(src, { headers })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) {
          made = URL.createObjectURL(blob)
          setUrl(made)
        }
      })
      .catch(() => undefined)
    return () => {
      if (made) URL.revokeObjectURL(made)
    }
  }, [src])
  if (!url) return <div className="h-20 w-20 rounded bg-slate-100" aria-label={alt} />

  return <img src={url} alt={alt} className="h-20 w-20 rounded object-cover" />
}
