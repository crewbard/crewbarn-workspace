import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { DASHBOARD_WIDGETS } from '@/components/dashboard/widgets'

interface Role {
  role_slug: string
  display_name: string
  description: string | null
  permissions: string[]
  data_scopes: Record<string, 'all' | 'own'>
  sort_order: number
  is_system: boolean
  /** null = all widgets allowed for this role; array = restricted. */
  dashboard_widget_ids: string[] | null
}

interface CatalogGroup {
  group: string
  items: { key: string; label: string }[]
}

interface IndexResp {
  data: Role[]
  catalog: CatalogGroup[]
}

interface AuditRow {
  id: string
  created_at: string
  actor: string
  action: 'role_created' | 'role_updated' | 'role_deleted'
  role_slug: string
  role_display_name: string | null
  diff: { added: string[]; removed: string[] }
}

interface PermissionBaseline {
  name: string
  description: string
  permissions: string
  jobScope: 'all' | 'own'
  widgets: string
}

function setKey(values: Iterable<string>): string {
  return Array.from(new Set(values)).sort().join(',')
}

function widgetsKey(ids: string[] | null): string {
  return ids === null ? 'ALL' : `ONLY:${setKey(ids)}`
}

function baselineFromRole(role: Role): PermissionBaseline {
  return {
    name: role.display_name,
    description: role.description ?? '',
    permissions: setKey(role.permissions),
    jobScope: role.data_scopes?.jobs ?? 'all',
    widgets: widgetsKey(role.dashboard_widget_ids ?? null),
  }
}

/**
 * Tool Shed → People → Roles & Permissions.
 *
 * Left: list of roles (system + custom) with member counts and a "+ New role"
 *       button.
 * Right: when a role is selected, the permission matrix grouped by area, plus
 *        the audit trail for that role (or all roles when none selected).
 *
 * Owner is a permanent full-access role. The API hard-enforces that safety
 * net; the UI presents it read-only so nobody can lock the owner out.
 */
export function RolesPermissionsPage() {
  const { has } = usePermissions()
  const canEdit = has(PERM.STAFF_EDIT)

  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['tenant-roles'],
    queryFn: () => apiRequest<IndexResp>('/v1/tenant-roles'),
  })

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAudit, setShowAudit] = useState(false)

  useEffect(() => {
    if (!selectedSlug && list.data?.data?.length) {
      setSelectedSlug(list.data.data[0].role_slug)
    }
  }, [list.data, selectedSlug])

  const selected = list.data?.data.find((r) => r.role_slug === selectedSlug) ?? null
  const catalog = list.data?.catalog ?? []

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Roles & permissions</h1>
          <p className="text-sm text-slate-600 mt-1">
            What each role can do in CrewBarn. Per-role permissions are editable —
            assign roles to staff under Tool Shed → People → Staff & Crews.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="text-sm px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {showAudit ? 'Hide audit log' : 'Audit log'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
            >
              + New role
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="mt-4 rounded-lg p-4 text-sm border bg-amber-50 border-amber-200 text-amber-900">
          Read-only — your role doesn&apos;t include <code>staff.edit</code>. Ask the
          shop owner if you should be able to edit roles.
        </div>
      )}

      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* Left: role list */}
        <div className="col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {list.isLoading && (
              <div className="px-4 py-8 text-sm text-slate-500 text-center">Loading…</div>
            )}
            {(list.data?.data ?? []).map((r) => (
              <button
                key={r.role_slug}
                type="button"
                onClick={() => setSelectedSlug(r.role_slug)}
                className={[
                  'w-full text-left px-4 py-3 border-l-4 transition-colors',
                  r.role_slug === selectedSlug
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-transparent hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-navy-900">{r.display_name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {r.is_system ? 'System' : 'Custom'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {r.role_slug === 'owner'
                    ? 'Full access, locked'
                    : `${r.permissions.length} permission${r.permissions.length === 1 ? '' : 's'}`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: permission matrix */}
        <div className="col-span-8">
          {selected ? (
            <PermissionMatrix
              role={selected}
              catalog={catalog}
              canEdit={canEdit}
              onSaved={() => qc.invalidateQueries({ queryKey: ['tenant-roles'] })}
              onDeleted={() => {
                qc.invalidateQueries({ queryKey: ['tenant-roles'] })
                setSelectedSlug(null)
              }}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-sm text-slate-500">
              Pick a role on the left to view + edit its permissions.
            </div>
          )}
        </div>
      </div>

      {showAudit && <AuditLogPanel />}

      {showCreate && canEdit && (
        <CreateRoleModal
          catalog={catalog}
          onClose={() => setShowCreate(false)}
          onCreated={(slug) => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['tenant-roles'] })
            setSelectedSlug(slug)
          }}
        />
      )}
    </div>
  )
}

