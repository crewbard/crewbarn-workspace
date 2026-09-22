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
  useDndMonitor,
  type DragEndEvent,
} from '@dnd-kit/core'

// Measure droppables continuously so the drag-mounted unschedule drop zone
// (which only appears once a drag starts) is detected on drop.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } }
import { format } from 'date-fns'
import type { ScheduleCardDensity, ScheduleTimeOffBlock, ScheduleWorkOrder } from '@/types/schedule'
import { matteStatusBorder, matteStatusFill, matteStatusTextColor, statusAccentColor } from '@/lib/statusColor'
import { StatusIcon } from '@/lib/statusIcons'
import {
  DEFAULT_SCROLL_HOUR,
  SLOT_MINUTES,
  SLOT_PX,
  SLOTS_PER_DAY,
  durationToHeight,
  hourLabels,
  isSameDay,
  packTimedEvents,
  type PackedEventLayout,
  timeToY,
  weekDays,
  yToTime,
} from './calendarUtils'
import { EventContextMenu } from './EventContextMenu'
import { EventHoverPreview } from './EventHoverPreview'
import { CalendarTaskChips } from './CalendarTaskChips'
import type { Task } from '@/lib/tasks'

/**
 * Custom Week view — built from scratch with @dnd-kit for smooth drag.
 * Replaces react-big-calendar's flaky DnD. Transform-based positioning
 * means the cursor stays glued to the dragged event with zero flicker.
 *
 * Layout: time axis on the left, 7 day columns stacked into a CSS grid.
 * Events are absolutely positioned within their day column using the
 * timeToY() helper. Drag updates the event's parent column + Y offset;
 * onDragEnd computes the new start time + invokes the reschedule mutation.
 */
