import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { Estimate } from '@/types/estimate'

/**
 * Chronological timeline for an estimate. Mirrors WorkOrderHistoryPanel's
 * approach — derives from existing timestamps + attachments rather than
 * a per-field audit log (that's a bigger lift, on the roadmap).
 *
 * Surfaced events:
 *   - Created
 *   - Sent to customer (sent_at)
 *   - Approved / Rejected (approved_at / rejected_at)
 *   - Expired (expires_at, when past + status not approved/rejected)
 *   - Superseded by re-quote (superseded_estimate_id back-pointer
 *     resolved server-side as superseded_estimate ref)
 *   - Converted to work order (converted_to_work_order_id)
 *   - Attachment added (photos + docs)
 */

interface AttachmentRow {
  id: string
  kind: 'image' | 'document'
  original_filename: string
  created_at: string | null
  uploaded_by_account_id: string | null
  uploaded_by_platform_customer_id: string | null
}

interface TimelineEntry {
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

export function EstimateHistoryPanel({ estimate }: { estimate: Estimate }) {
  const attachQ = useQuery({
    queryKey: ['estimate-attachments', estimate.id],
    queryFn: () =>
      apiRequest<{ data: AttachmentRow[] }>(`/v1/estimates/${estimate.id}/attachments`),
  })

  const entries: TimelineEntry[] = useMemo(() => {
    const out: TimelineEntry[] = []

    if (estimate.created_at) {
      out.push({
        at: estimate.created_at,
        kind: 'created',
        icon: '✨',
        title: 'Estimate created',
        meta: estimate.estimate_number,
        detail: estimate.created_by?.full_name
          ? `By ${estimate.created_by.full_name}`
          : undefined,
      })
    }

    if (estimate.sent_at) {
      out.push({
        at: estimate.sent_at,
        kind: 'sent',
        icon: '📧',
        title: 'Sent to customer',
        detail: estimate.customer?.display_name
          ? `Visible to ${estimate.customer.display_name} on the portal`
          : undefined,
        color: 'border-l-blue-400',
      })
    }

    if (estimate.approved_at) {
      out.push({
        at: estimate.approved_at,
        kind: 'approved',
        icon: '✅',
        title: 'Approved',
        color: 'border-l-emerald-500',
      })
    }

    if (estimate.rejected_at) {
      out.push({
        at: estimate.rejected_at,
        kind: 'rejected',
        icon: '❌',
        title: 'Rejected',
        color: 'border-l-rose-400',
      })
    }

    // Expired = expires_at is in the past AND status didn't reach an
    // active end state. The server's 'expired' status comes from the
    // ExpireEstimatesCommand sweep; we surface the timestamp here even
    // if the status hasn't been flipped yet (e.g. between sweeps).
    if (
      estimate.expires_at &&
      new Date(estimate.expires_at).getTime() < Date.now() &&
      !estimate.approved_at &&
      !estimate.rejected_at
    ) {
      out.push({
        at: estimate.expires_at,
        kind: 'expired',
        icon: '⌛',
        title: 'Expired',
        detail: 'No customer response before expiry date',
        color: 'border-l-amber-400',
      })
    }

    // Re-quote chain. superseded_estimate_id points at the OLDER one
    // this estimate replaces, so when it's set we know "this is a
    // re-quote of ESTIMATE_X". The corresponding "old estimate was
    // superseded" event lives on the OLDER row's own history panel.
    if (estimate.superseded_estimate_id && estimate.superseded_estimate) {
      out.push({
        at: estimate.created_at ?? '',
        kind: 'supersedes',
        icon: '🔁',
        title: `Re-quote of ${estimate.superseded_estimate.estimate_number}`,
        detail: `Earlier estimate replaced by this one`,
        color: 'border-l-amber-400',
      })
    }

    if (estimate.converted_to_work_order_id && estimate.converted_to_work_order) {
      // No explicit converted_at timestamp on the resource — use
      // updated_at as a stand-in; close enough for the visual order.
      out.push({
        at: estimate.updated_at ?? estimate.created_at ?? '',
        kind: 'converted',
        icon: '🛠️',
        title: `Converted to work order ${estimate.converted_to_work_order.display_number}`,
        detail: estimate.converted_to_work_order.title ?? undefined,
        color: 'border-l-emerald-400',
      })
    }

    if (estimate.deleted_at) {
      out.push({
        at: estimate.deleted_at,
        kind: 'deleted',
        icon: '🗑️',
        title: 'Deleted (soft)',
        color: 'border-l-slate-400',
      })
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

    // Newest first.
    return out
      .filter((e) => !!e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [estimate, attachQ.data])

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">
        Timeline
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Derived from lifecycle timestamps + attachments. Per-field edit
        audit log is on the roadmap.
      </p>

      {entries.length === 0 && (
        <p className="text-sm text-slate-500 italic">No activity yet.</p>
      )}

      <ol className="space-y-3">
        {entries.map((e, i) => (
          <li
            key={`${e.kind}-${i}`}
            className={`pl-4 border-l-4 ${e.color ?? 'border-l-slate-200'}`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-base leading-none">{e.icon}</span>
              <span className="text-sm font-medium text-slate-900">{e.title}</span>
              {e.meta && <span className="text-[11px] text-slate-500">· {e.meta}</span>}
            </div>
            {e.detail && (
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{e.detail}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">{fmt(e.at)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
