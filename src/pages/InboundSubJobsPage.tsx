import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyActionCards } from '@/components/easy/EasyActionCards'

/**
 * InboundSubJobsPage — receiving-side inbox for cross-tenant subbing.
 *
 * When another CrewBarn tenant subs a WO to a subcontractor whose
 * linked_tenant_id is us, the system spawns a mirror WO inside our
 * data with mirror_status='pending_accept'. This page is where
 * dispatch triages those:
 *
 *   - Accept → enters our normal dispatch flow (job appears on board,
 *     can be scheduled / assigned to techs).
 *   - Decline → reason captured + reflected back to the originator
 *     who can reassign.
 *
 * Recently accepted/declined rows (last 30 days) stay visible at the
 * bottom so there's no separate history view.
 */

interface InboundRow {
  id: string
  work_order_number: number | null
  title: string
  description: string | null
  priority: 'low' | 'normal' | 'urgent' | 'emergency'
  nte_cents: number | null
  mirror_status: 'pending_accept' | 'accepted' | 'declined'
  mirror_of_wo_id: string | null
  mirror_of_tenant_id: string | null
  mirror_of_tenant_name: string | null
  mirror_declined_reason: string | null
  mirror_accepted_at: string | null
  mirror_declined_at: string | null
  service_location: {
    id: string
    nickname: string | null
    street_address: string | null
    apt_unit: string | null
    city: string | null
    state: string | null
    postal_code: string | null
  } | null
  job_type: { id: string; name: string; color: string } | null
  status: { id: string; name: string; color: string; category: string } | null
  created_at: string | null
  updated_at: string | null
}

interface InboundResponse {
  data: {
    pending_count: number
    rows: InboundRow[]
  }
}

const inboxKey = ['inbound-sub-jobs'] as const

export function InboundSubJobsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [view, setView] = useState<'all' | 'pending' | 'recent'>('all')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: inboxKey,
    queryFn: () => apiRequest<InboundResponse>('/v1/inbound-sub-jobs'),
    refetchInterval: 60_000,
  })

  const pending = data?.data.rows.filter((r) => r.mirror_status === 'pending_accept') ?? []
  const recent = data?.data.rows.filter((r) => r.mirror_status !== 'pending_accept') ?? []

  return (
    <div className={easy ? 'w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6' : 'max-w-5xl mx-auto px-6 py-6'}>
      <div className="mb-6">
        <Link to="/jobs" className="inline-flex items-center text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline mb-3">
          ← Back to Jobs
        </Link>
        {easy ? <EasyPageHeading title="Incoming partner jobs" description="Review the job details, then accept it into your dispatch flow or decline with a reason." /> : <h1 className="text-2xl font-semibold text-slate-900">Inbound sub jobs</h1>}
        <p className="text-sm text-slate-500 mt-1">
          Work routed to you by partner tenants. Accept to move into your dispatch flow, or
          decline with a reason so they can reassign.
        </p>
      </div>

      {easy && <EasyActionCards label="Choose a job queue" actions={[
        { key: 'all', title: 'All partner jobs', description: 'Waiting requests and recent decisions.', active: view === 'all', onClick: () => setView('all') },
        { key: 'pending', title: 'Needs a decision', description: 'Review before accepting or declining.', count: data && !error ? pending.length : undefined, active: view === 'pending', onClick: () => setView('pending') },
        { key: 'recent', title: 'Recent decisions', description: 'Review previously handled requests.', count: data && !error ? recent.length : undefined, active: view === 'recent', onClick: () => setView('recent') },
      ]} />}
      {error && (
        <div role="alert" className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 mb-4">
          Failed to load: {String((error as Error).message)}
          <button type="button" onClick={() => void refetch()} className="ml-3 underline">Retry</button>
        </div>
      )}

      {isLoading && !data && (
        <div className="text-sm text-slate-500">Loading…</div>
      )}

      {data && !error && (
        <div className="space-y-8">
          <div hidden={easy && view === 'recent'}><PendingSection rows={pending} /></div>
          <div hidden={easy && view === 'pending'}><RecentSection rows={recent} /></div>
        </div>
      )}
    </div>
  )
}

