import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'

/**
 * Tool Shed → Delete permissions.
 *
 * Split out of Security & 2FA because it answers a different question: not
 * "how do people prove who they are" but "who is allowed to destroy company
 * records". Editing is owner-only server-side; everyone else with
 * settings.view sees the rules read-only, which is useful on its own — staff
 * asking "why can't I delete this" get an answer without filing a ticket.
 */

interface Staff {
  account_id: string
  name: string
  email: string
  role: string
}

interface Payload {
  require_password: boolean
  require_reason: boolean
  authorized_account_ids: string[]
  password_exempt_account_ids: string[]
  defaults_to_owners_admins: boolean
  can_manage: boolean
  staff: Staff[]
}

type Patch = Partial<{
  require_password: boolean
  require_reason: boolean
  authorized_account_ids: string[]
  password_exempt_account_ids: string[]
}>

/**
 * `embedded` renders this inside Company Preferences, where the section nav
 * already supplies the page frame and heading. Reused rather than ported so
 * there's one implementation of the owner check, the staff pickers and the
 * always-blocked list — a second copy would drift from the endpoint.
 */
export function DeletePermissionsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<{ data: Payload }>('/v1/tenant-settings/delete-permissions')
      .then((r) => setData(r.data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: Patch) => {
    if (!data) return
    const prev = data
    setData({ ...data, ...patch })
    setError(null)
    try {
      const r = await apiRequest<{ data: Payload }>('/v1/tenant-settings/delete-permissions', {
        method: 'PATCH',
        body: patch,
      })
      setData(r.data)
      setSavedAt(new Date())
    } catch (e) {
      setData(prev) // server refused — don't leave the UI claiming it saved
      setError((e as Error).message)
    }
  }

  const toggleIn = (list: string[], id: string, on: boolean) =>
    on ? [...new Set([...list, id])] : list.filter((x) => x !== id)

  if (loading) return <p className="px-6 py-8 text-sm text-slate-500 italic">Loading…</p>

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <p className="text-sm text-red-700">{error ?? 'Failed to load.'}</p>
      </div>
    )
  }

  const editable = data.can_manage

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-2xl mx-auto px-6 py-8 space-y-6'}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Delete permissions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Who can delete company records, and what they have to do to confirm it.
          </p>
        </div>
      )}

      {!editable && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Only the company owner can change these. You're seeing the current rules read-only.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* 1. WHO may delete at all. */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Who can delete</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          {data.defaults_to_owners_admins
            ? 'Nobody is named yet, so owners and admins can delete. Name someone to switch to an explicit list.'
            : 'Only the people checked below can delete records. Everyone else gets a "not authorized" message.'}
        </p>
        <div className="space-y-2">
          {data.staff.map((p) => (
            <label key={p.account_id} className="flex items-start gap-3">
              <input
                type="checkbox"
                disabled={!editable}
                checked={data.authorized_account_ids.includes(p.account_id)}
                onChange={(e) =>
                  save({
                    authorized_account_ids: toggleIn(
                      data.authorized_account_ids,
                      p.account_id,
                      e.target.checked
                    ),
                  })
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 disabled:opacity-50"
              />
              <span className="text-sm">
                <span className="font-medium text-slate-900">{p.name}</span>{' '}
                <span className="text-slate-400">· {p.role}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* 2. Confirmation steps + per-person password exemption. */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Confirmation steps</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Extra hurdles once someone is authorized to delete.
        </p>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            disabled={!editable}
            checked={data.require_password}
            onChange={(e) => save({ require_password: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 disabled:opacity-50"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">Require password to delete</span>
            <span className="block text-slate-500">
              Staff re-enter their password to confirm any deletion.
            </span>
          </span>
        </label>

        {data.require_password && (
          <div className="mt-4 ml-7 border-l-2 border-slate-100 pl-4">
            <p className="text-sm font-medium text-slate-900">Skip the password for…</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              These people delete without retyping their password. Everyone else still has to.
            </p>
            <div className="space-y-2">
              {data.staff.map((p) => (
                <label key={p.account_id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={data.password_exempt_account_ids.includes(p.account_id)}
                    onChange={(e) =>
                      save({
                        password_exempt_account_ids: toggleIn(
                          data.password_exempt_account_ids,
                          p.account_id,
                          e.target.checked
                        ),
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 disabled:opacity-50"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-slate-900">{p.name}</span>{' '}
                    <span className="text-slate-400">· {p.role}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 mt-5">
          <input
            type="checkbox"
            disabled={!editable}
            checked={data.require_reason}
            onChange={(e) => save({ require_reason: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 disabled:opacity-50"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">Require a reason to delete</span>
            <span className="block text-slate-500">
              Staff type a short reason, saved to the audit log.
            </span>
          </span>
        </label>

        <p className="mt-5 text-xs text-slate-400">
          Quick-dismiss items like sticky notes are never gated.
        </p>
      </section>

      {/* 3. The rules no setting can turn off. Stated plainly so nobody hunts
          for a toggle that doesn't exist. */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-bold text-slate-900">Always blocked</h2>
        <p className="text-sm text-slate-600 mt-1">
          Records that anchor money can't be deleted by anyone, including you —
          deleting them would leave payments pointing at things that no longer exist.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li>· A customer with invoices, payments, or open credit — deactivate them instead.</li>
          <li>· An invoice with payments applied — cancel it, or void the payments first.</li>
          <li>· A job that has been invoiced — delete the invoice first.</li>
        </ul>
      </section>

      {savedAt && (
        <p className="text-xs text-slate-400">Saved {savedAt.toLocaleTimeString()}</p>
      )}
    </div>
  )
}
