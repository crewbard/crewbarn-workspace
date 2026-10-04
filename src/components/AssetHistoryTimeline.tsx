import { Link } from 'react-router-dom'
import { useAssetHistory } from '@/hooks/useAssetHistory'
import type { AssetHistoryEvent } from '@/types/assetHistory'

/**
 * AssetHistoryTimeline — Slice 7c.
 *
 * Vertical chronological list of everything that's ever happened on
 * an asset: estimate line items quoted, work order line items
 * scheduled or performed, inventory components installed or returned
 * via the Slice 6a bridge. Newest first.
 *
 * The "installer pulls asset report" UX described in
 * CREWBARN-ASSET-LIFECYCLE-DESIGN.md - tech opens the asset and sees
 * what's planned plus what's already been installed, with links back
 * to the source estimate / work order.
 *
 * Empty state: "No history yet" with a hint about how history accrues.
 */
export function AssetHistoryTimeline({ assetId }: { assetId: string }) {
  const { data: events, isLoading, isError, error } = useAssetHistory(assetId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-red-700">
        Failed to load history.{error instanceof Error ? ` ${error.message}` : ''}
      </p>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic px-2 py-4 text-center">
        No history yet. Quotes and jobs that reference this item, parts
        installed against it, and anything a tech logs or notes on site
        will appear here as it happens.
      </div>
    )
  }

  return (
    <ul className="border border-slate-200 rounded-md divide-y divide-slate-100">
      {events.map((event) => (
        <li key={`${event.type}-${event.event_id}`}>
          <EventRow event={event} />
        </li>
      ))}
    </ul>
  )
}

/** One glyph per kind, so the column reads without being read. */
const LOG_ICONS: Record<string, string> = {
  note: '📝',
  work: '🔧',
  part_replaced: '✅',
  part_needed: '📦',
  finding: '⚠️',
  skipped: '⏭️',
}

const LOG_LABELS: Record<string, string> = {
  note: 'Note',
  work: 'Work done',
  part_replaced: 'Part fitted',
  part_needed: 'Part needed',
  finding: 'Fault raised',
  skipped: 'Skipped',
}

function EventRow({ event }: { event: AssetHistoryEvent }) {
  const date = event.event_date ? new Date(event.event_date) : null
  const dateLabel = date ? formatDate(date) : ''

  if (event.type === 'inventory_movement') {
    const isInstall = event.movement_type === 'install'
    const icon = isInstall ? '🔧' : '⬅'
    const verb = isInstall ? 'Installed' : 'Removed'
    return (
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="text-xl flex-shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-900">
            <span className="font-medium">{verb}</span>{' '}
            {event.catalog_item_name ?? 'component'}
            {event.serial_number && (
              <span className="font-mono text-xs text-slate-500 ml-1">
                ({event.serial_number})
              </span>
            )}
          </div>
          {event.description && event.description !== verb + ' component' && (
            <div className="text-xs text-slate-500 mt-0.5">{event.description}</div>
          )}
        </div>
        <div className="text-xs text-slate-500 flex-shrink-0">{dateLabel}</div>
      </div>
    )
  }

  if (event.type === 'service_log') {
    /*
     * A note reads differently from the rest and should look it. The
     * others are an account of work; a note is somebody telling the next
     * person something, and burying it among line items is how it stops
     * being read.
     */
    const isNote = event.kind === 'note'
    const parent = event.parent
    return (
      <div className={'flex items-start gap-3 px-3 py-2.5' + (isNote ? ' bg-amber-50/60' : '')}>
        <div className="text-xl flex-shrink-0">{LOG_ICONS[event.kind] ?? '📝'}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-900">{event.description}</div>
          {event.details && (
            <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{event.details}</div>
          )}
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{LOG_LABELS[event.kind] ?? event.kind}</span>
            {event.part_name && (
              <>
                <span className="text-slate-300">·</span>
                <span>{event.part_name}</span>
              </>
            )}
            {/*
              Said plainly, because the person reading this is deciding
              whether the customer has seen it too.
            */}
            {event.visibility === 'internal' && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Not shown to the customer</span>
              </>
            )}
            {parent && (
              <>
                <span className="text-slate-300">·</span>
                <Link to={`/jobs/${parent.id}`} className="text-amber-700 hover:underline">
                  Job {parent.display_number ?? parent.number}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500 flex-shrink-0">{dateLabel}</div>
      </div>
    )
  }

  if (event.type === 'inspection_record') {
    const parent = event.parent
    const parentLink = parent ? `/jobs/${parent.id}` : null
    const parentLabel = parent
      ? `Job ${parent.display_number ?? parent.number}`
      : null
    const isFinal = Boolean(event.finalized_at)
    return (
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="text-xl flex-shrink-0">🧾</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-900 truncate">
            {event.description || 'Inspection report'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span
              className={
                'text-xs px-1.5 py-0.5 rounded ' +
                statusClass(event.overall_status)
              }
            >
              {isFinal ? event.overall_status : 'in progress'}
            </span>
            {parent && (
              <>
                <span className="text-slate-300">·</span>
                {parentLink ? (
                  <Link
                    to={parentLink}
                    className="text-amber-700 hover:underline"
                  >
                    {parentLabel}
                  </Link>
                ) : (
                  <span>{parentLabel}</span>
                )}
                {event.report_path && <span className="text-emerald-700">PDF ready</span>}
              </>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500 flex-shrink-0">{dateLabel}</div>
      </div>
    )
  }

  // Estimate or work order line
  const isEstimate = event.type === 'estimate_line'
  const icon = isEstimate ? '📋' : '🛠'
  const parent = event.parent
  const parentLink = parent
    ? isEstimate
      ? `/estimates/${parent.id}`
      : `/jobs/${parent.id}`
    : null
  const parentLabel = parent
    ? `${isEstimate ? 'EST' : 'Job'} ${parent.display_number ?? parent.number}`
    : null

  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <div className="text-xl flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-900 truncate">
          {event.description || '(no description)'}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span>
            qty {Number(event.quantity).toFixed(0)} ·{' '}
            {formatCents(event.line_total_cents)}
          </span>
          {parent && (
            <>
              <span className="text-slate-300">·</span>
              {parentLink ? (
                <Link
                  to={parentLink}
                  className="text-amber-700 hover:underline"
                >
                  {parentLabel}
                </Link>
              ) : (
                <span>{parentLabel}</span>
              )}
              <span
                className={
                  'text-xs px-1.5 py-0.5 rounded ' +
                  statusClass(parent.status)
                }
              >
                {parent.status}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="text-xs text-slate-500 flex-shrink-0">{dateLabel}</div>
    </div>
  )
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCents(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}

function statusClass(status: string): string {
  // Light coloring per status for at-a-glance scan
  switch (status) {
    case 'approved':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700'
    case 'sent':
    case 'in_progress':
    case 'scheduled':
      return 'bg-amber-50 text-amber-700'
    case 'rejected':
    case 'cancelled':
      return 'bg-red-50 text-red-700'
    case 'superseded':
    case 'expired':
      return 'bg-slate-100 text-slate-600'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}