function PermissionMatrix({
  role,
  catalog,
  canEdit,
  onSaved,
  onDeleted,
}: {
  role: Role
  catalog: CatalogGroup[]
  canEdit: boolean
  onSaved: () => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(role.display_name)
  const [description, setDescription] = useState(role.description ?? '')
  /**
   * Keys the server will accept. The catalog is generated from
   * Permissions::ALL, so anything stored on the role that is NOT here is a
   * leftover from before a permission was renamed — invisible in the UI
   * (nothing renders it), impossible to untick, and sent back on every save
   * until the server rejects the lot with "The selected permissions.N is
   * invalid." Filtering on load drops it, and the next save cleans the row.
   */
  const knownKeys = useMemo(
    () => new Set(catalog.flatMap((g) => g.items.map((i) => i.key))),
    [catalog],
  )

  const [draft, setDraft] = useState<Set<string>>(
    () => new Set(role.permissions.filter((k) => knownKeys.has(k))),
  )
  const [jobScope, setJobScope] = useState<'all' | 'own'>(role.data_scopes?.jobs ?? 'all')
  const [restrictWidgets, setRestrictWidgets] = useState(Array.isArray(role.dashboard_widget_ids))
  const [allowedWidgets, setAllowedWidgets] = useState<Set<string>>(
    new Set(role.dashboard_widget_ids ?? DASHBOARD_WIDGETS.map((w) => w.id)),
  )
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [baseline, setBaseline] = useState<PermissionBaseline>(() => baselineFromRole(role))

  const isOwner = role.role_slug === 'owner'
  const editable = canEdit && !isOwner

  useEffect(() => {
    setName(role.display_name)
    setDescription(role.description ?? '')
    setDraft(new Set(role.permissions.filter((k) => knownKeys.has(k))))
    setJobScope(role.data_scopes?.jobs ?? 'all')
    setRestrictWidgets(Array.isArray(role.dashboard_widget_ids))
    setAllowedWidgets(new Set(role.dashboard_widget_ids ?? DASHBOARD_WIDGETS.map((w) => w.id)))
    setBaseline(baselineFromRole(role))
    setSavedAt(null)
  }, [role.role_slug, role.permissions.join(','), role.display_name, role.description, role.data_scopes?.jobs, (role.dashboard_widget_ids ?? []).join(',')])

  const widgetIdsForSave = restrictWidgets ? Array.from(allowedWidgets) : null

  const toggleWidget = (id: string) =>
    setAllowedWidgets((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const save = useMutation({
    mutationFn: () =>
      apiRequest<{ data: Role }>(`/v1/tenant-roles/${role.role_slug}`, {
        method: 'PATCH',
        body: {
          display_name: name,
          description,
          permissions: Array.from(draft),
          data_scopes: { jobs: jobScope },
          dashboard_widget_ids: widgetIdsForSave,
        },
      }),
    onSuccess: (response) => {
      setSaveError(null)
      setBaseline(baselineFromRole(response.data))
      setSavedAt(new Date())
      onSaved()
    },
    // Without this a rejected save was completely silent: the button did
    // nothing, "Unsaved changes" stayed put, and the only evidence was a 422 in
    // the browser console. The server says exactly which field it refused —
    // that belongs on screen, not in devtools.
    onError: (e: unknown) => setSaveError(e instanceof Error ? e.message : 'Could not save permissions.'),
  })

  const del = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/tenant-roles/${role.role_slug}`, { method: 'DELETE' }),
    onSuccess: onDeleted,
  })

  function toggle(key: string) {
    if (!editable) return

    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }


  const dirty =
    !isOwner &&
    (name !== baseline.name ||
      description !== baseline.description ||
      setKey(draft) !== baseline.permissions ||
      jobScope !== baseline.jobScope ||
      widgetsKey(widgetIdsForSave) !== baseline.widgets)

  if (isOwner) {
    return (
      <div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-navy-900">Owner</h2>
              <p className="text-sm text-slate-600 mt-1">
                Full access to every area of this company. Owner cannot be restricted,
                deleted, or narrowed by dashboard widgets.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              Locked full access
            </span>
          </div>

          <div className="mt-5 grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Permissions</div>
              <p className="text-xs text-slate-500 mt-1">Everything is allowed.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Job visibility</div>
              <p className="text-xs text-slate-500 mt-1">All jobs, customers, money, and settings.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Dashboard</div>
              <p className="text-xs text-slate-500 mt-1">All widgets remain available.</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            To change who is an owner, use Staff &amp; Crews. Only a current owner can
            invite, promote, demote, or disable another owner.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-baseline justify-between">
          <div className="flex-1">
            {canEdit ? (
              <>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg font-semibold text-navy-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-amber-400 outline-none w-full"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  role slug: <code>{role.role_slug}</code>
                  {role.is_system && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">System</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-navy-900">{role.display_name}</h2>
                <p className="text-xs text-slate-500">role slug: <code>{role.role_slug}</code></p>
              </>
            )}
          </div>
          <span className="text-xs text-slate-500 shrink-0 ml-3">
            {draft.size} of {catalog.reduce((acc, g) => acc + g.items.length, 0)} permissions
          </span>
        </div>

        {canEdit && (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (shown next to the role in lists)"
            rows={2}
            className="mt-3 w-full text-xs text-slate-600 bg-transparent border border-slate-200 rounded-md p-2 focus:outline-none focus:border-amber-400"
          />
        )}

        {/* Job visibility scope — orthogonal to the .view permission. */}
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Job visibility
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Which jobs can this role see? Only takes effect when the role also has{' '}
            <code>jobs.view</code>.
          </p>
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="jobScope"
                checked={jobScope === 'all'}
                disabled={!canEdit}
                onChange={() => canEdit && setJobScope('all')}
                className="mt-0.5 text-amber-600 focus:ring-amber-500"
              />
              <div className="text-sm">
                <div className="font-medium text-slate-900">All jobs in the shop</div>
                <div className="text-xs text-slate-500">
                  Default. Sees every WO regardless of who&apos;s assigned.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="jobScope"
                checked={jobScope === 'own'}
                disabled={!canEdit}
                onChange={() => canEdit && setJobScope('own')}
                className="mt-0.5 text-amber-600 focus:ring-amber-500"
              />
              <div className="text-sm">
                <div className="font-medium text-slate-900">Only their own jobs</div>
                <div className="text-xs text-slate-500">
                  Sees only WOs where they&apos;re the lead tech. Recommended for field tech roles.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Dashboard widgets — which widgets this role may use. Per-employee
            override (Staff & Crews) wins over this default. */}
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Dashboard widgets
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={restrictWidgets}
              disabled={!canEdit}
              onChange={(e) => canEdit && setRestrictWidgets(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-slate-900">Restrict which widgets this role sees</span>
          </label>
          <p className="text-xs text-slate-500 mt-1">
            Off = this role can use every dashboard widget. On = only the checked ones. A person&apos;s
            own setting (Staff &amp; Crews → edit) overrides this.
          </p>
          {restrictWidgets && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 border border-slate-200 rounded-md bg-white p-2 max-h-56 overflow-y-auto">
              {DASHBOARD_WIDGETS.map((w) => (
                <label key={w.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={allowedWidgets.has(w.id)}
                    disabled={!canEdit}
                    onChange={() => canEdit && toggleWidget(w.id)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-800">{w.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Access by area
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Keep this simple: view lets someone see records, edit lets them change records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {showAdvanced ? 'Hide codes' : 'Advanced codes'}
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {catalog.map((group) => (
            <section key={group.group}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {groupLabel(group.group)}
              </div>
              <ul className="space-y-1">
                {group.items.map((p) => {
                  const isLocked = role.role_slug === 'owner' && OWNER_LOCKED.has(p.key)
                  const active = draft.has(p.key) || isLocked
                  return (
                    <li key={p.key}>
                      <label
                        className={[
                          'flex items-center gap-3 py-1 px-2 -mx-2 rounded',
                          canEdit && !isLocked ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          disabled={!canEdit || isLocked}
                          onChange={() => toggle(p.key)}
                          className="rounded text-amber-600 focus:ring-amber-500 disabled:opacity-60"
                        />
                        <span className="text-sm text-slate-800 flex-1">{p.label}</span>
                        {showAdvanced && <code className="text-[10px] text-slate-400">{p.key}</code>}
                        {isLocked && (
                          <span className="text-[10px] uppercase tracking-wide text-amber-700">
                            Locked
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {canEdit && saveError && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          <span>
            <strong className="font-semibold">Permissions not saved.</strong> {saveError}
          </span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="shrink-0 font-semibold text-rose-600 hover:text-rose-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex items-center justify-between sticky bottom-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              {dirty
                ? 'Unsaved changes'
                : savedAt
                ? `Saved ${savedAt.toLocaleTimeString()}`
                : 'No changes'}
            </div>
            {!role.is_system && (
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-xs px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50 border border-red-200"
              >
                Delete role
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      )}
    </div>
  )
}

function CreateRoleModal({
  catalog,
  onClose,
  onCreated,
}: {
  catalog: CatalogGroup[]
  onClose: () => void
  onCreated: (slug: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [jobScope, setJobScope] = useState<'all' | 'own'>('all')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ data: Role }>('/v1/tenant-roles', {
        method: 'POST',
        body: {
          display_name: name,
          description: description || null,
          permissions: Array.from(draft),
          data_scopes: { jobs: jobScope },
        },
      }),
    onSuccess: (resp) => onCreated(resp.data.role_slug),
    onError: (e: Error) => setError(e.message),
  })

  function toggle(k: string) {
    setDraft((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  function applyPreset(preset: RolePreset) {
    setSelectedPreset(preset.id)
    setName(preset.name)
    setDescription(preset.description)
    setDraft(new Set(preset.permissions))
    setJobScope(preset.jobScope)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">New custom role</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <div>
            <div className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
              Start from a plain-English preset
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={[
                    'text-left rounded-lg border p-3 transition-colors',
                    selectedPreset === preset.id
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="text-sm font-semibold text-slate-900">{preset.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Field Lead, Bookkeeper"
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role can do"
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Job visibility
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={jobScope === 'all'}
                  onChange={() => setJobScope('all')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900">All jobs in the shop</div>
                  <div className="text-xs text-slate-500">Best for office, dispatch, admin, and managers.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={jobScope === 'own'}
                  onChange={() => setJobScope('own')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900">Only their assigned jobs</div>
                  <div className="text-xs text-slate-500">Best for field techs and helpers.</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                Permissions ({draft.size} selected)
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                {showAdvanced ? 'Hide codes' : 'Advanced codes'}
              </button>
            </div>
            <div className="space-y-4">
              {catalog.map((group) => (
                <section key={group.group}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {groupLabel(group.group)}
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((p) => (
                      <li key={p.key}>
                        <label className="flex items-center gap-3 py-1 px-2 -mx-2 rounded cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={draft.has(p.key)}
                            onChange={() => toggle(p.key)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-sm text-slate-800">{p.label}</span>
                          {showAdvanced && <code className="text-[10px] text-slate-400 ml-auto">{p.key}</code>}
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim()}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AuditLogPanel() {
  const log = useQuery({
    queryKey: ['tenant-roles', 'audit-log'],
    queryFn: () => apiRequest<{ data: AuditRow[] }>('/v1/tenant-roles/audit-log?limit=50'),
  })

  return (
    <section className="mt-8 bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-900">Audit log</h2>
      <p className="text-xs text-slate-500 mt-1">
        Every role + permission change recorded for this tenant. Most recent first.
      </p>

      <div className="mt-4">
        {log.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {!log.isLoading && (log.data?.data?.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500 italic">No changes yet.</p>
        )}
        {(log.data?.data?.length ?? 0) > 0 && (
          <ul className="divide-y divide-slate-100">
            {log.data!.data.map((row) => {
              const ts = new Date(row.created_at)
              const verb =
                row.action === 'role_created'
                  ? 'created'
                  : row.action === 'role_deleted'
                  ? 'deleted'
                  : 'updated'
              return (
                <li key={row.id} className="py-2.5">
                  <div className="text-sm text-slate-800">
                    <strong>{row.actor}</strong> {verb}{' '}
                    <span className="font-mono text-slate-600">{row.role_slug}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ts.toLocaleString()}
                  </div>
                  {(row.diff.added.length > 0 || row.diff.removed.length > 0) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {row.diff.added.map((p) => (
                        <span key={'+' + p} className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                          + {p}
                        </span>
                      ))}
                      {row.diff.removed.map((p) => (
                        <span key={'-' + p} className="text-[10px] font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                          − {p}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

interface RolePreset {
  id: string
  name: string
  description: string
  jobScope: 'all' | 'own'
  permissions: string[]
}

const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'dispatcher',
    name: 'Dispatcher',
    description: 'Book jobs, manage customers, schedule work, and use AI. No money or settings edits.',
    jobScope: 'all',
    permissions: [
      'customers.view', 'customers.edit',
      'calls.view',
      'jobs.view', 'jobs.edit',
      'inventory.view',
      'catalog.view',
      'assets.view', 'assets.edit',
      'warranties.view',
      'templates.view',
      'staff.view',
      'settings.view',
      'ai.use',
      'mobile.access',
    ],
  },
  {
    id: 'field_tech',
    name: 'Field tech',
    description: 'Use the phone app, see assigned jobs, update job work, and view needed inventory.',
    jobScope: 'own',
    permissions: [
      'customers.view',
      'calls.view',
      'jobs.view', 'jobs.edit',
      'inventory.view',
      'catalog.view',
      'assets.view', 'assets.edit',
      'warranties.view',
      'ai.use',
      'mobile.access',
    ],
  },
  {
    id: 'office',
    name: 'Office / bookkeeper',
    description: 'Customers, invoices, revenue, reports, templates, and read-only jobs.',
    jobScope: 'all',
    permissions: [
      'customers.view', 'customers.edit',
      'calls.view',
      'jobs.view',
      'invoices.view', 'invoices.edit', 'revenue.view',
      'catalog.view',
      'warranties.view',
      'templates.view',
      'settings.view',
      'ai.use',
    ],
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Run daily operations and settings, but cannot edit roles or invite owners.',
    jobScope: 'all',
    permissions: [
      'customers.view', 'customers.edit',
      'calls.view',
      'jobs.view', 'jobs.edit',
      'invoices.view', 'invoices.edit', 'revenue.view',
      'inventory.view', 'inventory.edit',
      'catalog.view', 'catalog.edit',
      'assets.view', 'assets.edit',
      'warranties.view', 'warranties.edit',
      'templates.view', 'templates.edit',
      'staff.view',
      'settings.view', 'settings.edit',
      'ai.use',
      'mobile.access',
    ],
  },
  {
    id: 'viewer',
    name: 'Read-only viewer',
    description: 'Can look up records but cannot change anything.',
    jobScope: 'all',
    permissions: [
      'customers.view',
      'jobs.view',
      'invoices.view', 'revenue.view',
      'inventory.view',
      'catalog.view',
      'assets.view',
      'warranties.view',
      'templates.view',
      'staff.view',
      'settings.view',
    ],
  },
]

function groupLabel(group: string): string {
  const labels: Record<string, string> = {
    customers: 'Customers',
    calls: 'Calls',
    jobs: 'Jobs & schedule',
    invoices: 'Invoices & money',
    revenue: 'Revenue',
    inventory: 'Inventory',
    catalog: 'Products & services',
    assets: 'Company tools & assets',
    warranties: 'Warranties',
    templates: 'Templates & forms',
    staff: 'Staff & roles',
    settings: 'Company settings',
    ai: 'AI helper',
    mobile: 'Mobile app',
  }
  return labels[group] ?? group
}

// Kept for defensive rendering if an older owner row reaches the matrix.
const OWNER_LOCKED = new Set(['staff.edit', 'settings.edit', 'ai.use'])
