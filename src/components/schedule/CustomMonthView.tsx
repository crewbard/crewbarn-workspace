import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

// Measure droppables continuously (not just at drag-start). The unschedule
// drop zone only mounts once a drag begins, so the default WhileDragging
// strategy would never give it a rect → drops on it wouldn't register.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } }
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import type { ScheduleCardDensity, ScheduleTimeOffBlock, ScheduleWorkOrder } from '@/types/schedule'
import { matteStatusBorder, matteStatusFill, matteStatusTextColor, statusAccentColor } from '@/lib/statusColor'
import { isSameDay } from './calendarUtils'
import { EventBadges } from './EventBadges'
import { EventContextMenu } from './EventContextMenu'
import { EventHoverPreview } from './EventHoverPreview'
import { CalendarTaskChips } from './CalendarTaskChips'
import type { Task } from '@/lib/tasks'

/**
 * Custom Month view. 6-week grid (always renders 6 rows so the layout
 * doesn't shift between short and long months).
 *
 * Events render as compact colored bars within their day cell. Every job is
 * shown (no "+N more" truncation) — a busy day's whole grid ROW grows to fit
 * its tallest cell (auto rows), so cards never bleed into the day below.
 *
 * Dragging uses a DragOverlay: the dragged card is portaled above the grid so
 * it's never clipped by the scroll container (fixes "drags under the calendar").
 * Drop onto another day = reschedule to that day, keeping time-of-day.
 */
export interface CustomMonthViewProps {
  date: Date
  events: ScheduleWorkOrder[]
  /** Due-dated tasks to plot as deadline chips (by due_at day). */
  tasks?: Task[]
  /** Approved staff time-off blocks to show as read-only day markers. */
  timeOffBlocks?: ScheduleTimeOffBlock[]
  /** Drag a task onto a day → reschedule its due date to that day. */
  onTaskRescheduleToDay?: (taskId: string, dayIso: string) => void
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  onReschedule: (id: string, startIso: string, endIso: string) => void
  colorFor: (wo: ScheduleWorkOrder) => string
  textColorFor: (hex: string) => string
  isLate: (wo: ScheduleWorkOrder) => boolean
  onChangeStatus?: (id: string, statusId: string) => void
  onReassign?: (id: string, techAccountId: string | null) => void
  onChangeTime?: (id: string, startIso: string, endIso: string) => void
  /** Click a day header to jump to Day view for that date. */
  onJumpToDay?: (d: Date) => void
  /** Drag a card onto the "unschedule" strip → remove it from the calendar
   *  (back to the To-Schedule sidebar). */
  onUnschedule?: (id: string) => void
  /** Sidebar overlay element to portal the unschedule drop target into. */
  unscheduleDropContainer?: HTMLElement | null
  /** Zoom (1 = 100%). Scales the minimum day-cell row height. */
  zoom?: number
  /** Card density for month bars. */
  cardDensity?: ScheduleCardDensity
}

