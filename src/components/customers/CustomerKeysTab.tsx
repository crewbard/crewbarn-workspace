import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiRequest, getActingTenant, getStoredToken, type ApiError } from '@/lib/api'
import { isFileResponse, NOT_A_FILE_MESSAGE } from '@/lib/fileResponse'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * A customer's key system, the office's side.
 *
 * The door schedule is what the customer sees in their portal: each door,
 * where it is, the key levels that open it, and how many keys are out.
 * Key levels are names (GM, SM1, CKAA3), never cuts or pin sizes; the key
 * builder stays in the shop. Below that, who holds keys, and what the
 * customer has asked for (more keys, a lost key, the holder list) to be
 * answered here.
 *
 * A property in the customer portal that names this company (on this
 * account) as the holder of its restricted key system shows it here,
 * read-only: the system, who may authorize copies, and the signed letter.
 */

interface Door {
  id: string
  door: string
  area: string | null
  key_levels: string[]
  keys_issued: number
  keys_total: number | null
}
interface Holder {
  id: string
  name: string
  door: string | null
  key_level: string | null
  key_count: number
  issued_on: string | null
  returned_on: string | null
  recorded_by: string
}
interface KeyAsk {
  id: string
  kind: 'more_keys' | 'lost_key' | 'holder_list'
  door: string | null
  quantity: number | null
  message: string | null
  status: 'open' | 'done' | 'declined'
  response_note: string | null
  asked_by: string | null
  created_at: string | null
}
interface HeldSystem {
  property_id: string
  property: string
  address: string | null
  manufacturer: string | null
  keyway: string | null
  system_number: string | null
  authorized: string[]
  notes: string | null
  letter: { name: string; uploaded_at: string | null } | null
  key_requests: boolean
  updated_at: string | null
}
interface KeysData {
  enabled: boolean
  /** Older APIs leave it out. */
  restricted?: HeldSystem[]
  doors: Door[]
  holders: Holder[]
  requests: KeyAsk[]
}

const KIND: Record<KeyAsk['kind'], string> = {
  more_keys: 'More keys',
  lost_key: 'Lost key',
  holder_list: 'Who holds keys',
}

const input = 'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