function PendingSection({ rows }: { rows: InboundRow[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        Pending acceptance
        {rows.length > 0 && (
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({rows.length} waiting)
          </span>
        )}
      </h2>
      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
          Nothing waiting. New cross-tenant sub jobs will show up here.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <PendingCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  )
}

function PendingCard({ row }: { row: InboundRow }) {
  const qc = useQueryClient()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const acceptMut = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/inbound-sub-jobs/${row.id}/accept`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKey })
      qc.invalidateQueries({ queryKey: ['topbar-inbound-sub-jobs-pending'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const declineMut = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/inbound-sub-jobs/${row.id}/decline`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() }),
      }),
    onSuccess: () => {
      setDeclining(false)
      setReason('')
      qc.invalidateQueries({ queryKey: inboxKey })
      qc.invalidateQueries({ queryKey: ['topbar-inbound-sub-jobs-pending'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
              From {row.mirror_of_tenant_name ?? 'partner'}
            </span>
            {row.priority !== 'normal' && (
              <span
                className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${
                  row.priority === 'emergency'
                    ? 'bg-red-100 text-red-800'
                    : row.priority === 'urgent'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {row.priority}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-slate-900">{row.title}</div>
          {row.service_location && (
            <div className="text-xs text-slate-500 mt-0.5">
              {formatAddress(row.service_location)}
            </div>
          )}
        </div>
        {row.nte_cents != null && (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">NTE cap</div>
            <div className="text-sm font-mono font-semibold text-slate-900">
              ${money(row.nte_cents)}
            </div>
          </div>
        )}
      </div>

      {row.description && (
        <div className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 border border-slate-200">
          {row.description}
        </div>
      )}

      {error && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {declining ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Tell them why you can't take this (will be sent back to them)…"
            className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeclining(false)
                setReason('')
              }}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5"
              disabled={declineMut.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => declineMut.mutate()}
              disabled={!reason.trim() || declineMut.isPending}
              className="text-xs font-semibold bg-red-600 text-white rounded px-3 py-1.5 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {declineMut.isPending ? 'Sending…' : 'Confirm decline'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link
            to={`/jobs/${row.id}`}
            className="text-xs text-slate-600 hover:text-amber-700 hover:underline"
          >
            View details →
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeclining(true)}
              className="text-xs font-semibold text-red-700 hover:text-red-900 border border-red-200 hover:border-red-300 rounded px-3 py-1.5"
              disabled={acceptMut.isPending}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
              className="text-xs font-semibold bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
            >
              {acceptMut.isPending ? 'Accepting…' : 'Accept'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RecentSection({ rows }: { rows: InboundRow[] }) {
  if (rows.length === 0) return null

  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        Recently actioned
        <span className="ml-2 text-xs font-normal text-slate-500">(last 30 days)</span>
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">From</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Job</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">When</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-800">{row.mirror_of_tenant_name ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="text-slate-900 font-medium truncate max-w-xs">{row.title}</div>
                  {row.mirror_declined_reason && (
                    <div className="text-xs text-red-700 truncate max-w-xs italic">
                      {row.mirror_declined_reason}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${
                      row.mirror_status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {row.mirror_status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {(row.mirror_accepted_at || row.mirror_declined_at)
                    ? new Date((row.mirror_accepted_at ?? row.mirror_declined_at)!).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to={`/jobs/${row.id}`}
                    className="text-xs text-amber-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatAddress(loc: NonNullable<InboundRow['service_location']>): string {
  const parts = [
    [loc.street_address, loc.apt_unit].filter(Boolean).join(' '),
    loc.city,
    loc.state,
    loc.postal_code,
  ].filter(Boolean)
  return parts.join(', ')
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