export function CustomMonthView({
  date,
  events,
  tasks = [],
  timeOffBlocks = [],
  onTaskRescheduleToDay,
  onSelectEvent,
  onReschedule,
  colorFor,
  textColorFor,
  isLate,
  onChangeStatus,
  onReassign,
  onChangeTime,
  onJumpToDay,
  onUnschedule,
  unscheduleDropContainer,
  zoom = 1,
  cardDensity = 'standard',
}: CustomMonthViewProps) {
  // Zoom scales the minimum row height so busy months can be made roomier
  // (or tighter) just like the Day/Week time grid.
  const minRowPx = Math.round(140 * zoom)
  const [contextMenu, setContextMenu] = useState<{ wo: ScheduleWorkOrder; x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{ wo: ScheduleWorkOrder; x: number; y: number } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Is the drag pointer inside the sidebar drop container right now?
  function pointerOverSidebar(e: { activatorEvent: Event; delta: { x: number; y: number } }): boolean {
    const el = unscheduleDropContainer
    if (!el) return false
    const ae = e.activatorEvent as PointerEvent
    if (typeof ae?.clientX !== 'number') return false
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return false
    const x = ae.clientX + e.delta.x
    const y = ae.clientY + e.delta.y
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }
  // True while/just-after a drag so the trailing click doesn't open the panel.
  const justDraggedRef = useRef(false)

  // Build a 6x7 grid starting from the Monday before the month begins.
  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [date])

  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleWorkOrder[]>()
    for (const e of events) {
      if (!e.scheduled_start_time) continue
      const s = new Date(e.scheduled_start_time)
      const key = `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    // Sort within each day by start time
    for (const arr of map.values()) {
      arr.sort((a, b) =>
        new Date(a.scheduled_start_time!).getTime() -
        new Date(b.scheduled_start_time!).getTime(),
      )
    }
    return map
  }, [events])

  const timeOffByDay = useMemo(() => {
    const map = new Map<string, ScheduleTimeOffBlock[]>()
    for (const block of timeOffBlocks) {
      for (const d of cells) {
        if (timeOffCoversDate(block, d)) {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const arr = map.get(key) ?? []
          arr.push(block)
          map.set(key, arr)
        }
      }
    }
    return map
  }, [timeOffBlocks, cells])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_at) continue
      const s = new Date(t.due_at)
      const key = `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const activeWo = activeId ? events.find((w) => w.id === activeId) ?? null : null

  function handleDragStart(e: DragStartEvent) {
    justDraggedRef.current = true
    setActiveId(String(e.active.id))
  }

  function resetJustDragged() {
    // Clear on the next tick so the click that fires right after drop is
    // still suppressed.
    setTimeout(() => {
      justDraggedRef.current = false
    }, 0)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    resetJustDragged()

    const eventId = String(e.active.id)

    // Dropped over the "To Schedule" sidebar → pull it off the calendar.
    // Cursor-vs-rect, not @dnd-kit collision (unreliable here).
    if (onUnschedule && pointerOverSidebar(e)) {
      onUnschedule(eventId)
      return
    }

    const wo = events.find((w) => w.id === eventId)
    if (!wo || !wo.scheduled_start_time) return

    const overDayKey = (e.over?.data?.current as { dayKey?: string } | undefined)?.dayKey
    if (!overDayKey) return

    const overDay = new Date(overDayKey)
    const oldStart = new Date(wo.scheduled_start_time)
    if (isSameDay(oldStart, overDay)) return

    // Preserve time-of-day; just swap the date.
    const oldEnd = wo.scheduled_end_time
      ? new Date(wo.scheduled_end_time)
      : new Date(oldStart.getTime() + (wo.estimated_duration_minutes ?? 60) * 60000)
    const newStart = new Date(overDay)
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
    const durationMs = oldEnd.getTime() - oldStart.getTime()
    const newEnd = new Date(newStart.getTime() + durationMs)

    onReschedule(wo.id, newStart.toISOString(), newEnd.toISOString())
  }

  const dayNames = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'EEE'))
  }, [])

  // Native-DnD drop of an unscheduled sidebar job onto a day → schedule it on
  // that date (month is date-granular; default 9 AM, 1-hour duration).
  function handleNativeDropDay(id: string, day: Date) {
    const start = new Date(day)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60000)
    onReschedule(id, start.toISOString(), end.toISOString())
  }

  return (
    <DndContext
      sensors={sensors}
      measuring={MEASURING}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        resetJustDragged()
      }}
    >
      <div className="relative h-full flex flex-col overflow-hidden">
        {/* Drag a card left over the "To Schedule" sidebar to unschedule it —
            detected by pointerOverSidebar in handleDragEnd (no overlay). */}
        {contextMenu && (
          <EventContextMenu
            wo={contextMenu.wo}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onChangeStatus={(statusId) => onChangeStatus?.(contextMenu.wo.id, statusId)}
            onReassign={(techId) => onReassign?.(contextMenu.wo.id, techId)}
            onChangeTime={onChangeTime ? (s, e) => onChangeTime(contextMenu.wo.id, s, e) : undefined}
            onOpenDetail={() => onSelectEvent?.(contextMenu.wo)}
          />
        )}
        {hoverPreview && !contextMenu && (
          <EventHoverPreview
            wo={hoverPreview.wo}
            x={hoverPreview.x}
            y={hoverPreview.y}
            onClose={() => setHoverPreview(null)}
          />
        )}

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {dayNames.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide text-center border-r border-slate-200 last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>

        {/* 6-week grid — auto rows so each week-row grows to fit its busiest
            day; every event card is shown and rows never overlap. The whole
            grid scrolls vertically when the month is taller than the viewport. */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-7" style={{ gridAutoRows: `minmax(${minRowPx}px, auto)` }}>
          {cells.map((d) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            const dayEvents = eventsByDay.get(key) ?? []
            const inMonth = d >= monthStart && d <= monthEnd
            return (
              <DayCell
                key={key}
                day={d}
                inMonth={inMonth}
                events={dayEvents}
                tasks={tasksByDay.get(key) ?? []}
                timeOffBlocks={timeOffByDay.get(key) ?? []}
                onTaskRescheduleToDay={onTaskRescheduleToDay}
                activeId={activeId}
                onJumpToDay={onJumpToDay}
                onSelectEvent={onSelectEvent}
                colorFor={colorFor}
                textColorFor={textColorFor}
                isLate={isLate}
                justDraggedRef={justDraggedRef}
                onContextMenu={(wo, x, y) => setContextMenu({ wo, x, y })}
                onHoverStart={(wo, x, y) => setHoverPreview({ wo, x, y })}
                onHoverEnd={() => setHoverPreview(null)}
                onNativeDropDay={handleNativeDropDay}
                cardDensity={cardDensity}
              />
            )
          })}
          </div>
        </div>
      </div>

      {/* Portaled drag ghost — rides above the grid, immune to overflow clipping. */}
      <DragOverlay dropAnimation={null}>
        {activeWo ? (
          <div style={{ width: 160, pointerEvents: 'none' }}>
            <MonthBarContent
              wo={activeWo}
              color={colorFor(activeWo)}
              textColor={textColorFor(colorFor(activeWo))}
              late={isLate(activeWo)}
              cardDensity={cardDensity}
              dragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function DayCell({
  day,
  inMonth,
  events,
  tasks,
  timeOffBlocks,
  activeId,
  onJumpToDay,
  onSelectEvent,
  colorFor,
  textColorFor,
  isLate,
  justDraggedRef,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  onNativeDropDay,
  onTaskRescheduleToDay,
  cardDensity,
}: {
  day: Date
  inMonth: boolean
  events: ScheduleWorkOrder[]
  tasks: Task[]
  timeOffBlocks: ScheduleTimeOffBlock[]
  activeId: string | null
  onJumpToDay?: (d: Date) => void
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  colorFor: (wo: ScheduleWorkOrder) => string
  textColorFor: (hex: string) => string
  isLate: (wo: ScheduleWorkOrder) => boolean
  justDraggedRef: React.MutableRefObject<boolean>
  onContextMenu: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverStart: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverEnd: () => void
  onTaskRescheduleToDay?: (taskId: string, dayIso: string) => void
  /** Native-DnD drop of an unscheduled sidebar job onto this day. */
  onNativeDropDay?: (id: string, day: Date) => void
  cardDensity: ScheduleCardDensity
}) {
  const dayKey = day.toISOString()
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayKey}`,
    data: { dayKey },
  })
  const [nativeOver, setNativeOver] = useState(false)
  const today = isSameDay(day, new Date())

  return (
    <div
      ref={setNodeRef}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setNativeOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setNativeOver(false)
      }}
      onDrop={(e) => {
        setNativeOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        if (id.startsWith('task:')) {
          onTaskRescheduleToDay?.(id.slice(5), day.toISOString())
        } else {
          onNativeDropDay?.(id, day)
        }
      }}
      className={`border-r border-b border-slate-200 last:border-r-0 p-1 flex flex-col ${
        inMonth ? 'bg-white' : 'bg-slate-50/60'
      } ${isOver || nativeOver ? '!bg-amber-50/70 ring-2 ring-inset ring-amber-300' : ''}`}
    >
      {nativeOver && (
        <div className="pointer-events-none mb-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 shadow-sm">
          Drop here: {format(day, 'MMM d')}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={() => onJumpToDay?.(day)}
          title="Jump to Day view"
          className={`text-[11px] font-semibold rounded px-1.5 py-0.5 ${
            today
              ? 'bg-amber-500 text-white'
              : inMonth
                ? 'text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-100'
          }`}
        >
          {format(day, 'd')}
        </button>
        {events.length > 0 && (
          <span className="text-[10px] text-slate-400">{events.length}</span>
        )}
      </div>

      <CalendarTaskChips tasks={tasks} />
      <TimeOffChips blocks={timeOffBlocks} />

      <div className="space-y-1">
        {events.map((wo) => (
          <DraggableMonthBar
            key={wo.id}
            wo={wo}
            color={colorFor(wo)}
            textColor={textColorFor(colorFor(wo))}
            late={isLate(wo)}
            dimmed={activeId === wo.id}
            justDraggedRef={justDraggedRef}
            onSelectEvent={onSelectEvent}
            onContextMenu={onContextMenu}
            onHoverStart={onHoverStart}
            onHoverEnd={onHoverEnd}
            cardDensity={cardDensity}
          />
        ))}
      </div>
    </div>
  )
}

function timeOffCoversDate(block: ScheduleTimeOffBlock, date: Date): boolean {
  if (!block.start_date || !block.end_date) return false
  const day = format(date, 'yyyy-MM-dd')
  return block.start_date <= day && block.end_date >= day
}

function humanizeTimeOffType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Time off'
}

function timeOffMinutes(value: string | null): number | null {
  if (!value) return null
  const [hourRaw, minuteRaw = '0'] = value.slice(0, 5).split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function formatHourLabel(value: string): string {
  const minutes = timeOffMinutes(value)
  if (minutes == null) return value
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

function isHourlyTimeOff(block: ScheduleTimeOffBlock): boolean {
  return !block.all_day && Boolean(block.start_time && block.end_time && block.start_date === block.end_date)
}

function formatTimeOffRange(block: ScheduleTimeOffBlock): string {
  if (!block.start_date || !block.end_date) return 'date not set'
  const start = new Date(`${block.start_date}T00:00:00`)
  const end = new Date(`${block.end_date}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'date not set'
  const startLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
  if (!isHourlyTimeOff(block) || !block.start_time || !block.end_time) return dateLabel
  return `${dateLabel}, ${formatHourLabel(block.start_time)}-${formatHourLabel(block.end_time)}`
}

function TimeOffChips({ blocks }: { blocks: ScheduleTimeOffBlock[] }) {
  if (blocks.length === 0) return null
  return (
    <div className="mb-1 space-y-0.5">
      {blocks.slice(0, 2).map((block) => (
        <div
          key={block.id}
          className="truncate rounded border border-sky-200 bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800"
          title={`${block.account_name ?? 'Staff member'} · ${humanizeTimeOffType(block.type)} · ${formatTimeOffRange(block)}`}
        >
          Off: {block.account_name ?? 'Staff'}{isHourlyTimeOff(block) && block.start_time ? ' ' + formatHourLabel(block.start_time) : ''}
        </div>
      ))}
      {blocks.length > 2 && <div className="text-[10px] font-medium text-sky-700">+{blocks.length - 2} more off</div>}
    </div>
  )
}

function DraggableMonthBar({
  wo,
  color,
  textColor,
  late,
  dimmed,
  justDraggedRef,
  onSelectEvent,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  cardDensity,
}: {
  wo: ScheduleWorkOrder
  color: string
  textColor: string
  late: boolean
  dimmed: boolean
  justDraggedRef: React.MutableRefObject<boolean>
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  onContextMenu: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverStart: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverEnd: () => void
  cardDensity: ScheduleCardDensity
}) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: wo.id })

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }, [])

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Suppress the click that fires immediately after a drag drop.
        if (justDraggedRef.current) return
        e.stopPropagation()
        onSelectEvent?.(wo)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        onHoverEnd()
        onContextMenu(wo, e.clientX, e.clientY)
      }}
      onMouseEnter={(e) => {
        if (isDragging) return
        const x = e.clientX
        const y = e.clientY
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = setTimeout(() => onHoverStart(wo, x, y), 350)
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
        onHoverEnd()
      }}
      style={{
        opacity: 1,
        filter: dimmed ? 'brightness(0.96)' : undefined,
        boxShadow: dimmed ? '0 14px 30px rgba(15, 23, 42, 0.20)' : undefined,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <MonthBarContent wo={wo} color={color} textColor={textColor} late={late} cardDensity={cardDensity} />
    </div>
  )
}

