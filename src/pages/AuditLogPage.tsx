import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import {
  ago,
  clientChip,
  describeAction,
  methodChip,
  statusTone,
  type ActivityRow,
} from '@/lib/activityLabels'

/**
 * Tool Shed → Account → Audit Log.
 *
 * Tenant-scoped viewer over the `activity_logs` table the LogActivity
 * middleware populates (writes for all clients, plus mobile GET views/
 * searches). Filters: path, method, client, "since" window. Paginated.
 *
 * Source: GET /v1/tenant-settings/audit-log
 */

interface AuditResponse {
  data: ActivityRow[]
  meta: {
    current_page: number
    last_page: number
    total: number
    per_page: number
  }
}

const METHODS = ['', 'POST', 'PATCH', 'PUT', 'DELETE'] as const
type Method = (typeof METHODS)[number]

const SINCE_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'All time', minutes: 0 },
  { label: 'Last 24 hours', minutes: 60 * 24 },
  { label: 'Last 7 days', minutes: 60 * 24 * 7 },
  { label: 'Last 30 days', minutes: 60 * 24 * 30 },
]

export function AuditLogPage() {
  const [tab, setTab] = useState<'activity' | 'deletions'>('activity')
  const [method, setMethod] = useState<Method>('')
  const [client, setClient] = useState<'' | 'mobile' | 'web'>('')
  const [sinceMinutes, setSinceMinutes] = useState<number>(60 * 24 * 7)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const sinceIso = useMemo(() => {
    if (!sinceMinutes) return ''
    return new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString()
  }, [sinceMinutes])

  const query = useQuery({
    queryKey: ['audit-log', method, client, sinceIso, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        per_page: '50',
        page: String(page),
      })
      if (method) params.set('method', method)
      if (client) params.set('client', client)
      if (sinceIso) params.set('since', sinceIso)
      if (search.trim()) params.set('q', search.trim())
      return apiRequest<AuditResponse>(`/v1/tenant-settings/audit-log?${params.toString()}`)
    },
  })

  const data = query.data
  const rows = data?.data ?? []

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Staff activity — every write, plus what techs open and search in the
          phone app (filter Client → Mobile). Useful for tracing what a staff
          member did and when. Read-only — history can't be edited.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('activity')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${
            tab === 'activity'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Activity
        </button>
        <button
          type="button"
          onClick={() => setTab('deletions')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${
            tab === 'deletions'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Deletions
        </button>
      </div>

      {tab === 'deletions' && <DeletionsView />}

      {tab === 'activity' && (
        <>
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Search path
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="e.g. work-orders, /v1/customers"
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Method
          </label>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as Method)
              setPage(1)
            }}
            className="text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
          >
            <option value="">Any</option>
            {METHODS.filter((m) => m).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Client
          </label>
          <select
            value={client}
            onChange={(e) => {
              setClient(e.target.value as '' | 'mobile' | 'web')
              setPage(1)
            }}
            className="text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
          >
            <option value="">All</option>
            <option value="mobile">Mobile app</option>
            <option value="web">Web</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Since
          </label>
          <select
            value={sinceMinutes}
            onChange={(e) => {
              setSinceMinutes(parseInt(e.target.value, 10))
              setPage(1)
            }}
            className="text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
          >
            {SINCE_OPTIONS.map((o) => (
              <option key={o.minutes} value={o.minutes}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="text-sm px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          {query.isFetching ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {query.isLoading && (
        <p className="text-sm text-slate-500 italic">Loading…</p>
      )}

      {query.isError && (
        <p className="text-sm text-red-700">
          {(query.error as Error).message ?? 'Failed to load.'}
        </p>
      )}

      {!query.isLoading && rows.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          No activity matches those filters.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">When</th>
                  <th className="px-3 py-2 text-left font-semibold">Who</th>
                  <th className="px-3 py-2 text-left font-semibold">Client</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                  <th className="px-3 py-2 text-right font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap" title={r.created_at}>
                      {ago(r.created_at)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 truncate max-w-[180px]">
                      {r.actor_email ?? <span className="text-slate-400 italic">system</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize',
                          clientChip(r.client),
                        ].join(' ')}
                      >
                        {r.client === 'mobile' ? '📱 Mobile' : r.client ?? 'web'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">
                        {describeAction(r.method, r.path, r.request_keys)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={[
                            'inline-block text-[9px] font-bold px-1 py-0.5 rounded font-mono',
                            methodChip(r.method),
                          ].join(' ')}
                        >
                          {r.method}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px] truncate max-w-[260px]">{r.path}</span>
                      </div>
                    </td>
                    <td className={['px-3 py-2 text-right font-semibold font-mono', statusTone(r.response_status)].join(' ')}>
                      {r.response_status}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500 text-[12px]">
                      {r.duration_ms != null ? `${r.duration_ms}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
              <span>
                Page {data.meta.current_page} of {data.meta.last_page} ·{' '}
                {data.meta.total.toLocaleString()} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || query.isFetching}
                  className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.meta.last_page || query.isFetching}
                  className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  )
}

// ---------- Deletions view ----------

interface DeletionRow {
  id: string
  actor_label: string | null
  subject_type: string
  subject_id: string
  subject_label: string | null
  reason: string | null
  was_force_delete: boolean
  route: string | null
  ip_address: string | null
  created_at: string | null
}

function DeletionsView() {
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['deletion-audit-logs', search],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: '100' })
      if (search.trim()) params.set('q', search.trim())
      return apiRequest<{ data: DeletionRow[] }>(
        `/v1/deletion-audit-logs?${params.toString()}`,
      )
    },
  })
  const rows = query.data?.data ?? []

  return (
    <>
      <p className="text-sm text-slate-500 mb-3">
        Every record deletion — who deleted what, when, and why. Each delete
        requires the user to re-enter their password and give a reason.
      </p>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject, reason, or person…"
          className="w-full sm:max-w-sm text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {query.isLoading && <p className="text-sm text-slate-500 italic">Loading…</p>}
      {!query.isLoading && rows.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          No deletions recorded.
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-slate-200 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 break-words">
                    {r.subject_label || r.subject_id}
                    <span className="ml-2 text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {r.subject_type}
                    </span>
                    {r.was_force_delete && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        permanent
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    by <span className="font-medium">{r.actor_label ?? 'unknown'}</span>
                    {r.ip_address && <span className="text-slate-400"> · {r.ip_address}</span>}
                  </div>
                  {r.reason && (
                    <div className="text-sm text-slate-700 mt-1.5 italic">
                      “{r.reason}”
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 shrink-0 text-right">
                  {r.created_at ? ago(r.created_at) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