export function CustomerKeysTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient()
  const { has } = usePermissions()
  const canEdit = has('customers.edit')
  const key = ['customer-keys', customerId]
  const q = useQuery({ queryKey: key, queryFn: () => apiRequest<{ data: KeysData }>(`/v1/customers/${customerId}/keys`) })
  const [door, setDoor] = useState({ door_name: '', area: '', levels: '', keys_issued: '0', keys_total: '' })
  const [holder, setHolder] = useState({ holder_name: '', door_id: '', key_level: '', key_count: '1' })
  const [notes, setNotes] = useState<Record<string, string>>({})

  const [letterError, setLetterError] = useState<string | null>(null)

  const run = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) =>
      apiRequest<{ data: KeysData }>(`/v1/customers/${customerId}/keys${path}`, { method, body }),
    onSuccess: (res) => qc.setQueryData(key, res),
  })

  if (q.isLoading) return <div className="p-4 text-sm text-slate-500">Loading keys…</div>
  if (q.isError || !q.data) return <div className="p-4 text-sm text-red-700">Could not load the key schedule.</div>
  const d = q.data.data
  const open = d.requests.filter((r) => r.status === 'open')
  const out = d.holders.filter((h) => !h.returned_on)
  const held = d.restricted ?? []

  return (
    <div className="space-y-4" data-tour="customer-keys-tab" data-keys-portal={d.enabled ? 'on' : 'off'}>
      <section data-tour="customer-keys-portal" className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Key management in their portal</h3>
            <p className="mt-1 max-w-xl text-xs text-slate-600">
              When this is on, the customer's managers see the door schedule below in their portal, can ask for more keys or
              report one lost, and their key holders can record keys they hand out. They never see cuts or pinning.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={d.enabled}
              disabled={!canEdit || run.isPending}
              onChange={(e) => run.mutate({ path: '/settings', method: 'PATCH', body: { enabled: e.target.checked } })}
            />
            Show keys in their portal
          </label>
        </div>
        {run.isError && <p className="mt-2 text-xs text-red-700">{(run.error as ApiError)?.message ?? 'That did not save.'}</p>}
      </section>

      {open.length > 0 && (
        <section data-tour="customer-keys-waiting" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Waiting for you ({open.length})</h3>
          <ul className="mt-2 space-y-2">
            {open.map((r) => (
              <li key={r.id} className="rounded-md border border-amber-100 bg-white p-3 text-sm">
                <div className="font-medium text-slate-900">
                  {KIND[r.kind]}
                  {r.quantity ? ` · ${r.quantity}` : ''}
                  {r.door ? ` · ${r.door}` : ''}
                </div>
                <div className="text-xs text-slate-500">
                  {r.asked_by ?? 'The customer'}
                  {r.created_at ? ` · ${new Date(r.created_at).toLocaleString()}` : ''}
                </div>
                {r.message && <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{r.message}</p>}
                {canEdit && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className={`${input} max-w-sm`}
                      placeholder="Note to the customer (optional)"
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={run.isPending}
                      onClick={() => run.mutate({ path: `/requests/${r.id}/answer`, body: { status: 'done', response_note: notes[r.id] || null } })}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
                      disabled={run.isPending}
                      onClick={() => run.mutate({ path: `/requests/${r.id}/answer`, body: { status: 'declined', response_note: notes[r.id] || null } })}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {held.length > 0 && (
        <section data-tour="customer-keys-restricted" className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Restricted key systems you hold</h3>
          <p className="mt-1 max-w-xl text-xs text-slate-600">
            The property named you as the locksmith holding its system, in its customer portal, and keeps this up to date.
            Check each copy request against who may authorize copies.
          </p>
          <div className="mt-3 space-y-3">
            {held.map((s) => {
              const system = [s.manufacturer, s.keyway].filter(Boolean).join(' ')
              const rows: [string, string | null][] = [
                ['System', system || null],
                ['System number', s.system_number],
                ['May authorize copies', s.authorized.length ? s.authorized.join(', ') : null],
                ['Notes', s.notes],
              ]
              return (
                <div key={s.property_id} className="rounded-md border border-slate-100 p-3 text-sm">
                  <div className="font-medium text-slate-900">{s.property}</div>
                  {s.address && <div className="text-xs text-slate-500">{s.address}</div>}
                  <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs">
                    {rows.filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="m-0 whitespace-pre-wrap text-slate-800">{v}</dd>
                      </div>
                    ))}
                    {s.letter && (
                      <div className="contents">
                        <dt className="text-slate-500">Authorization letter</dt>
                        <dd className="m-0">
                          <button
                            type="button"
                            className="text-left font-medium text-amber-700 underline-offset-2 hover:underline"
                            onClick={() => {
                              setLetterError(null)
                              openHeldLetter(customerId, s.property_id).catch((e: Error) => setLetterError(e.message))
                            }}
                          >
                            {s.letter.name}
                          </button>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {s.key_requests && !d.enabled && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                      Residents' key requests from this property can't reach you until "Show keys in their portal" is on above.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {letterError && <p className="mt-2 text-xs text-red-700">{letterError}</p>}
        </section>
      )}

      <section data-tour="customer-keys-doors" className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Door schedule</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Door</th>
                <th className="py-2">Area</th>
                <th className="py-2">Key levels</th>
                <th className="py-2">Keys out</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.doors.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-xs text-slate-500">No doors yet. Add the first one below.</td>
                </tr>
              )}
              {d.doors.map((x) => (
                <tr key={x.id}>
                  <td className="py-2 font-medium text-slate-900">{x.door}</td>
                  <td className="py-2 text-slate-600">{x.area ?? '—'}</td>
                  <td className="py-2 text-slate-600">{x.key_levels.join(' · ') || '—'}</td>
                  <td className="py-2 text-slate-600">
                    {x.keys_issued}
                    {x.keys_total !== null ? ` of ${x.keys_total}` : ''}
                  </td>
                  <td className="py-2 text-right">
                    {canEdit && (
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline"
                        onClick={() => window.confirm(`Take ${x.door} off the schedule?`) && run.mutate({ path: `/doors/${x.id}`, method: 'DELETE' })}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault()
              run.mutate(
                {
                  path: '/doors',
                  body: {
                    door_name: door.door_name,
                    area: door.area || null,
                    key_levels: door.levels.split(/[,·]/).map((s) => s.trim()).filter(Boolean),
                    keys_issued: Number(door.keys_issued || 0),
                    keys_total: door.keys_total ? Number(door.keys_total) : null,
                  },
                },
                { onSuccess: (res) => { qc.setQueryData(key, res); setDoor({ door_name: '', area: '', levels: '', keys_issued: '0', keys_total: '' }) } },
              )
            }}
          >
            <input className={`${input} sm:col-span-2`} required placeholder="Door, e.g. Level 3 fire door" value={door.door_name} onChange={(e) => setDoor({ ...door, door_name: e.target.value })} />
            <input className={input} placeholder="Area" value={door.area} onChange={(e) => setDoor({ ...door, area: e.target.value })} />
            <input className={input} placeholder="Key levels: GM, SM1" value={door.levels} onChange={(e) => setDoor({ ...door, levels: e.target.value })} />
            <input className={input} type="number" min={0} placeholder="Out" value={door.keys_issued} onChange={(e) => setDoor({ ...door, keys_issued: e.target.value })} />
            <div className="flex gap-2">
              <input className={input} type="number" min={0} placeholder="Of" value={door.keys_total} onChange={(e) => setDoor({ ...door, keys_total: e.target.value })} />
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={run.isPending}>Add</button>
            </div>
          </form>
        )}
      </section>

      <section data-tour="customer-keys-holders" className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Who holds keys ({out.length})</h3>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {d.holders.length === 0 && <li className="py-2 text-xs text-slate-500">Nobody recorded yet.</li>}
          {d.holders.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className={`min-w-0 flex-1 ${h.returned_on ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                <b>{h.name}</b> · {h.key_count} key{h.key_count === 1 ? '' : 's'}
                {h.key_level ? ` · ${h.key_level}` : ''}
                {h.door ? ` · ${h.door}` : ''}
                {h.issued_on ? ` · since ${h.issued_on}` : ''}
                {h.recorded_by === 'customer' ? ' · recorded by the customer' : ''}
              </span>
              {!h.returned_on && canEdit && (
                <button type="button" className="text-xs text-slate-700 underline" onClick={() => run.mutate({ path: `/holders/${h.id}/return` })}>
                  Returned
                </button>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault()
              run.mutate(
                {
                  path: '/holders',
                  body: { holder_name: holder.holder_name, door_id: holder.door_id || null, key_level: holder.key_level || null, key_count: Number(holder.key_count || 1) },
                },
                { onSuccess: (res) => { qc.setQueryData(key, res); setHolder({ holder_name: '', door_id: '', key_level: '', key_count: '1' }) } },
              )
            }}
          >
            <input className={`${input} sm:col-span-2`} required placeholder="Who has the key" value={holder.holder_name} onChange={(e) => setHolder({ ...holder, holder_name: e.target.value })} />
            <select className={input} value={holder.door_id} onChange={(e) => setHolder({ ...holder, door_id: e.target.value })}>
              <option value="">Any door</option>
              {d.doors.map((x) => <option key={x.id} value={x.id}>{x.door}</option>)}
            </select>
            <input className={input} placeholder="Key level" value={holder.key_level} onChange={(e) => setHolder({ ...holder, key_level: e.target.value })} />
            <div className="flex gap-2">
              <input className={input} type="number" min={1} value={holder.key_count} onChange={(e) => setHolder({ ...holder, key_count: e.target.value })} />
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={run.isPending}>Issue</button>
            </div>
          </form>
        )}
      </section>

      {d.requests.some((r) => r.status !== 'open') && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Answered</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-xs text-slate-600">
            {d.requests.filter((r) => r.status !== 'open').map((r) => (
              <li key={r.id} className="py-2">
                {KIND[r.kind]}{r.door ? ` · ${r.door}` : ''} · {r.status === 'done' ? 'Done' : 'Declined'}
                {r.response_note ? ` · ${r.response_note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * A held system's authorization letter. It wants the sign-in, so it's
 * fetched and opened, not linked; the tab opens inside the click so popup
 * blockers allow it.
 */
async function openHeldLetter(customerId: string, propertyId: string): Promise<void> {
  const tab = window.open('', '_blank')
  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting) headers['X-Act-As-Tenant'] = acting
  const res = await fetch(`${API_URL}/v1/customers/${customerId}/keys/restricted/${propertyId}/letter`, { headers })
  if (!res.ok || !isFileResponse(res)) {
    tab?.close()
    throw new Error(res.ok ? NOT_A_FILE_MESSAGE : "The authorization letter couldn't be opened.")
  }
  const url = URL.createObjectURL(await res.blob())
  if (tab) tab.location.href = url
  else window.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
