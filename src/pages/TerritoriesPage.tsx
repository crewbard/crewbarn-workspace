import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError } from '@/lib/api'

/**
 * Territories map county ZIP coverage to service locations, jobs, and dispatchers.
 */
interface DispatcherOption {
  id: string
  name: string
  email?: string
}

interface CountyOption {
  county: string
  state: string
  label: string
  zip_count: number
  zips: string[]
}

interface Territory {
  id: string
  name: string
  county: string | null
  state: string | null
  service_area_zips: string[] | null
  is_primary: boolean
  status: 'active' | 'inactive'
  dispatcher_account_ids: string[]
  dispatchers: DispatcherOption[]
}

const blank = (): Partial<Territory> => ({
  name: '', county: '', state: '', service_area_zips: [], is_primary: false, status: 'active',
  dispatcher_account_ids: [], dispatchers: [],
})

const INPUT = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none'

export function TerritoriesPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Partial<Territory> | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['territories'],
    queryFn: () => apiRequest<{ data: Territory[]; dispatchers: DispatcherOption[] }>('/v1/territories'),
  })

  const territories = data?.data ?? []
  const dispatchers = data?.dispatchers ?? []

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/territories/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['territories'] }),
  })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy-900">Territories</h1>
          <p className="text-sm text-slate-600 mt-1">
            Define county-based service areas and assign the dispatchers responsible for each one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(blank())}
          className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium shrink-0"
        >
          + Add territory
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        ) : isError ? (
          <div className="p-6 text-sm text-red-700">Failed to load territories.</div>
        ) : territories.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No territories yet. Add one for each county / area you operate.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {territories.map((t) => (
              <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy-900 truncate">{t.name}</span>
                    {t.is_primary && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Primary</span>
                    )}
                    {t.status === 'inactive' && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {[t.county, t.state].filter(Boolean).join(', ') || '—'}
                    {t.service_area_zips && t.service_area_zips.length > 0
                      ? ` · ${t.service_area_zips.length} zip${t.service_area_zips.length === 1 ? '' : 's'}`
                      : ''}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    <span className="font-medium">Dispatch:</span>{' '}
                    {t.dispatchers.length > 0
                      ? t.dispatchers.map((dispatcher) => dispatcher.name).join(', ')
                      : 'Not assigned'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setEditing(t)} className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 font-medium text-navy-900">Edit</button>
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Delete ${t.name}?`)) remove.mutate(t.id) }}
                    className="text-xs px-3 py-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <TerritoryModal initial={editing} dispatchers={dispatchers} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TerritoryModal({ initial, dispatchers, onClose }: { initial: Partial<Territory>; dispatchers: DispatcherOption[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const isEdit = !!initial.id
  const [form, setForm] = useState<Partial<Territory>>({ ...initial })
  const [zips, setZips] = useState<string[]>(initial.service_area_zips ?? [])
  const [zipInput, setZipInput] = useState('')
  const [zipError, setZipError] = useState<string | null>(null)
  const [countyQuery, setCountyQuery] = useState('')
  const [debouncedCounty, setDebouncedCounty] = useState('')
  const [countyNote, setCountyNote] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedCounty(countyQuery.trim()), 250)
    return () => clearTimeout(timeout)
  }, [countyQuery])

  const countiesQuery = useQuery({
    queryKey: ['geo-counties', debouncedCounty],
    queryFn: () => apiRequest<{ data: CountyOption[] }>(`/v1/geo/counties?q=${encodeURIComponent(debouncedCounty)}`),
    enabled: debouncedCounty.length >= 2,
  })
  const countyMatches = debouncedCounty.length >= 2 ? countiesQuery.data?.data ?? [] : []

  const set = (key: keyof Territory) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  function selectCounty(county: CountyOption) {
    setForm((current) => ({
      ...current,
      name: `${county.county} County`,
      county: county.county,
      state: county.state,
    }))
    setZips(county.zips)
    setCountyQuery('')
    setDebouncedCounty('')
    setCountyNote(`${county.zip_count} ZIP codes loaded from ${county.label}.`)
  }

  function addZip() {
    const value = zipInput.trim()
    if (!/^\d{5}$/.test(value)) {
      setZipError('Enter a five-digit ZIP code.')
      return
    }
    setZips((current) => current.includes(value) ? current : [...current, value].sort())
    setZipInput('')
    setZipError(null)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name?.trim(),
        county: form.county?.trim() || null,
        state: form.state?.trim().toUpperCase() || null,
        service_area_zips: zips,
        is_primary: !!form.is_primary,
        status: form.status ?? 'active',
        dispatcher_account_ids: form.dispatcher_account_ids ?? [],
      }
      return isEdit
        ? apiRequest(`/v1/territories/${initial.id}`, { method: 'PATCH', body })
        : apiRequest('/v1/territories', { method: 'POST', body })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      onClose()
    },
  })

  const err = mutation.error instanceof ApiError ? mutation.error.message : null
  const canSave = (form.name ?? '').trim().length > 0 && zips.length > 0
  const selectedCounty = [form.county, form.state].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-navy-900">{isEdit ? 'Edit territory' : 'Add territory'}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Choose a county to load its ZIP codes, then assign dispatch coverage.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="p-6 space-y-5">
          <section className="space-y-3">
            <div className="relative">
              <L label="County coverage" hint="Start typing and choose a county from the results.">
                <input
                  value={countyQuery}
                  onChange={(event) => {
                    setCountyQuery(event.target.value)
                    setCountyNote(null)
                  }}
                  className={INPUT}
                  placeholder="Search county, e.g. Orange"
                  autoComplete="off"
                />
              </L>
              {countyMatches.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {countyMatches.map((county) => (
                    <li key={`${county.state}-${county.county}`}>
                      <button
                        type="button"
                        onClick={() => selectCounty(county)}
                        className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-amber-50"
                      >
                        <span className="font-medium text-slate-800">{county.label}</span>
                        <span className="shrink-0 text-xs text-slate-500">{county.zip_count} ZIPs</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedCounty && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-sm font-medium text-emerald-900">{selectedCounty}</div>
                <div className="text-xs text-emerald-700">{countyNote ?? `${zips.length} ZIP codes assigned to this territory.`}</div>
              </div>
            )}

            <L label="Territory name" hint="This is the label dispatchers see on the Dispatch board.">
              <input value={form.name ?? ''} onChange={set('name')} className={INPUT} placeholder="Orange County" />
            </L>
          </section>

          <section className="border-t border-slate-200 pt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-semibold text-slate-700">Service-area ZIP codes</h4>
                <span className="text-xs text-slate-500">{zips.length} selected</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">Jobs are assigned to this territory when the service location matches one of these ZIP codes.</p>
            </div>

            <div className="flex gap-2">
              <input
                value={zipInput}
                onChange={(event) => {
                  setZipInput(event.target.value.replace(/\D/g, '').slice(0, 5))
                  setZipError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addZip()
                  }
                }}
                className={INPUT}
                inputMode="numeric"
                placeholder="Add ZIP manually"
              />
              <button
                type="button"
                onClick={addZip}
                disabled={zipInput.length !== 5}
                className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add ZIP
              </button>
            </div>
            {zipError && <p className="text-xs text-red-700">{zipError}</p>}

            {zips.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
                Select a county or add at least one ZIP code.
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="flex flex-wrap gap-1.5">
                  {zips.map((zip) => (
                    <span key={zip} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {zip}
                      <button
                        type="button"
                        onClick={() => setZips((current) => current.filter((candidate) => candidate !== zip))}
                        className="ml-0.5 text-slate-400 hover:text-red-600"
                        aria-label={`Remove ZIP ${zip}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <fieldset className="border-t border-slate-200 pt-4">
            <legend className="text-xs font-semibold text-slate-700 pr-2">Assigned dispatchers</legend>
            <p className="text-[11px] text-slate-500 mb-3">
              Assigned dispatchers open Dispatch in this territory by default. Select more than one for backup coverage.
            </p>
            {dispatchers.length === 0 ? (
              <p className="text-xs text-slate-500">No active users have the Dispatcher role.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dispatchers.map((dispatcher) => {
                  const selected = (form.dispatcher_account_ids ?? []).includes(dispatcher.id)
                  return (
                    <label key={dispatcher.id} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${selected ? 'border-amber-300 bg-amber-50' : 'border-slate-200 text-slate-700'}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          dispatcher_account_ids: event.target.checked
                            ? [...(current.dispatcher_account_ids ?? []), dispatcher.id]
                            : (current.dispatcher_account_ids ?? []).filter((id) => id !== dispatcher.id),
                        }))}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{dispatcher.name}</span>
                        {dispatcher.email ? <span className="block text-[11px] text-slate-500 truncate">{dispatcher.email}</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <div className="flex items-center gap-5 border-t border-slate-200 pt-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!form.is_primary} onChange={(event) => setForm((current) => ({ ...current, is_primary: event.target.checked }))} />
              Primary territory
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.status !== 'inactive'} onChange={(event) => setForm((current) => ({ ...current, status: event.target.checked ? 'active' : 'inactive' }))} />
              Active
            </label>
          </div>

          {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button
              type="button"
              disabled={!canSave || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-medium"
            >
              {mutation.isPending ? 'Saving…' : 'Save territory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}
