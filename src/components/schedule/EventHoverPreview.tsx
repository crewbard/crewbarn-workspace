import { useEffect, useState } from 'react'
import type { ScheduleWorkOrder } from '@/types/schedule'
import { EventBadges } from './EventBadges'

/**
 * Lightweight popover shown when the dispatcher hovers an event for
 * >250ms. Surfaces the most relevant context inline — customer, address,
 * status, scheduled window, tech — without forcing a click into the
 * detail panel.
 *
 * Renders fixed-position near the cursor, clamps to viewport edges.
 */
export function EventHoverPreview({
  wo,
  x,
  y,
  onClose,
}: {
  wo: ScheduleWorkOrder
  x: number
  y: number
  onClose: () => void
}) {
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 })

  useEffect(() => {
    // Clamp inside viewport
    const w = 280
    const h = 200
    const left = Math.min(x + 12, window.innerWidth - w - 8)
    const top = Math.min(y + 12, window.innerHeight - h - 8)
    setPos({ left, top })
  }, [x, y])

  const start = wo.scheduled_start_time ? new Date(wo.scheduled_start_time) : null
  const end = wo.scheduled_end_time ? new Date(wo.scheduled_end_time) : null
  const completed = wo.completed_at ? new Date(wo.completed_at) : null
  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const fmtStamp = (d: Date) =>
    `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${fmtTime(d)}`

  return (
    <div
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 250, width: 280 }}
      className="bg-white border border-slate-200 rounded-md shadow-xl pointer-events-none"
      onClick={onClose}
    >
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: wo.status?.color || '#94a3b8' }}
          />
          <div className="font-semibold text-sm text-slate-900 truncate flex-1">
            {wo.customer?.name ?? '—'}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          #{wo.work_order_number ?? '—'} · {wo.status?.name ?? 'No status'}
        </div>
      </div>

      <div className="px-3 py-2 space-y-1 text-xs">
        {start && (
          <div>
            <span className="text-slate-500">When: </span>
            <span className="text-slate-800 font-medium">
              {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {fmtTime(start)}
              {end && ` – ${fmtTime(end)}`}
            </span>
          </div>
        )}
        {wo.lead_tech?.name && (
          <div>
            <span className="text-slate-500">Tech: </span>
            <span className="text-slate-800">{wo.lead_tech.name}</span>
          </div>
        )}
        {/* "On site" now surfaces via the EventBadges row below (live flag). */}
        {completed && (
          <div>
            <span className="text-slate-500">Completed: </span>
            <span className="text-slate-800">{fmtStamp(completed)}</span>
          </div>
        )}
        {wo.service_location && (
          <div>
            <span className="text-slate-500">📍 </span>
            <span className="text-slate-800">
              {wo.service_location.nickname ?? wo.service_location.street_address ?? '—'}
            </span>
          </div>
        )}
        {wo.title && (
          <div className="text-slate-600 italic truncate">{wo.title}</div>
        )}

        {/* Flag badges — the cards (esp. Day/Week, which are too small) hide
            these; the hover preview is where the dispatcher reads them. */}
        <EventBadges
          flags={wo.flags}
          onSiteAt={wo.on_site_at}
          onSite={wo.on_site}
          fieldVisit={wo.field_visit}
          labeled
          className="pt-1"
        />
      </div>

      <div className="px-3 py-1.5 border-t border-slate-100 text-[10px] text-slate-400 text-right">
        click to open · right-click for actions
      </div>
    </div>
  )
}
