import { matteStatusBorder, matteStatusFill, statusAccentColor } from '@/lib/statusColor'
import type { ScheduleWorkOrder } from '@/types/schedule'

/**
 * MobileScheduleAgenda — phone-native replacement for the week/day/month
 * grids, which are unusable below ~640px (43px day columns, 180px tech
 * lanes, drag-and-drop). Instead we show ONE day as a vertical, tappable
 * list of jobs sorted by start time — the pattern every mobile calendar
 * app uses (Google Calendar "Schedule", Apple Calendar list).
 *
 * Scheduling itself (drag-to-move, resize) stays desktop-only; on a phone
 * the office is *reading* the day and tapping into a job. Reassign / status
 * changes happen inside the job detail panel that opens on tap.
 *
 * Self-contained day navigation (‹ Today ›) so it doesn't depend on the
 * desktop toolbar's view-aware stepper.
 */
export function MobileScheduleAgenda({
  date,
  events,
  onSelectEvent,
  onStepDay,
  onToday,
  colorFor,
  isLate,
}: {
  date: Date
  events: ScheduleWorkOrder[]
  onSelectEvent: (wo: ScheduleWorkOrder) => void
  onStepDay: (delta: number) => void
  onToday: () => void
  colorFor: (wo: ScheduleWorkOrder) => string
  isLate: (wo: ScheduleWorkOrder) => boolean
}) {
  // Same calendar day as `date`, sorted by start time. Events without a
  // start time shouldn't appear in calendar payloads, but guard anyway.
  const dayEvents = events
    .filter((w) => {
      if (!w.scheduled_start_time) return false
      const s = new Date(w.scheduled_start_time)
      return (
        s.getFullYear() === date.getFullYear() &&
        s.getMonth() === date.getMonth() &&
        s.getDate() === date.getDate()
      )
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_start_time!).getTime() -
        new Date(b.scheduled_start_time!).getTime(),
    )

  const isToday = (() => {
    const now = new Date()
    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    )
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Day nav header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-white sticky top-0 z-10">
        <button
          type="button"
          onClick={() => onStepDay(-1)}
          className="w-10 h-10 rounded-md hover:bg-slate-100 text-slate-600 text-xl flex items-center justify-center"
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="text-center min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {date.toLocaleDateString(undefined, {
              weekday: 'long',
            })}
          </div>
          <div className="text-xs text-slate-500">
            {date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isToday && (
            <button
              type="button"
              onClick={onToday}
              className="text-xs px-2.5 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => onStepDay(1)}
            className="w-10 h-10 rounded-md hover:bg-slate-100 text-slate-600 text-xl flex items-center justify-center"
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dayEvents.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-12">
            No jobs scheduled for this day.
          </div>
        ) : (
          dayEvents.map((wo) => {
            const color = colorFor(wo)
            const fill = matteStatusFill(color, wo.status?.color_secondary)
            const border = matteStatusBorder(color)
            const accent = statusAccentColor(color)
            const late = isLate(wo)
            return (
              <button
                key={wo.id}
                type="button"
                onClick={() => onSelectEvent(wo)}
                className="w-full text-left flex gap-3 rounded-lg border p-3 hover:border-amber-300 active:bg-amber-50/40"
                style={{ background: fill, borderColor: late ? '#dc2626' : border }}
              >
                {/* Color rail = status color */}
                <span
                  className="w-1.5 self-stretch rounded-full shrink-0"
                  style={{ background: accent }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {fmtTimeRange(wo.scheduled_start_time, wo.scheduled_end_time)}
                    </span>
                    {wo.status?.name && (
                      <span
                        className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          // colorFor returns a normalized #rrggbb hex, so
                          // appending alpha is safe. (Raw status.color can
                          // be rgb()/named, which would break "+22".)
                          background: color + '22',
                          color,
                        }}
                      >
                        {wo.status.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-medium text-slate-900 leading-snug break-words">
                    {wo.title || `WO ${wo.work_order_number ?? ''}`}
                    {wo.kind === 'estimate' && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-sky-100 text-sky-700 px-1 py-0.5 rounded">
                        Est
                      </span>
                    )}
                    {late && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-red-100 text-red-700 px-1 py-0.5 rounded">
                        Late
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600 truncate">
                    {wo.customer?.name ?? '—'}
                    {wo.service_location?.nickname &&
                      ` · ${wo.service_location.nickname}`}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 truncate">
                    {wo.lead_tech?.name ? (
                      <>👷 {wo.lead_tech.name}</>
                    ) : (
                      <span className="text-amber-700">Unassigned</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function fmtTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'All day'
  const s = new Date(start)
  const startStr = s.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (!end) return startStr
  const e = new Date(end)
  const endStr = e.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${startStr} – ${endStr}`
}