export interface CustomWeekViewProps {
  date: Date
  events: ScheduleWorkOrder[]
  /** Due-dated tasks to plot as deadline chips (by due_at day). */
  tasks?: Task[]
  /** Approved staff time-off blocks to show as read-only day markers. */
  timeOffBlocks?: ScheduleTimeOffBlock[]
  /** Drag a task onto a day column → reschedule its due date to that day. */
  onTaskRescheduleToDay?: (taskId: string, dayIso: string) => void
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  onReschedule: (id: string, startIso: string, endIso: string) => void
  /** Color-by-status helper passed from parent so we share status map state. */
  colorFor: (wo: ScheduleWorkOrder) => string
  textColorFor: (hex: string) => string
  /** Late = scheduled but past start with no progress; renders red border. */
  isLate: (wo: ScheduleWorkOrder) => boolean
  /** Right-click → change status. */
  onChangeStatus?: (id: string, statusId: string) => void
  /** Right-click → reassign tech (null to unassign). */
  onReassign?: (id: string, techAccountId: string | null) => void
  /** Right-click → change time (datetime picker). */
  onChangeTime?: (id: string, startIso: string, endIso: string) => void
  /** Right-click → convert estimate to job (estimate events only). */
  onConvertEstimate?: (estimateId: string) => void
  /** Drag a card onto the unschedule strip → remove from the calendar. */
  onUnschedule?: (id: string) => void
  /** Sidebar overlay element to portal the unschedule drop target into. */
  unscheduleDropContainer?: HTMLElement | null
  /** Time-grid zoom (1 = 100%). Scales the pixel height of every slot. */
  zoom?: number
  /** Card density: compact for busy boards, detailed for smaller schedules. */
  cardDensity?: ScheduleCardDensity
}
export function CustomWeekView({
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
  onConvertEstimate,
  onUnschedule,
  unscheduleDropContainer,
  zoom = 1,
  cardDensity = 'standard',
}: CustomWeekViewProps) {
  const days = useMemo(() => weekDays(date), [date])
  const labels = useMemo(() => hourLabels(), [])
  // All vertical geometry scales off slotPx; zoom just multiplies the base.
  const slotPx = SLOT_PX * zoom
  const dayPx = SLOTS_PER_DAY * slotPx
  const scrollRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ wo: ScheduleWorkOrder; x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{ wo: ScheduleWorkOrder; x: number; y: number } | null>(null)
  // Track the dragging event so we can render it in a body-portaled
  // DragOverlay — that floats above the overflow-auto scroll container so the
  // card isn't clipped at the calendar's left edge while dragging to the sidebar.
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeWo = activeId ? events.find((e) => e.id === activeId) ?? null : null

  // Is the drag pointer inside the "To Schedule" sidebar drop container?
  // Direct rect test — reliable where @dnd-kit collision is not (portaled,
  // drag-mounted drop zone).
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

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const slotsPerHour = 60 / SLOT_MINUTES
    el.scrollTop = DEFAULT_SCROLL_HOUR * slotsPerHour * slotPx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Group events by day for column-local rendering.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleWorkOrder[]>()
    for (const e of events) {
      if (!e.scheduled_start_time) continue
      const start = new Date(e.scheduled_start_time)
      for (const d of days) {
        if (isSameDay(start, d)) {
          const key = d.toISOString()
          const arr = map.get(key) ?? []
          arr.push(e)
          map.set(key, arr)
          break
        }
      }
    }
    return map
  }, [events, days])

  const timeOffByDay = useMemo(() => {
    const map = new Map<string, ScheduleTimeOffBlock[]>()
    for (const block of timeOffBlocks) {
      for (const d of days) {
        if (timeOffCoversDate(block, d)) {
          const key = d.toISOString()
          const arr = map.get(key) ?? []
          arr.push(block)
          map.set(key, arr)
        }
      }
    }
    return map
  }, [timeOffBlocks, days])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_at) continue
      const due = new Date(t.due_at)
      for (const d of days) {
        if (isSameDay(due, d)) {
          const key = d.toISOString()
          const arr = map.get(key) ?? []
          arr.push(t)
          map.set(key, arr)
          break
        }
      }
    }
    return map
  }, [tasks, days])

  // Pointer sensor with a small activation distance so plain clicks
  // open the event detail instead of triggering a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const eventId = String(e.active.id)

    // Dropped over the "To Schedule" sidebar → pull it off the calendar.
    if (onUnschedule && pointerOverSidebar(e)) {
      onUnschedule(eventId)
      return
    }

    const wo = events.find((w) => w.id === eventId)
    if (!wo || !wo.scheduled_start_time) return

    const startMs = (e.active.data.current as { startMs?: number } | undefined)?.startMs
    const durationMs = (e.active.data.current as { durationMs?: number } | undefined)?.durationMs ?? 0
    const yDelta = e.delta.y
    if (!startMs) return

    const minuteDelta = Math.round(yDelta / slotPx) * SLOT_MINUTES
    let newStart = new Date(startMs + minuteDelta * 60000)

    const overDayKey = (e.over?.data?.current as { dayKey?: string } | undefined)?.dayKey
    if (overDayKey) {
      const overDay = new Date(overDayKey)
      const initialY = (e.active.data.current as { initialY?: number } | undefined)?.initialY ?? 0
      const newY = Math.max(0, Math.min((SLOTS_PER_DAY - 1) * slotPx, initialY + yDelta))
      newStart = yToTime(overDay, newY, slotPx)
    }

    const newEnd = new Date(newStart.getTime() + durationMs)
    onReschedule(wo.id, newStart.toISOString(), newEnd.toISOString())
  }

  // Native-DnD drop of an unscheduled sidebar job → schedule it at the day +
  // time-of-day under the cursor (1-hour default duration).
  function handleNativeDrop(id: string, day: Date, y: number) {
    const clampedY = Math.max(0, Math.min((SLOTS_PER_DAY - 1) * slotPx, y))
    const start = yToTime(day, clampedY, slotPx)
    const end = new Date(start.getTime() + 60 * 60000)
    onReschedule(id, start.toISOString(), end.toISOString())
  }

  return (
    <DndContext
      sensors={sensors}
      measuring={MEASURING}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <AutoScroller scrollRef={scrollRef} />
      <div className="relative h-full">
      {/* Drag a card left over the "To Schedule" sidebar to unschedule it —
          detected by pointerOverSidebar in handleDragEnd (no overlay). */}
      <div ref={scrollRef} className="flex h-full overflow-auto relative">
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
            onConvertToJob={
              contextMenu.wo.kind === 'estimate' && onConvertEstimate
                ? () => onConvertEstimate(contextMenu.wo.id)
                : undefined
            }
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

        {/* Time axis */}
        <div
          className="flex-shrink-0 border-r border-slate-200 bg-slate-50 text-[10px] text-slate-500 sticky left-0 z-10"
          style={{ width: 56 }}
        >
          <div className="h-10 border-b border-slate-200 bg-slate-50" />
          <div className="relative" style={{ height: dayPx }}>
            {labels.map((label, i) => (
              <div
                key={i}
                className="absolute right-2 -translate-y-1/2 text-right font-medium"
                style={{ top: i * slotPx * (60 / SLOT_MINUTES) }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7">
          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              day={d}
              events={eventsByDay.get(d.toISOString()) ?? []}
              tasks={tasksByDay.get(d.toISOString()) ?? []}
              timeOffBlocks={timeOffByDay.get(d.toISOString()) ?? []}
              onTaskRescheduleToDay={onTaskRescheduleToDay}
              onSelectEvent={onSelectEvent}
              colorFor={colorFor}
              textColorFor={textColorFor}
              isLate={isLate}
              onContextMenu={(wo, x, y) => setContextMenu({ wo, x, y })}
              onHoverStart={(wo, x, y) => setHoverPreview({ wo, x, y })}
              onHoverEnd={() => setHoverPreview(null)}
              onNativeDrop={handleNativeDrop}
              slotPx={slotPx}
              dayPx={dayPx}
              cardDensity={cardDensity}
            />
          ))}
        </div>
      </div>
      </div>

      {/* Floating drag ghost — portaled to <body>, so it isn't clipped by the
          calendar's overflow-auto when dragged left toward the sidebar. */}
      <DragOverlay dropAnimation={null}>
        {activeWo ? (
          <div
            style={{
              width: 180,
              background: matteStatusFill(colorFor(activeWo), activeWo.status?.color_secondary),
              color: matteStatusTextColor(),
              borderRadius: 4,
              border: `1px solid ${matteStatusBorder(colorFor(activeWo))}`,
              borderLeft: `4px solid ${statusAccentColor(colorFor(activeWo))}`,
              boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
            }}
            className="px-2 py-1 text-[12px] leading-tight"
          >
            <div className="font-semibold truncate">{activeWo.customer?.name ?? '—'}</div>
            <div className="text-[11px] opacity-90 truncate">
              {activeWo.scheduled_start_time
                ? new Date(activeWo.scheduled_start_time).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : ''}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * Auto-scrolls the calendar viewport while the user drags an event near
 * the top or bottom edge. Triggers a smooth scroll loop that runs while
 * the pointer is in the edge zone — same behavior Service Fusion uses.
 */
function AutoScroller({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<'up' | 'down' | null>(null)
  const pointerY = useRef(0)

  useDndMonitor({
    onDragMove: (event) => {
      const ratoY = (event.activatorEvent as PointerEvent).clientY
      pointerY.current = (event.delta.y || 0) + ratoY
      const el = scrollRef.current
      if (!el) {
        setActive(null)
        return
      }
      const rect = el.getBoundingClientRect()
      const EDGE = 60
      const fromTop = pointerY.current - rect.top
      const fromBottom = rect.bottom - pointerY.current
      if (fromTop < EDGE) setActive('up')
      else if (fromBottom < EDGE) setActive('down')
      else setActive(null)
    },
    onDragEnd: () => setActive(null),
    onDragCancel: () => setActive(null),
  })

  useEffect(() => {
    if (!active) return
    const el = scrollRef.current
    if (!el) return
    let frame: number
    const tick = () => {
      el.scrollBy({ top: active === 'up' ? -10 : 10 })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, scrollRef])

  return null
}

function DayColumn({
  day,
  events,
  tasks,
  timeOffBlocks,
  onTaskRescheduleToDay,
  onSelectEvent,
  colorFor,
  textColorFor,
  isLate,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  onNativeDrop,
  slotPx,
  dayPx,
  cardDensity,
}: {
  day: Date
  events: ScheduleWorkOrder[]
  tasks: Task[]
  timeOffBlocks: ScheduleTimeOffBlock[]
  onTaskRescheduleToDay?: (taskId: string, dayIso: string) => void
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  colorFor: (wo: ScheduleWorkOrder) => string
  textColorFor: (hex: string) => string
  isLate: (wo: ScheduleWorkOrder) => boolean
  onContextMenu: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverStart: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverEnd: () => void
  /** Native-DnD drop of an unscheduled sidebar job onto this column. y is the
   *  drop offset within the time grid (→ time-of-day). */
  onNativeDrop?: (id: string, day: Date, y: number) => void
  /** Zoom-scaled pixels per slot + total column height. */
  slotPx: number
  dayPx: number
  cardDensity: ScheduleCardDensity
}) {
  const dayKey = day.toISOString()
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayKey}`,
    data: { dayKey },
  })
  const gridElRef = useRef<HTMLDivElement | null>(null)
  const isToday = isSameDay(day, new Date())
  const layouts = useMemo(() => packTimedEvents(events), [events])
  const [nativeDropY, setNativeDropY] = useState<number | null>(null)

  return (
    <div className="border-r border-slate-200 flex flex-col">
      <div
        className={`h-10 border-b border-slate-200 flex flex-col items-center justify-center text-[11px] sticky top-0 z-10 ${
          isToday ? 'bg-amber-50 text-amber-800 font-semibold' : 'bg-slate-50 text-slate-600'
        }`}
      >
        <div className="uppercase tracking-wide">{format(day, 'EEE')}</div>
        <div className="text-[12px]">{format(day, 'MMM d')}</div>
      </div>
      {(tasks.length > 0 || timeOffBlocks.length > 0) && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-0.5 pt-0.5">
          <CalendarTaskChips tasks={tasks} />
          <TimeOffChips blocks={timeOffBlocks} />
        </div>
      )}
      <div
        ref={(el) => {
          setNodeRef(el)
          gridElRef.current = el
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('text/plain')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            const rect = gridElRef.current?.getBoundingClientRect()
            if (rect) setNativeDropY(Math.max(0, Math.min(dayPx, e.clientY - rect.top)))
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setNativeDropY(null)
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text/plain')
          if (!id) return
          setNativeDropY(null)
          e.preventDefault()
          e.stopPropagation()
          if (id.startsWith('task:')) {
            onTaskRescheduleToDay?.(id.slice(5), day.toISOString())
            return
          }
          const rect = gridElRef.current?.getBoundingClientRect()
          onNativeDrop?.(id, day, rect ? e.clientY - rect.top : 0)
        }}
        className={`relative flex-1 ${isOver ? 'bg-amber-50/40' : ''}`}
        style={{ height: dayPx }}
      >
        {isToday && <CurrentTimeLine top={timeToY(new Date(), slotPx)} />}
        {nativeDropY !== null && (
          <DropTargetLabel top={nativeDropY} label={`Drop here: ${format(yToTime(day, nativeDropY, slotPx), 'MMM d, h:mm a')}`} />
        )}

        {/* Hour grid lines */}
        {Array.from({ length: (SLOTS_PER_DAY * SLOT_MINUTES) / 60 }).map((_, h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ top: h * (60 / SLOT_MINUTES) * slotPx }}
          />
        ))}
        {/* Half-hour ticks — fainter */}
        {Array.from({ length: SLOTS_PER_DAY / 2 }).map((_, i) => (
          <div
            key={`half-${i}`}
            className="absolute left-0 right-0 border-t border-dashed border-slate-100/60"
            style={{ top: (i * 2 + 1) * slotPx }}
          />
        ))}

        {/* Events */}
        {events.map((wo) => (
          <DraggableEvent
            key={wo.id}
            wo={wo}
            onSelectEvent={onSelectEvent}
            color={colorFor(wo)}
            textColor={textColorFor(colorFor(wo))}
            late={isLate(wo)}
            layout={layouts.get(wo.id)}
            onContextMenu={onContextMenu}
            onHoverStart={onHoverStart}
            onHoverEnd={onHoverEnd}
            slotPx={slotPx}
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
    <div className="space-y-0.5 pb-0.5">
      {blocks.slice(0, 3).map((block) => (
        <div
          key={block.id}
          className="truncate rounded border border-sky-200 bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800"
          title={`${block.account_name ?? 'Staff member'} · ${humanizeTimeOffType(block.type)} · ${formatTimeOffRange(block)}`}
        >
          Off: {block.account_name ?? 'Staff'}{isHourlyTimeOff(block) && block.start_time ? ' ' + formatHourLabel(block.start_time) : ''}
        </div>
      ))}
      {blocks.length > 3 && <div className="text-[10px] font-medium text-sky-700">+{blocks.length - 3} more off</div>}
    </div>
  )
}

function CurrentTimeLine({ top }: { top: number }) {
  return (
    <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top }}>
      <div className="border-t-2 border-red-500" />
      <span className="absolute -top-2 left-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
        Now
      </span>
    </div>
  )
}

function DropTargetLabel({ top, label }: { top: number; label: string }) {
  return (
    <div
      className="pointer-events-none absolute left-1 right-1 z-30 rounded-md border border-amber-400 bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 shadow"
      style={{ top: Math.max(2, top - 14) }}
    >
      {label}
    </div>
  )
}

function DraggableEvent({
  wo,
  onSelectEvent,
  color,
  textColor,
  late,
  layout,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  slotPx,
  cardDensity,
}: {
  wo: ScheduleWorkOrder
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  color: string
  textColor: string
  late: boolean
  layout?: PackedEventLayout
  onContextMenu: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverStart: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverEnd: () => void
  slotPx: number
  cardDensity: ScheduleCardDensity
}) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = new Date(wo.scheduled_start_time!)
  const end = wo.scheduled_end_time
    ? new Date(wo.scheduled_end_time)
    : new Date(start.getTime() + (wo.estimated_duration_minutes ?? 60) * 60000)
  const top = timeToY(start, slotPx)
  const height = durationToHeight(start, end, slotPx)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: wo.id,
    data: {
      startMs: start.getTime(),
      durationMs: end.getTime() - start.getTime(),
      initialY: top,
    },
  })

  const customer = wo.customer?.name ?? '—'
  const tech = wo.lead_tech?.name?.split(' ')[0] ?? ''
  // Tech is physically on site right now (On Site status or open visit) →
  // breathe a green↔amber ring. Authoritative server flag; on_site_at is the
  // sticky first-arrival stamp (set for any in_progress status), not "now".
  // Left-site (open visit, tech gone) takes visual priority over the green
  // on-site pulse — show the rose "checkout needed" flag instead.
  const leftSite = wo.field_visit?.state === 'left_site_checkout_needed'
  const onSite = !leftSite && !!wo.on_site
  const timeLabel = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const densityClass = cardDensity === 'compact' ? 'px-1 py-0.5 text-[11px]' : cardDensity === 'detailed' ? 'px-2 py-1.5 text-[12px]' : 'px-1.5 py-1 text-[12px]'
  const showLocation = cardDensity !== 'compact' && wo.service_location?.nickname && height >= slotPx * 3
  const showStatus = cardDensity === 'detailed' && wo.status?.name && height >= slotPx * 4
  const showJobType = cardDensity !== 'compact' && wo.job_type?.name && height >= slotPx * 4
  const accentColor = statusAccentColor(color)
  const borderColor = matteStatusBorder(color)
  const background = matteStatusFill(color, wo.status?.color_secondary)
  const readableText = textColor === '#ffffff' ? matteStatusTextColor() : textColor
  const lane = layout?.lane ?? 0
  const laneCount = layout?.laneCount ?? 1
  const gap = 4
  const laneWidth = `calc((100% - ${gap * (laneCount - 1)}px) / ${laneCount})`
  const laneLeft = `calc(${lane} * ((100% - ${gap * (laneCount - 1)}px) / ${laneCount} + ${gap}px))`

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // PointerSensor's 5px threshold prevents drag from firing on a
        // simple click — but @dnd-kit fires both events anyway. Use
        // transform to detect "was this a drag, not a click".
        if (!transform || (Math.abs(transform.x) < 4 && Math.abs(transform.y) < 4)) {
          e.stopPropagation()
          onSelectEvent?.(wo)
        }
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
        position: 'absolute',
        top,
        left: laneLeft,
        width: laneWidth,
        height,
        background,
        color: readableText,
        borderRadius: 4,
        border: late
          ? '2px solid #dc2626'
          : wo.kind === 'estimate'
            ? `2px dashed ${borderColor}`
            : `1px solid ${borderColor}`,
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: isDragging
          ? '0 14px 30px rgba(15, 23, 42, 0.24)'
          : late
            ? '0 0 0 2px #fecaca'
            : undefined,
        opacity: 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
        zIndex: isDragging ? 50 : 1,
        userSelect: 'none',
        touchAction: 'none',
      }}
      className={`${densityClass} leading-tight overflow-hidden ${leftSite ? 'leftsite-flag' : onSite ? 'onsite-pulse' : ''}`}
    >
      <div className="font-semibold truncate flex items-center gap-1">
        {wo.kind === 'estimate' && (
          <span
            className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.85)', color: '#0f172a' }}
            title="Estimate — walkthrough visit"
          >
            EST
          </span>
        )}
        <span className="truncate">{customer}</span>
      </div>
      <div className="text-[11px] opacity-90 truncate">
        {timeLabel}{tech ? ` · ${tech}` : ''}
      </div>
      {showLocation && (
        <div className="text-[10px] opacity-75 truncate">📍 {wo.service_location?.nickname}</div>
      )}
      {showStatus && <div className="text-[10px] opacity-75 truncate">{wo.status?.name}</div>}
      {showJobType && (
        <div className="text-[10px] opacity-75 truncate flex items-center gap-1">
          {wo.job_type?.icon && <StatusIcon name={wo.job_type.icon} size={11} className="shrink-0" />}
          <span className="truncate">{wo.job_type?.name}</span>
        </div>
      )}
      {/* Flag badges are intentionally NOT shown on the card — the cards are
          too small and clip them. They surface in the hover preview instead. */}
    </div>
  )
}
