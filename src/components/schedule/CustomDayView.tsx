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
  yToTime,
} from './calendarUtils'
import { EventContextMenu } from './EventContextMenu'
import { EventHoverPreview } from './EventHoverPreview'
import { CalendarTaskChips } from './CalendarTaskChips'
import type { Task } from '@/lib/tasks'

const UNASSIGNED_RESOURCE_ID = '__unassigned__'

/**
 * Day view with tech swim-lanes. One column per tech, plus an "Unassigned"
 * column. Drop into a different lane reassigns lead_tech_account_id.
 *
 * Resource columns derive from unique techs in the visible event set —
 * adding a new tech to a job makes a column appear automatically on the
 * next refetch.
 */
export interface CustomDayViewProps {
  date: Date
  events: ScheduleWorkOrder[]
  /** Due-dated tasks to plot in their assignee's lane (by due_at day). */
  tasks?: Task[]
  /** Approved staff time-off blocks to show as read-only lane markers. */
  timeOffBlocks?: ScheduleTimeOffBlock[]
  /** Drag a task onto a tech lane → reassign it to that tech (null = unassign). */
  onTaskReassign?: (taskId: string, accountId: string | null) => void
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  onReschedule: (
    id: string,
    startIso: string,
    endIso: string,
    leadTechAccountId?: string | null,
  ) => void
  colorFor: (wo: ScheduleWorkOrder) => string
  textColorFor: (hex: string) => string
  isLate: (wo: ScheduleWorkOrder) => boolean
  onChangeStatus?: (id: string, statusId: string) => void
  onReassign?: (id: string, techAccountId: string | null) => void
  onChangeTime?: (id: string, startIso: string, endIso: string) => void
  /** Drag a card onto the unschedule strip → remove from the calendar. */
  onUnschedule?: (id: string) => void
  /** Sidebar overlay element to portal the unschedule drop target into. */
  unscheduleDropContainer?: HTMLElement | null
  /** Time-grid zoom (1 = 100%). Scales the pixel height of every slot. */
  zoom?: number
  /** Card density: compact for busy boards, detailed for smaller schedules. */
  cardDensity?: ScheduleCardDensity
}
export function CustomDayView({
  date,
  events,
  tasks = [],
  timeOffBlocks = [],
  onTaskReassign,
  onSelectEvent,
  onReschedule,
  colorFor,
  textColorFor,
  isLate,
  onChangeStatus,
  onReassign,
  onChangeTime,
  onUnschedule,
  unscheduleDropContainer,
  zoom = 1,
  cardDensity = 'standard',
}: CustomDayViewProps) {
  const labels = useMemo(() => hourLabels(), [])
  const scrollRef = useRef<HTMLDivElement>(null)
  // All vertical geometry scales off slotPx; zoom just multiplies the base.
  const slotPx = SLOT_PX * zoom
  const dayPx = SLOTS_PER_DAY * slotPx
  const [contextMenu, setContextMenu] = useState<{ wo: ScheduleWorkOrder; x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{ wo: ScheduleWorkOrder; x: number; y: number } | null>(null)
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null)
  // Track the dragging event so we can render it in a body-portaled
  // DragOverlay — floats above the overflow-auto scroll container so the card
  // isn't clipped at the calendar's left edge while dragging to the sidebar.
  const [activeId, setActiveId] = useState<string | null>(null)

  // Is the drag pointer inside the "To Schedule" sidebar drop container?
  // Direct rect test — reliable where @dnd-kit collision is not.
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

  // Today's events only.
  const dayEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!e.scheduled_start_time) return false
        return isSameDay(new Date(e.scheduled_start_time), date)
      }),
    [events, date],
  )

  const activeWo = activeId ? dayEvents.find((e) => e.id === activeId) ?? null : null

  const dayTimeOffBlocks = useMemo(
    () => timeOffBlocks.filter((block) => timeOffCoversDate(block, date)),
    [timeOffBlocks, date],
  )

  // Tasks due today, grouped into the assignee's lane (or Unassigned).
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.due_at && isSameDay(new Date(t.due_at), date)),
    [tasks, date],
  )

  // Group by lead tech for swim-lane columns. Always include "Unassigned"
  // so dispatcher has a target column for drag-out reassignment.
  const resources = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>()
    for (const e of dayEvents) {
      const t = e.lead_tech
      if (t?.id) {
        map.set(t.id, { id: t.id, title: t.name || t.email || 'Tech' })
      } else {
        map.set(UNASSIGNED_RESOURCE_ID, { id: UNASSIGNED_RESOURCE_ID, title: 'Unassigned' })
      }
    }
    for (const block of dayTimeOffBlocks) {
      if (block.account_id && !map.has(block.account_id)) {
        map.set(block.account_id, { id: block.account_id, title: block.account_name || 'Staff' })
      }
    }
    // Make sure a task's assignee gets a lane even if they have no jobs today
    // (don't clobber an event-derived title).
    for (const t of dayTasks) {
      if (t.assignee_account_id) {
        if (!map.has(t.assignee_account_id)) {
          map.set(t.assignee_account_id, { id: t.assignee_account_id, title: t.assignee_name || 'Tech' })
        }
      } else {
        map.set(UNASSIGNED_RESOURCE_ID, { id: UNASSIGNED_RESOURCE_ID, title: 'Unassigned' })
      }
    }
    if (!map.has(UNASSIGNED_RESOURCE_ID)) {
      map.set(UNASSIGNED_RESOURCE_ID, { id: UNASSIGNED_RESOURCE_ID, title: 'Unassigned' })
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === UNASSIGNED_RESOURCE_ID) return 1
      if (b.id === UNASSIGNED_RESOURCE_ID) return -1
      return a.title.localeCompare(b.title)
    })
  }, [dayEvents, dayTasks, dayTimeOffBlocks])

  const timeOffByResource = useMemo(() => {
    const map = new Map<string, ScheduleTimeOffBlock[]>()
    for (const block of dayTimeOffBlocks) {
      if (!block.account_id) continue
      const arr = map.get(block.account_id) ?? []
      arr.push(block)
      map.set(block.account_id, arr)
    }
    return map
  }, [dayTimeOffBlocks])

  const eventsByResource = useMemo(() => {
    const map = new Map<string, ScheduleWorkOrder[]>()
    for (const e of dayEvents) {
      const key = e.lead_tech?.id ?? UNASSIGNED_RESOURCE_ID
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [dayEvents])

  const tasksByResource = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of dayTasks) {
      const key = t.assignee_account_id ?? UNASSIGNED_RESOURCE_ID
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [dayTasks])

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

    const wo = dayEvents.find((w) => w.id === eventId)
    if (!wo || !wo.scheduled_start_time) return

    const startMs = (e.active.data.current as { startMs?: number } | undefined)?.startMs
    const durationMs = (e.active.data.current as { durationMs?: number } | undefined)?.durationMs ?? 0
    const yDelta = e.delta.y
    if (!startMs) return

    const minuteDelta = Math.round(yDelta / slotPx) * SLOT_MINUTES
    let newStart = new Date(startMs + minuteDelta * 60000)

    const overResourceId = (e.over?.data?.current as { resourceId?: string } | undefined)?.resourceId
    let newTechId: string | null | undefined = undefined
    if (overResourceId) {
      // Compute new time from the day + the snapped Y.
      const initialY = (e.active.data.current as { initialY?: number } | undefined)?.initialY ?? 0
      const newY = Math.max(0, Math.min((SLOTS_PER_DAY - 1) * slotPx, initialY + yDelta))
      newStart = yToTime(date, newY, slotPx)
      // Tech reassignment if dropping into a different lane.
      const currentTechId = wo.lead_tech?.id ?? UNASSIGNED_RESOURCE_ID
      if (overResourceId !== currentTechId) {
        newTechId = overResourceId === UNASSIGNED_RESOURCE_ID ? null : overResourceId
      }
    }

    const newEnd = new Date(newStart.getTime() + durationMs)
    onReschedule(wo.id, newStart.toISOString(), newEnd.toISOString(), newTechId)
  }

  // Native-DnD drop of an unscheduled sidebar job → schedule at the cursor's
  // time on this date and assign the lane's tech.
  function handleNativeDrop(id: string, resourceId: string, y: number) {
    const clampedY = Math.max(0, Math.min((SLOTS_PER_DAY - 1) * slotPx, y))
    const start = yToTime(date, clampedY, slotPx)
    const end = new Date(start.getTime() + 60 * 60000)
    const techId = resourceId === UNASSIGNED_RESOURCE_ID ? null : resourceId
    onReschedule(id, start.toISOString(), end.toISOString(), techId)
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
      <DayAutoScroller scrollRef={scrollRef} />
      <ConflictMonitor eventsByResource={eventsByResource} date={date} onChange={setDragGhost} slotPx={slotPx} />
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
          <div className="h-14 border-b border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-semibold text-slate-700">
            {format(date, 'EEE MMM d')}
          </div>
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

        {/* Tech swim-lanes */}
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${resources.length}, minmax(180px, 1fr))` }}>
          {resources.map((r) => (
            <TechColumn
              key={r.id}
              resource={r}
              events={eventsByResource.get(r.id) ?? []}
              tasks={tasksByResource.get(r.id) ?? []}
              timeOffBlocks={timeOffByResource.get(r.id) ?? []}
              onTaskReassign={onTaskReassign}
              onSelectEvent={onSelectEvent}
              colorFor={colorFor}
              textColorFor={textColorFor}
              isLate={isLate}
              onContextMenu={(wo, x, y) => setContextMenu({ wo, x, y })}
              onHoverStart={(wo, x, y) => setHoverPreview({ wo, x, y })}
              onHoverEnd={() => setHoverPreview(null)}
              onNativeDrop={handleNativeDrop}
              ghost={dragGhost && dragGhost.resourceId === r.id ? dragGhost : null}
              slotPx={slotPx}
              dayPx={dayPx}
              date={date}
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

function DayAutoScroller({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<'up' | 'down' | null>(null)
  const pointerY = useRef(0)

  useDndMonitor({
    onDragMove: (event) => {
      const ratoY = (event.activatorEvent as PointerEvent).clientY
      pointerY.current = (event.delta.y || 0) + ratoY
      const el = scrollRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const EDGE = 60
      if (pointerY.current - rect.top < EDGE) setActive('up')
      else if (rect.bottom - pointerY.current < EDGE) setActive('down')
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

interface DragGhost {
  resourceId: string
  top: number
  height: number
  conflict: boolean
}

/**
 * Watches the live drag and reports where the dragged job would land in the
 * target tech lane + whether it overlaps an existing job. Rendered inside the
 * DndContext (uses useDndMonitor). Returns nothing visual itself.
 */
function ConflictMonitor({
  eventsByResource,
  date,
  onChange,
  slotPx,
}: {
  eventsByResource: Map<string, ScheduleWorkOrder[]>
  date: Date
  onChange: (g: DragGhost | null) => void
  slotPx: number
}) {
  useDndMonitor({
    onDragMove: (e) => {
      const resourceId = (e.over?.data?.current as { resourceId?: string } | undefined)?.resourceId
      if (!resourceId) {
        onChange(null)
        return
      }
      const d = e.active.data.current as
        | { initialY?: number; durationMs?: number; heightPx?: number }
        | undefined
      const top = Math.max(0, Math.min((SLOTS_PER_DAY - 1) * slotPx, (d?.initialY ?? 0) + e.delta.y))
      const durationMs = d?.durationMs ?? 60 * 60000
      const height = d?.heightPx ?? slotPx * 2
      const start = yToTime(date, top, slotPx).getTime()
      const end = start + durationMs
      const activeId = String(e.active.id)
      const lane = eventsByResource.get(resourceId) ?? []
      const conflict = lane.some((ev) => {
        if (ev.id === activeId || !ev.scheduled_start_time) return false
        const es = new Date(ev.scheduled_start_time).getTime()
        const ee = ev.scheduled_end_time
          ? new Date(ev.scheduled_end_time).getTime()
          : es + (ev.estimated_duration_minutes ?? 60) * 60000
        return start < ee && end > es
      })
      onChange({ resourceId, top, height, conflict })
    },
    onDragEnd: () => onChange(null),
    onDragCancel: () => onChange(null),
  })
  return null
}

/** First/last/total-scheduled-minutes for a tech column's events. */
function columnStats(
  events: ScheduleWorkOrder[],
): { firstMs: number; lastMs: number; totalMin: number } | null {
  let firstMs = Infinity
  let lastMs = -Infinity
  let totalMin = 0
  for (const e of events) {
    if (!e.scheduled_start_time) continue
    const s = new Date(e.scheduled_start_time).getTime()
    if (Number.isNaN(s)) continue
    const end = e.scheduled_end_time
      ? new Date(e.scheduled_end_time).getTime()
      : s + (e.estimated_duration_minutes ?? 60) * 60000
    firstMs = Math.min(firstMs, s)
    lastMs = Math.max(lastMs, end)
    totalMin += Math.max(0, (end - s) / 60000)
  }
  return Number.isFinite(firstMs) ? { firstMs, lastMs, totalMin } : null
}

/** Compact clock: "8a", "8:30a", "4:30p". */
function fmtClock(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(' AM', 'a')
    .replace(' PM', 'p')
    .replace(':00', '')
}

/** Total scheduled hours, e.g. "6.5h" / "8h". */
function fmtHours(totalMin: number): string {
  const h = totalMin / 60
  return (Number.isInteger(h) ? h.toFixed(0) : h.toFixed(1)) + 'h'
}

function TechColumn({
  resource,
  events,
  tasks,
  timeOffBlocks,
  onSelectEvent,
  colorFor,
  textColorFor,
  isLate,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  onNativeDrop,
  onTaskReassign,
  ghost,
  slotPx,
  dayPx,
  date,
  cardDensity,
}: {
  resource: { id: string; title: string }
  events: ScheduleWorkOrder[]
  tasks: Task[]
  timeOffBlocks: ScheduleTimeOffBlock[]
  onSelectEvent?: (wo: ScheduleWorkOrder) => void
  colorFor: (wo: ScheduleWorkOrder) => string
  textColorFor: (hex: string) => string
  isLate: (wo: ScheduleWorkOrder) => boolean
  onContextMenu: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverStart: (wo: ScheduleWorkOrder, x: number, y: number) => void
  onHoverEnd: () => void
  onTaskReassign?: (taskId: string, accountId: string | null) => void
  /** Native-DnD drop of an unscheduled sidebar job onto this tech lane. */
  onNativeDrop?: (id: string, resourceId: string, y: number) => void
  /** Live drag preview band for this lane (set only on the targeted lane). */
  ghost?: { top: number; height: number; conflict: boolean } | null
  /** Zoom-scaled pixels per slot + total column height. */
  slotPx: number
  dayPx: number
  date: Date
  cardDensity: ScheduleCardDensity
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tech-${resource.id}`,
    data: { resourceId: resource.id },
  })
  const gridElRef = useRef<HTMLDivElement | null>(null)
  const isUnassigned = resource.id === UNASSIGNED_RESOURCE_ID
  const layouts = useMemo(() => packTimedEvents(events), [events])
  const stats = useMemo(() => columnStats(events), [events])
  const [nativeDropY, setNativeDropY] = useState<number | null>(null)
  const routeAlerts = useMemo(() => buildRouteAlerts(events, slotPx), [events, slotPx])
  const allDayTimeOffBlocks = useMemo(() => timeOffBlocks.filter((block) => !isHourlyTimeOff(block)), [timeOffBlocks])
  const hourlyTimeOffBlocks = useMemo(() => timeOffBlocks.filter(isHourlyTimeOff), [timeOffBlocks])
  const isToday = isSameDay(date, new Date())

  return (
    <div className="border-r border-slate-200 flex flex-col">
      <div
        className={`h-14 border-b border-slate-200 px-2 py-1 flex flex-col justify-center sticky top-0 z-10 ${
          isUnassigned ? 'bg-slate-100 text-slate-500 italic' : 'bg-white text-slate-800'
        }`}
      >
        <div className="text-[12px] font-semibold truncate">{resource.title}</div>
        {timeOffBlocks.length > 0 && (
          <div className="text-[10px] font-semibold text-sky-700 not-italic truncate">Staff off</div>
        )}
        {stats ? (
          <>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-normal not-italic">
              <span>{events.length} job{events.length === 1 ? '' : 's'}</span>
              <span>{fmtHours(stats.totalMin)}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-normal not-italic truncate">
              {fmtClock(stats.firstMs)}–{fmtClock(stats.lastMs)}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-slate-400 font-normal not-italic">No jobs</div>
        )}
      </div>
      {tasks.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-0.5 pt-0.5">
          <CalendarTaskChips tasks={tasks} />
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
            onTaskReassign?.(id.slice(5), resource.id === UNASSIGNED_RESOURCE_ID ? null : resource.id)
            return
          }
          const rect = gridElRef.current?.getBoundingClientRect()
          onNativeDrop?.(id, resource.id, rect ? e.clientY - rect.top : 0)
        }}
        className={`relative flex-1 transition-colors ${isOver || nativeDropY !== null ? 'bg-amber-50/50 ring-2 ring-inset ring-amber-300' : ''} ${isUnassigned ? 'bg-slate-50/50' : ''}`}
        style={{ height: dayPx }}
      >
        {isToday && <CurrentTimeLine top={timeToY(new Date(), slotPx)} />}
        {nativeDropY !== null && (
          <DropTargetLabel top={nativeDropY} label={`Drop here: ${format(yToTime(date, nativeDropY, slotPx), 'h:mm a')}`} />
        )}
        {allDayTimeOffBlocks.map((block, index) => (
          <div
            key={block.id}
            className="pointer-events-none absolute left-1 right-1 z-[2] rounded-md border border-sky-300 bg-sky-100/80 px-2 py-1 text-[10px] font-semibold text-sky-900 shadow-sm"
            style={{ top: 4 + index * 34 }}
          >
            <div className="truncate">Staff off · {humanizeTimeOffType(block.type)}</div>
            <div className="truncate text-[9px] font-medium text-sky-700">{formatTimeOffRange(block)}</div>
          </div>
        ))}

        {hourlyTimeOffBlocks.map((block) => {
          const layout = timeOffLayout(block, date, slotPx)
          if (!layout) return null
          return (
            <div
              key={block.id}
              className="pointer-events-none absolute left-1 right-1 z-[3] rounded-md border border-sky-400 bg-sky-100/90 px-2 py-1 text-[10px] font-semibold text-sky-900 shadow-sm"
              style={{ top: layout.top, height: layout.height }}
              title={`${block.account_name ?? 'Staff member'} · ${humanizeTimeOffType(block.type)} · ${formatTimeOffRange(block)}`}
            >
              <div className="truncate">Staff off · {humanizeTimeOffType(block.type)}</div>
              <div className="truncate text-[9px] font-medium text-sky-700">{formatTimeOffRange(block)}</div>
            </div>
          )
        })}
        {routeAlerts.map((alert) => (
          <div
            key={alert.key}
            className="pointer-events-none absolute left-2 right-2 z-10 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 shadow-sm"
            style={{ top: alert.top }}
          >
            Travel: ~{alert.miles} mi / {alert.gapMin} min gap
          </div>
        ))}

        {/* Live conflict overlay — where the dragged job would land in this
            lane: red if it overlaps an existing job, green if the slot's open. */}
        {ghost && (
          <div
            className={`pointer-events-none absolute left-0 right-0 rounded border-2 ${
              ghost.conflict ? 'border-red-500 bg-red-500/25' : 'border-emerald-500 bg-emerald-500/20'
            }`}
            style={{ top: ghost.top, height: ghost.height, zIndex: 20 }}
          >
            <div className={`px-1 text-[10px] font-bold ${ghost.conflict ? 'text-red-700' : 'text-emerald-700'}`}>
              {ghost.conflict ? '⚠ Conflict' : '✓ Open'}
            </div>
          </div>
        )}
        {Array.from({ length: (SLOTS_PER_DAY * SLOT_MINUTES) / 60 }).map((_, h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ top: h * (60 / SLOT_MINUTES) * slotPx }}
          />
        ))}

        {events.map((wo) => (
          <DraggableDayEvent
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

function timeOffLayout(block: ScheduleTimeOffBlock, date: Date, slotPx: number): { top: number; height: number } | null {
  if (!isHourlyTimeOff(block)) return null
  const day = format(date, 'yyyy-MM-dd')
  if (block.start_date !== day) return null
  const startMinutes = timeOffMinutes(block.start_time)
  const endMinutes = timeOffMinutes(block.end_time)
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return null
  return {
    top: (startMinutes / SLOT_MINUTES) * slotPx,
    height: Math.max(slotPx, ((endMinutes - startMinutes) / SLOT_MINUTES) * slotPx),
  }
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

function buildRouteAlerts(events: ScheduleWorkOrder[], slotPx: number): Array<{ key: string; top: number; miles: number; gapMin: number }> {
  const sorted = events
    .filter((wo) => wo.scheduled_start_time)
    .sort((a, b) => new Date(a.scheduled_start_time!).getTime() - new Date(b.scheduled_start_time!).getTime())
  const out: Array<{ key: string; top: number; miles: number; gapMin: number }> = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]
    const a = coordsFor(current)
    const b = coordsFor(next)
    if (!a || !b || !current.scheduled_start_time || !next.scheduled_start_time) continue
    const currentEnd = current.scheduled_end_time
      ? new Date(current.scheduled_end_time)
      : new Date(new Date(current.scheduled_start_time).getTime() + (current.estimated_duration_minutes ?? 60) * 60000)
    const nextStart = new Date(next.scheduled_start_time)
    const gapMin = Math.round((nextStart.getTime() - currentEnd.getTime()) / 60000)
    if (gapMin <= 0) continue
    const miles = distanceMiles(a, b)
    const driveMin = Math.ceil(miles * 2.2)
    if (driveMin > gapMin) out.push({ key: `${current.id}-${next.id}`, top: timeToY(currentEnd, slotPx) + 2, miles: Math.round(miles), gapMin })
  }
  return out
}

function coordsFor(wo: ScheduleWorkOrder): { lat: number; lng: number } | null {
  const lat = wo.service_location?.latitude
  const lng = wo.service_location?.longitude
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
}

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (n: number) => (n * Math.PI) / 180
  const earthMiles = 3958.8
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return earthMiles * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function DraggableDayEvent({
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
      heightPx: height,
    },
  })

  const customer = wo.customer?.name ?? '—'
  // Tech is physically on site right now (On Site status or open visit) →
  // breathe a green↔amber ring. Authoritative server flag; on_site_at is the
  // sticky first-arrival stamp (set for any in_progress status), not "now".
  // Left-site (open visit, tech gone) takes visual priority over the green
  // on-site pulse — show the rose "checkout needed" flag instead.
  const leftSite = wo.field_visit?.state === 'left_site_checkout_needed'
  const onSite = !leftSite && !!wo.on_site
  const timeLabel = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const densityClass = cardDensity === 'compact' ? 'px-1 py-0.5 text-[11px]' : cardDensity === 'detailed' ? 'px-2 py-1.5 text-[12px]' : 'px-2 py-1.5 text-[12px]'
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
        border: late ? '2px solid #dc2626' : `1px solid ${borderColor}`,
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
      <div className="font-semibold truncate">{customer}</div>
      <div className="text-[11px] opacity-90">{timeLabel}</div>
      {showLocation && (
        <div className="text-[10px] opacity-75 truncate">📍 {wo.service_location?.nickname}</div>
      )}
      {showStatus && <div className="text-[10px] opacity-75 truncate mt-0.5">{wo.status?.name}</div>}
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
