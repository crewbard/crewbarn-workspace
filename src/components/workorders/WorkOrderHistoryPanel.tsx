import { useMemo, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type {
  WorkOrder,
  WorkOrderNteExtension,
  WorkOrderSignature,
  WorkOrderVisit,
} from '@/types/workOrder'

/**
 * Chronological timeline of everything that happened on a work order.
 * Derived from existing tables — no audit log infrastructure yet, so
 * this is a 'best effort' view that shows what we already capture:
 *
 *   - WO created / first status change / current status / completed
 *   - Visit check-ins / check-outs (with GPS distance + outcome)
 *   - Signatures captured
 *   - NTE extension requests + decisions
 *   - Attachments added
 *   - Portal request acceptance / decline
 *
 * Field-level edits aren't tracked yet (would need an audit log table).
 */

interface AttachmentRow {
  id: string
  kind: string
  original_filename: string
  created_at: string | null
  uploaded_by_account_id: string | null
  uploaded_by_platform_customer_id: string | null
}

type TimelineEntry = {
  at: string
  kind: string
  icon: string
  title: string
  detail?: string
  meta?: string
  color?: string
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

export function WorkOrderHistoryPanel({ wo }: { wo: WorkOrder }) {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const visitsQ = useQuery({
    queryKey: ['wo-visits', wo.id],
    queryFn: () => apiRequest<{ data: WorkOrderVisit[] }>(`/v1/work-orders/${wo.id}/visits`),
  })
  const sigsQ = useQuery({
    queryKey: ['wo-signatures', wo.id],
    queryFn: () => apiRequest<{ data: WorkOrderSignature[] }>(`/v1/work-orders/${wo.id}/signatures`),
  })
  const extQ = useQuery({
    queryKey: ['wo-nte-extensions', wo.id],
    queryFn: () => apiRequest<{ data: WorkOrderNteExtension[] }>(`/v1/work-orders/${wo.id}/nte-extensions`),
  })
  const attachQ = useQuery({
    queryKey: ['wo-attachments', wo.id],
    queryFn: () => apiRequest<{ data: AttachmentRow[] }>(`/v1/work-orders/${wo.id}/attachments`),
  })

  const entries: TimelineEntry[] = useMemo(() => {
    const out: TimelineEntry[] = []

    if (wo.created_at) {
      out.push({
        at: wo.created_at,
        kind: 'created',
        icon: '✨',
        title: `Job created`,
        detail: wo.request_status === 'pending'
          ? 'Submitted via customer portal — awaiting review'
          : wo.request_status === 'accepted'
            ? 'Submitted via customer portal — vendor accepted'
            : undefined,
        meta: `WO #${wo.work_order_number}`,
      })
    }
    if (wo.first_status_change_at) {
      out.push({
        at: wo.first_status_change_at,
        kind: 'status-first',
        icon: '🚦',
        title: 'First status change',
      })
    }
    if (wo.on_site_at) {
      out.push({
        at: wo.on_site_at,
        kind: 'on-site',
        icon: '📍',
        title: 'Tech arrived on site',
        color: 'border-l-blue-400',
      })
    }
    if (wo.completed_at) {
      out.push({
        at: wo.completed_at,
        kind: 'completed',
        icon: '✅',
        title: 'Job completed',
        color: 'border-l-emerald-500',
      })
    }

    for (const v of visitsQ.data?.data ?? []) {
      if (v.check_in_at) {
        out.push({
          at: v.check_in_at,
          kind: 'check-in',
          icon: '🔵',
          title: `Visit #${v.visit_number} check-in`,
          detail: v.geofence_overridden
            ? `GEOFENCE OVERRIDE${v.geofence_override_reason ? `: ${v.geofence_override_reason}` : ''}`
            : v.check_in_distance_m !== null
              ? `${v.check_in_distance_m}m from property`
              : undefined,
          color: 'border-l-blue-300',
        })
      }
      if (v.check_out_at) {
        const outcome = v.outcome === 'completed'
          ? 'Completed'
          : v.outcome === 'return_needed'
            ? 'Needs to return'
            : ''
        out.push({
          at: v.check_out_at,
          kind: 'check-out',
          icon: v.outcome === 'completed' ? '✅' : '🔁',
          title: `Visit #${v.visit_number} check-out · ${outcome}`,
          detail: v.return_reason ?? v.notes ?? undefined,
          color: v.outcome === 'completed' ? 'border-l-emerald-400' : 'border-l-amber-400',
        })
      }
    }

    for (const s of sigsQ.data?.data ?? []) {
      out.push({
        at: s.captured_at,
        kind: 'signature',
        icon: '✍️',
        title: `Signature captured`,
        detail: s.signer_role
          ? `${s.signer_name} (${s.signer_role})`
          : s.signer_name,
      })
    }

    for (const e of extQ.data?.data ?? []) {
      out.push({
        at: e.requested_at,
        kind: 'nte-requested',
        icon: '💰',
        title: `NTE extension requested: +$${(e.requested_increase_cents / 100).toFixed(2)}`,
        detail: e.reason,
        color: 'border-l-amber-400',
      })
      if (e.reviewed_at && e.status !== 'pending') {
        out.push({
          at: e.reviewed_at,
          kind: 'nte-reviewed',
          icon: e.status === 'approved' ? '✅' : '❌',
          title: `NTE extension ${e.status}`,
          detail: e.review_notes ?? undefined,
          color: e.status === 'approved' ? 'border-l-emerald-400' : 'border-l-rose-400',
        })
      }
    }

    for (const a of attachQ.data?.data ?? []) {
      if (!a.created_at) continue
      out.push({
        at: a.created_at,
        kind: 'attachment',
        icon: a.kind === 'image' ? '🖼️' : '📄',
        title: `${a.kind === 'image' ? 'Photo' : 'Document'} added`,
        detail: a.original_filename,
        meta: a.uploaded_by_platform_customer_id ? 'from customer portal' : 'from staff',
      })
    }

    // Newest first
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [wo, visitsQ.data, sigsQ.data, extQ.data, attachQ.data])

  const sources = [visitsQ, sigsQ, extQ, attachQ]
  const loading = sources.some(query => query.isLoading)
  const failed = sources.filter(query => query.isError)
  const filters = [
    { key: 'all', label: 'All activity', kinds: [] },
    { key: 'work', label: 'Job & visits', kinds: ['created', 'status-first', 'on-site', 'completed', 'check-in', 'check-out'] },
    { key: 'signature', label: 'Signatures', kinds: ['signature'] },
    { key: 'billing', label: 'Billing approvals', kinds: ['nte-requested', 'nte-reviewed'] },
    { key: 'attachment', label: 'Files', kinds: ['attachment'] },
  ]
  const selected = filters.find(item => item.key === filter) ?? filters[0]
  const visibleEntries = easy ? entries.filter(entry =>
    (filter === 'all' || selected.kinds.includes(entry.kind)) &&
    [entry.title, entry.detail, entry.meta].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ) : entries

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">
        Timeline
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Best-effort derived from what we capture today (visits, signatures,
        NTE extensions, attachments, lifecycle timestamps). Full per-field
        edit audit log is on the roadmap.
      </p>

      {easy && <div className="mb-4 space-y-3">
        <div role="group" aria-label="Filter job history" className="flex flex-wrap gap-2">
          {filters.map(item => <button type="button" key={item.key} aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-3 py-2 text-sm ${filter === item.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{item.label}</button>)}
        </div>
        <input type="search" aria-label="Search loaded job history" placeholder="Search loaded activity…" value={search}
          onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <p className="text-xs text-slate-500">Showing {visibleEntries.length} of {entries.length} loaded events.</p>
      </div>}
      {loading && <p role="status" className="mb-3 text-sm text-slate-500">Loading job history…</p>}
      {failed.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Some history could not be loaded. Events below may be incomplete.
        <button type="button" disabled={failed.some(query => query.isFetching)} onClick={() => { for (const query of failed) void query.refetch() }}
          className="ml-2 font-semibold underline disabled:opacity-50">Retry</button>
      </div>}
      {!loading && !failed.length && entries.length === 0 && (
        <p className="text-sm text-slate-500 italic">No activity yet.</p>
      )}

      <ol className="space-y-3">
        {easy && entries.length > 0 && visibleEntries.length === 0 && <li className="text-sm text-slate-500">No loaded activity matches these filters.</li>}
        {visibleEntries.map((e, i) => (
          <li
            key={`${e.kind}-${i}`}
            className={`pl-4 border-l-4 ${e.color ?? 'border-l-slate-200'}`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-base leading-none">{e.icon}</span>
              <span className="text-sm font-medium text-slate-900">{e.title}</span>
              {e.meta && <span className="text-[11px] text-slate-500">· {e.meta}</span>}
            </div>
            {e.detail && (
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap break-words">{e.detail}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">{fmt(e.at)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
