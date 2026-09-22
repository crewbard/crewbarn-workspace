import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError } from '@/lib/api'

/**
 * Tool Shed → Modules: the work-dashboard builder.
 *
 * Tick the parts of CrewBarn this workspace actually uses; everything else
 * leaves the navigation, the Tool Shed and the phone apps. The catalog,
 * dependencies and presets all come from the server
 * (App\Services\Modules\ModuleCatalog) so this screen never has its own idea
 * of what exists.
 *
 * Two things this page is careful about:
 *
 *   Dependencies are shown before they bite. Turning off Inventory has to take
 *   Purchasing with it — the server cascades, and this says so up front rather
 *   than silently unticking boxes after the save.
 *
 *   It says out loud that the bill does not change. People assume ticking less
 *   is cheaper; it is a seat price, and finding that out after the fact feels
 *   like a bait and switch.
 *
 * Writes the same ['settings-modules'] query the nav reads, so the navigation
 * re-filters the moment it saves.
 */

interface ModuleRow {
  key: string
  name: string
  description: string
  includes: string[]
  requires: string[]
  required_by: string[]
  core: boolean
  routes: string[]
}

interface PresetRow {
  key: string
  name: string
  description: string
}

interface ModulesResponse {
  data: {
    toggleable: string[]
    /** Includes the old four-key names for phones on an older bundle. */
    disabled_modules: string[]
    /** Catalog keys only — what this page edits. */
    disabled_modules_catalog?: string[]
    enabled_modules: string[]
    cascaded: string[]
    catalog: ModuleRow[]
    presets: PresetRow[]
  }
}

export function SettingsModulesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['settings-modules'],
    queryFn: () => apiRequest<ModulesResponse>('/v1/settings/modules'),
    staleTime: 5 * 60_000,
  })

  const catalog = useMemo(() => data?.data.catalog ?? [], [data])
  const byKey = useMemo(() => Object.fromEntries(catalog.map((m) => [m.key, m])), [catalog])

  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  /**
   * Catalog keys only. The response also carries the old four-key names
   * (billing, workflow) so phones on an older bundle keep filtering — but if
   * those landed in this page's state they would be sent straight back on
   * save, and the server expands "billing" to estimates + invoicing. Turning
   * invoicing back on would then silently turn it off again.
   */
  const catalogKeysOnly = (res: ModulesResponse) =>
    res.data.disabled_modules_catalog ?? res.data.disabled_modules.filter((k) => res.data.catalog.some((m) => m.key === k))

  useEffect(() => {
    if (data) setDisabled(new Set(catalogKeysOnly(data)))
  }, [data])

  const save = useMutation({
    mutationFn: (body: { disabled_modules?: string[]; preset?: string }) =>
      apiRequest<ModulesResponse>('/v1/settings/modules', { method: 'PATCH', body }),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings-modules'], res)
      setDisabled(new Set(catalogKeysOnly(res)))
      setSavedAt(new Date())
      setErr(null)
      const extra = res.data.cascaded
      setNote(
        extra.length
          ? `Also switched off: ${extra.map((k) => byKey[k]?.name ?? k).join(', ')} — ${extra.length === 1 ? 'it needs' : 'they need'} something you turned off.`
          : null,
      )
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Could not save that.'),
  })

  /** What turning this off would take with it, computed here so it can be said before saving. */
  function casualties(key: string): string[] {
    const out = new Set<string>()
    const walk = (k: string) => {
      for (const m of catalog) {
        if (m.requires.includes(k) && !out.has(m.key)) {
          out.add(m.key)
          walk(m.key)
        }
      }
    }
    walk(key)
    return [...out].filter((k) => !disabled.has(k))
  }

  function toggle(key: string, on: boolean) {
    const next = new Set(disabled)
    if (on) {
      next.delete(key)
      // Turning something on needs its dependencies on too.
      for (const need of byKey[key]?.requires ?? []) next.delete(need)
    } else {
      next.add(key)
      for (const k of casualties(key)) next.add(k)
    }
    setDisabled(next)
  }

  const dirty = useMemo(() => {
    const saved = new Set(data ? catalogKeysOnly(data) : [])
    return saved.size !== disabled.size || [...disabled].some((k) => !saved.has(k))
  }, [data, disabled])

  const onCount = catalog.filter((m) => m.core || !disabled.has(m.key)).length

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Loading…</div>
  if (isError) return <div className="p-6 text-sm text-red-700">{error instanceof ApiError ? error.message : 'Could not load modules.'}</div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900">Build your dashboard</h1>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Tick what this workspace uses. Everything else leaves the navigation, the Tool Shed and the phone apps —
        for everyone here, not just you. Nothing is deleted, and you can turn it back on whenever.
      </p>
      <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <b>Turning things off doesn't change your bill.</b> CrewBarn is priced per person who signs in — this
        changes what your app looks like, not what it costs.
      </p>

      {/* Presets */}
      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Start from</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(data?.data.presets ?? []).map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.description}
              onClick={() => {
                if (window.confirm(`Start from "${p.name}"? ${p.description} You can change anything after.`)) {
                  save.mutate({ preset: p.key })
                }
              }}
              disabled={save.isPending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* The catalog */}
      <div className="mt-5 space-y-2">
        {catalog.map((m) => {
          const on = m.core || !disabled.has(m.key)
          const wouldTake = on && !m.core ? casualties(m.key) : []
          const blockedBy = m.requires.filter((r) => disabled.has(r))
          return (
            <div
              key={m.key}
              className={`rounded-xl border p-4 ${on ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={m.core || save.isPending || blockedBy.length > 0}
                  onChange={(e) => toggle(m.key, e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 disabled:opacity-40"
                  aria-label={m.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold ${on ? 'text-slate-900' : 'text-slate-500'}`}>{m.name}</span>
                    {m.core && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">always on</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">{m.description}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{m.includes.join(' · ')}</div>

                  {blockedBy.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-amber-700">
                      Needs {blockedBy.map((k) => byKey[k]?.name ?? k).join(' and ')} switched on first.
                    </div>
                  )}
                  {wouldTake.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-slate-500">
                      Switching this off also removes {wouldTake.map((k) => byKey[k]?.name ?? k).join(', ')}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <span className="text-sm text-slate-600">
          <b className="text-slate-900">{onCount}</b> of {catalog.length} areas on
        </span>
        <button
          type="button"
          onClick={() => save.mutate({ disabled_modules: [...disabled] })}
          disabled={!dirty || save.isPending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {dirty && !save.isPending && <span className="text-xs text-amber-700">Unsaved changes</span>}
        {!dirty && savedAt && <span className="text-xs text-emerald-700">Saved {savedAt.toLocaleTimeString()}</span>}
        {note && <span className="text-xs text-slate-600">{note}</span>}
        {err && <span className="text-xs text-red-700">{err}</span>}
      </div>
    </div>
  )
}
