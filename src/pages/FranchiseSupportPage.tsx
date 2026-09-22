import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError } from '@/lib/api'

/**
 * Settings → Franchise access (FR-5, FRANCHISE side). The franchise owner
 * reviews support-access requests from their franchisor and approves (time-
 * boxed), declines, or revokes an active grant. Reachable from the emailed
 * approval link (/franchise-support) and Tool Shed → General.
 *
 * While a grant is active the franchisor can operate this account; every action
 * is recorded in this account's own audit log (Tool Shed → Audit Log).
 */
interface Grant {
  id: string
  status: 'requested' | 'active' | 'expired' | 'revoked' | 'declined'
  franchisor_name?: string | null
  requested_at: string | null
  approved_at: string | null
  expires_at: string | null
  is_active: boolean
}

const DURATIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
]

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '—')

export function FranchiseSupportPage() {
  const queryClient = useQueryClient()
  const [hours, setHours] = useState(72)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['franchise-support'],
    queryFn: () => apiRequest<{ data: Grant[] }>('/v1/franchise-support'),
    refetchInterval: 30_000,
  })

  const respond = useMutation({
    mutationFn: (vars: { grant_id: string; decision: 'approve' | 'decline'; duration_hours?: number }) =>
      apiRequest('/v1/franchise-support/respond', { method: 'POST', body: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['franchise-support'] }),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/franchise-support/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['franchise-support'] }),
  })

  const grants = data?.data ?? []
  const requests = grants.filter((g) => g.status === 'requested')
  const active = grants.filter((g) => g.status === 'active' && g.is_active)
  const busy = respond.isPending || revoke.isPending
  const err =
    respond.error instanceof ApiError ? respond.error.message :
    revoke.error instanceof ApiError ? revoke.error.message : null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy-900">Franchise access</h1>
        <p className="text-sm text-slate-600 mt-1">
          Control whether your franchisor can step into your account to help. You decide
          for how long, every action is logged in your audit log, and you can end access any time.
        </p>
      </div>

      {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{err}</div>}

      {/* Pending requests */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-navy-900">Requests</h2>
        </div>
        {isLoading ? (
          <div className="p-6 animate-pulse"><div className="h-12 bg-slate-100 rounded" /></div>
        ) : isError ? (
          <div className="p-6 text-sm text-red-700">Failed to load.</div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No pending requests.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((g) => (
              <div key={g.id} className="px-6 py-4">
                <div className="text-sm text-navy-900">
                  <strong>{g.franchisor_name ?? 'Your franchisor'}</strong> is requesting support access.
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Requested {fmt(g.requested_at)}</div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <label className="text-xs text-slate-600">For</label>
                  <select
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond.mutate({ grant_id: g.id, decision: 'approve', duration_hours: hours })}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond.mutate({ grant_id: g.id, decision: 'decline' })}
                    className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium text-slate-700"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active grants */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-navy-900">Active access</h2>
        </div>
        {active.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No one currently has access to your account.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {active.map((g) => (
              <div key={g.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="text-sm">
                  <div className="text-navy-900">
                    <strong>{g.franchisor_name ?? 'Your franchisor'}</strong> has support access
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Until {fmt(g.expires_at)}</div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke.mutate(g.id)}
                  className="px-3 py-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm font-medium"
                >
                  End access now
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
