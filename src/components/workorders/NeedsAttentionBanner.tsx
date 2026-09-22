import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { listConversations } from '@/lib/comms'
import type { WorkOrder } from '@/types/workOrder'

/**
 * Needs attention — a highlighted roll-up of things the office should notice
 * about THIS job, surfacing gates that already exist elsewhere:
 *
 *   - Billing routes to a dealer (invoice goes to the billing customer, not the
 *     service customer).
 *   - Completed but not invoiced yet ("unbilled").
 *   - Subcontracted out.
 *   - Unread customer messages on the job.
 *   - Notes filed on the job.
 *
 * Informational only — the blocking gates (dormant note, COD collection) keep
 * their own banners. Renders nothing when the job is clean. Amber surfaces
 * follow the tenant brand accent.
 */

interface Flag {
  key: string
  chip: string
  text: ReactNode
  summary: string
  onView?: () => void
}

function isComplete(wo: WorkOrder): boolean {
  return wo.status?.category === 'complete'
}

export function NeedsAttentionBanner({
  workOrder,
  onOpenNotes,
  onOpenMessages,
}: {
  workOrder: WorkOrder
  onOpenNotes?: () => void
  onOpenMessages?: () => void
}) {
  const id = workOrder.id
  const [collapsed, setCollapsed] = useState(false)

  // Reuse the same query keys the tabs use so nothing double-fetches.
  const notesQ = useQuery({
    queryKey: ['work-order', id, 'notes'],
    queryFn: () => apiRequest<{ data: unknown[] }>(`/v1/work-orders/${id}/notes`),
  })
  const invoicesQ = useQuery({
    queryKey: ['work-order-invoices', id],
    queryFn: () => apiRequest<{ data: Array<{ id: string; status: string }> }>(`/v1/invoices?work_order_id=${id}`),
  })
  const threadsQ = useQuery({
    queryKey: ['comms', 'wo-threads', id],
    queryFn: () => listConversations({ workOrderId: id }),
    refetchInterval: 15000,
  })

  const noteCount = notesQ.data?.data.length ?? 0
  const hasLiveInvoice = (invoicesQ.data?.data ?? []).some((inv) => inv.status !== 'cancelled')
  const unreadMessages = (threadsQ.data ?? []).reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  const flags = useMemo<Flag[]>(() => {
    const out: Flag[] = []
    const serviceId = workOrder.service_customer?.id
    const billing = workOrder.billing_customer

    if (billing && billing.id !== serviceId) {
      out.push({
        key: 'billing',
        chip: 'Billing',
        summary: 'Billed to a dealer',
        text: (
          <>
            Invoice routes to <span className="font-semibold text-navy-900">{billing.display_name}</span>, not the service customer.
          </>
        ),
      })
    }

    if (isComplete(workOrder) && !hasLiveInvoice) {
      out.push({
        key: 'unbilled',
        chip: 'Unbilled',
        summary: 'Not invoiced',
        text: 'Completed but not invoiced yet.',
      })
    }

    if (workOrder.is_subbed) {
      out.push({
        key: 'subbed',
        chip: 'Sub',
        summary: 'Subbed out',
        text: 'Subcontracted — handled by a sub.',
      })
    }

    if (unreadMessages > 0) {
      out.push({
        key: 'messages',
        chip: 'Message',
        summary: `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`,
        text: `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'} on this job.`,
        onView: onOpenMessages,
      })
    }

    if (noteCount > 0) {
      out.push({
        key: 'notes',
        chip: 'Note',
        summary: `${noteCount} note${noteCount === 1 ? '' : 's'}`,
        text: `${noteCount} note${noteCount === 1 ? '' : 's'} on this job.`,
        onView: onOpenNotes,
      })
    }

    return out
  }, [workOrder, hasLiveInvoice, unreadMessages, noteCount, onOpenNotes, onOpenMessages])

  if (flags.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
          {flags.length}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-bold text-amber-900">Needs attention</span>
          <span className="ml-2 text-xs text-amber-700">{flags.map((f) => f.summary).join(' · ')}</span>
        </span>
        <svg viewBox="0 0 12 12" fill="none" className={'h-4 w-4 shrink-0 text-amber-700 transition-transform ' + (collapsed ? '' : 'rotate-180')}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-2">
          {flags.map((f) => (
            <div key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-100 bg-white px-3 py-2.5">
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">{f.chip}</span>
              <span className="min-w-0 flex-1 text-sm text-slate-700">{f.text}</span>
              {f.onView && (
                <button type="button" onClick={f.onView} className="shrink-0 text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline">
                  View
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