/** Presentational event bar — shared by the in-grid bar and the drag ghost. */
function MonthBarContent({
  wo,
  color,
  textColor,
  late,
  cardDensity,
  dragging,
}: {
  wo: ScheduleWorkOrder
  color: string
  textColor: string
  late: boolean
  cardDensity: ScheduleCardDensity
  dragging?: boolean
}) {
  const start = new Date(wo.scheduled_start_time!)
  const end = wo.scheduled_end_time ? new Date(wo.scheduled_end_time) : null
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  const timeRange = end ? `${fmt(start)} - ${fmt(end)}` : fmt(start)
  const techName = wo.lead_tech?.name ?? null
  const showTech = cardDensity !== 'compact' && techName
  const showBadges = cardDensity === 'detailed'
  const statusName = wo.status?.name
  const jobTypeName = wo.job_type?.name
  // Tech physically on site right now (On Site status or open visit) → breathe
  // a green↔amber ring. Suppress while dragging so the ghost doesn't pulse.
  // Authoritative server flag, not the sticky on_site_at first-arrival stamp.
  const onSite = !!wo.on_site && !dragging
  const accentColor = statusAccentColor(color)
  const borderColor = matteStatusBorder(color)
  const background = matteStatusFill(color, wo.status?.color_secondary)
  const readableText = textColor === '#ffffff' ? matteStatusTextColor() : textColor

  return (
    <div
      style={{
        background,
        color: readableText,
        borderRadius: 4,
        border: late ? '1.5px solid #dc2626' : `1px solid ${borderColor}`,
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: dragging ? '0 10px 24px rgba(15,23,42,0.24)' : undefined,
      }}
      className={`${cardDensity === 'compact' ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-1 text-[11px]'} leading-tight ${onSite ? 'onsite-pulse' : ''}`}
    >
      <div className="text-center text-[10px] font-medium opacity-90">{timeRange}</div>
      <div className="text-center font-bold text-[12px] leading-tight my-0.5 break-words">
        {wo.customer?.name ?? '—'}
      </div>
      {showTech && (
        <div className="text-center text-[10px] opacity-90 break-words">
          <span className="font-semibold">Techs:</span> {techName}
        </div>
      )}
      {cardDensity === 'detailed' && (statusName || jobTypeName) && (
        <div className="text-center text-[10px] opacity-85 truncate">{[statusName, jobTypeName].filter(Boolean).join(' · ')}</div>
      )}
      {showBadges && (
        <EventBadges
          flags={wo.flags}
          onSiteAt={wo.on_site_at}
          onSite={wo.on_site}
          fieldVisit={wo.field_visit}
          className="mt-0.5 justify-center"
        />
      )}
    </div>
  )
}
