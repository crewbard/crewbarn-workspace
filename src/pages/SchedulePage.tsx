import { useMemo, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar'
import { CustomWeekView } from '@/components/schedule/CustomWeekView'
import { CustomDayView } from '@/components/schedule/CustomDayView'
import { CustomMonthView } from '@/components/schedule/CustomMonthView'
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '@/components/schedule/calendarUtils'
import { EventBadges, BadgeLegend } from '@/components/schedule/EventBadges'
import { Avatar } from '@/components/Avatar'
import { Modal } from '@/components/ui/Modal'
import { MobileScheduleAgenda } from '@/components/schedule/MobileScheduleAgenda'
import { JobLocationMap } from '@/components/schedule/JobLocationMap'
import dndAddon, { type withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop'

// Handle CJS/ESM interop — Vite sometimes wraps default exports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withDragAndDrop: any = (dndAddon as any).default ?? dndAddon
import { format, parse, startOfWeek, getDay, addDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { listTasks, updateTask } from '@/lib/tasks'
import { captureStatusGeo } from '@/lib/statusGeo'
import {
  useCalendarEvents,
  useRescheduleWorkOrder,
  useUnscheduledJobs,
  useUpdateWorkOrderFromCalendar,
} from '@/hooks/useSchedule'
import { useJobStatuses, useUpdateJobStatus } from '@/hooks/useJobStatuses'
import { tenantCalendarDate, useTenantTimezone } from '@/hooks/useTenantTime'
import { useEstimates, useEstimate } from '@/hooks/useEstimates'
import { ConvertEstimateToJobModal } from '@/components/ConvertEstimateToJobModal'
import type { ScheduleCardDensity, ScheduleTimeOffBlock, ScheduleWorkOrder } from '@/types/schedule'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { matteStatusBorder, matteStatusFill, matteStatusTextColor, statusAccentColor, toHexColor, textColorOn, visibleStatusColor } from '@/lib/statusColor'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(Calendar as never)

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: ScheduleWorkOrder
  /** Tech id (or 'unassigned') — used by react-big-calendar resource view. */
  resourceId: string
}

type ApprovedTimeOffBlock = ScheduleTimeOffBlock

const UNASSIGNED_RESOURCE_ID = '__unassigned__'

/**
 * Active states — a WO in any of these is "in progress" and should NOT
 * light up red even if scheduled_start_time has passed.
 */
const ACTIVE_STATUS_NAMES = [
  'on the way',
  'on site',
  'in progress',
  'dispatched',
  'completed',
  'job closed',
  'paid in full',
  'invoiced',
  'to be invoiced',
  'cancelled',
]

function isLate(wo: ScheduleWorkOrder): boolean {
  if (!wo.scheduled_start_time) return false
  if (wo.completed_at) return false
  const start = new Date(wo.scheduled_start_time)
  if (start > new Date()) return false
  const statusName = (wo.status?.name || '').toLowerCase()
  if (ACTIVE_STATUS_NAMES.includes(statusName)) return false
  return true
}

const VIEW_STORAGE_KEY = 'crewbarn:schedule:view'

function loadSavedView(): View {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY)
    if (saved === Views.MONTH || saved === Views.WEEK || saved === Views.DAY) {
      return saved as View
    }
  } catch {
    // localStorage may be blocked (incognito etc.) — fall through
  }
  return Views.WEEK
}

const ZOOM_STORAGE_KEY = 'crewbarn:schedule:zoom'

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z / ZOOM_STEP) * ZOOM_STEP))
}

function loadSavedZoom(): number {
  try {
    const saved = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY) ?? '')
    if (Number.isFinite(saved)) return clampZoom(saved)
  } catch {
    // localStorage blocked — fall through
  }
  return 1
}

const DENSITY_STORAGE_KEY = 'crewbarn:schedule:card-density'

function loadSavedCardDensity(): ScheduleCardDensity {
  try {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY)
    if (saved === 'compact' || saved === 'standard' || saved === 'detailed') return saved
  } catch {
    // localStorage blocked — fall through
  }
  return 'standard'
}

export function SchedulePage() {
  const tenantTimezone = useTenantTimezone()
  const [view, setViewState] = useState<View>(loadSavedView)
  const [date, setDate] = useState(() => tenantCalendarDate(tenantTimezone))

  useEffect(() => {
    setDate(tenantCalendarDate(tenantTimezone))
  }, [tenantTimezone])

  // Persist view choice — next time the page loads it'll open here.
  const setView = (next: View) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // ignore — non-fatal
    }
  }

  // Time-grid zoom (Day/Week). 1 = 100% = the original pixel density.
  const [zoom, setZoomState] = useState<number>(loadSavedZoom)
  const setZoom = (next: number) => {
    const z = clampZoom(next)
    setZoomState(z)
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(z))
    } catch {
      // ignore — non-fatal
    }
  }
  // Functional form so keyboard shortcuts (mounted once) never read a stale zoom.
  const zoomBy = (delta: number) =>
    setZoomState((z) => {
      const next = clampZoom(z + delta)
      try {
        localStorage.setItem(ZOOM_STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  const [techFilter, setTechFilter] = useState('')
  const [crewFilter, setCrewFilter] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [hiddenStatusIds, setHiddenStatusIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<ScheduleWorkOrder | null>(null)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [unschedGroupBy, setUnschedGroupBy] = useState<UnschedGroupBy>('none')
  const [unschedFilter, setUnschedFilter] = useState<UnschedFilter>('all')
  const [unschedSort, setUnschedSort] = useState<UnschedSort>('priority')
  const [cardDensity, setCardDensityState] = useState<ScheduleCardDensity>(loadSavedCardDensity)
  const setCardDensity = (next: ScheduleCardDensity) => {
    setCardDensityState(next)
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next)
    } catch {
      // ignore — non-fatal
    }
  }
  // The "To Schedule" sidebar doubles as a drop target: drag a calendar event
  // onto it to unschedule. The custom views portal their @dnd-kit droppable
  // into this overlay element (so it lives in the view's DndContext but sits
  // physically over the sidebar).
  const [sidebarDropEl, setSidebarDropEl] = useState<HTMLElement | null>(null)
  // Mobile: the "To Schedule" sidebar is hidden by default (drag-drop
  // scheduling is a desktop flow); a toolbar button slides it in as an
  // overlay so the unscheduled-jobs list is still reachable on a phone.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [convertingEstimateId, setConvertingEstimateId] = useState<string | null>(null)
  const convertingEstimateQuery = useEstimate(convertingEstimateId ?? undefined)

  // Compute the date window we need to fetch based on current view + date
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === Views.MONTH) {
      return {
        rangeStart: addDays(startOfMonth(date), -7),
        rangeEnd: addDays(endOfMonth(date), 7),
      }
    }
    if (view === Views.WEEK) {
      const ws = startOfWeek(date, { weekStartsOn: 1 })
      return { rangeStart: ws, rangeEnd: addDays(ws, 7) }
    }
    return { rangeStart: startOfDay(date), rangeEnd: endOfDay(date) }
  }, [view, date])

  const eventsQuery = useCalendarEvents({
    start: format(rangeStart, 'yyyy-MM-dd'),
    end: format(rangeEnd, 'yyyy-MM-dd'),
    tech_id: techFilter || undefined,
    crew_id: crewFilter || undefined,
    customer_q: customerQuery || undefined,
  })
  const approvedTimeOffQuery = useQuery({
    queryKey: ['time-off', 'schedule-approved', format(rangeStart, 'yyyy-MM-dd'), format(rangeEnd, 'yyyy-MM-dd')],
    queryFn: () =>
      apiRequest<{ data: ApprovedTimeOffBlock[] }>(
        `/v1/time-off-requests?status=approved&from=${format(rangeStart, 'yyyy-MM-dd')}&to=${format(rangeEnd, 'yyyy-MM-dd')}`,
      ).catch(() => ({ data: [] })),
    staleTime: 60_000,
  })
  const statusesQuery = useJobStatuses()
  const reschedule = useRescheduleWorkOrder()
  const updateWO = useUpdateWorkOrderFromCalendar()

  // Due-dated tasks for the same visible window — plotted as read-only
  // deadline chips on the Month/Week views (backend scopes to what's visible).
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'calendar', format(rangeStart, 'yyyy-MM-dd'), format(rangeEnd, 'yyyy-MM-dd')],
    queryFn: () =>
      listTasks({
        // 'all' so a completed task stays on its due day (struck through) — the
        // calendar is the record; it doesn't vanish when checked off.
        view: 'all',
        due_from: format(rangeStart, 'yyyy-MM-dd'),
        due_to: format(rangeEnd, 'yyyy-MM-dd'),
      }),
    // Poll so a task added elsewhere (CBI, another device, the tasks page)
    // lands on the calendar without a manual refresh — tasks have no realtime
    // broadcast of their own, unlike jobs.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  })
  const calendarTasks = tasksQuery.data ?? []

  // Drag a task card to another day (Month/Week) → move its due date there,
  // keeping its time-of-day. Drag to a tech lane (Day) → reassign.
  const taskQc = useQueryClient()
  const taskUpdate = useMutation({
    mutationFn: (vars: { id: string; patch: { due_at?: string; assignee_account_id?: string | null } }) =>
      updateTask(vars.id, vars.patch),
    onSuccess: () => taskQc.invalidateQueries({ queryKey: ['tasks'] }),
  })
  const onTaskRescheduleToDay = (taskId: string, dayIso: string) => {
    const t = calendarTasks.find((x) => x.id === taskId)
    const day = new Date(dayIso)
    const old = t?.due_at ? new Date(t.due_at) : day
    day.setHours(old.getHours(), old.getMinutes(), 0, 0)
    taskUpdate.mutate({ id: taskId, patch: { due_at: day.toISOString() } })
  }
  const onTaskReassign = (taskId: string, accountId: string | null) => {
    taskUpdate.mutate({ id: taskId, patch: { assignee_account_id: accountId } })
  }

  // Undo stack — every reschedule pushes the BEFORE state here.
  // Ctrl+Z pops the most recent and re-applies the prior position.
  // We only ever read it via the setter's functional form, so the
  // current value isn't bound to a local name.
  const [, setUndoStack] = useState<
    Array<{ id: string; prevStart: string; prevEnd: string; kind: 'job' | 'estimate' }>
  >([])

  function pushUndo(id: string, prevStart: string | null, prevEnd: string | null, kind: 'job' | 'estimate' = 'job') {
    if (!prevStart || !prevEnd) return
    setUndoStack((s) => [...s.slice(-19), { id, prevStart, prevEnd, kind }])
  }

  /** Look up the event's kind so PATCH routes to the right endpoint. */
  function kindOf(id: string): 'job' | 'estimate' {
    return eventsQuery.data?.data.find((w) => w.id === id)?.kind ?? 'job'
  }

  function popUndo() {
    setUndoStack((s) => {
      const last = s[s.length - 1]
      if (!last) return s
      reschedule.mutate({ id: last.id, start: last.prevStart, end: last.prevEnd, kind: last.kind })
      return s.slice(0, -1)
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        popUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const updateStatus = useUpdateJobStatus()
  const unscheduledQuery = useUnscheduledJobs(sidebarSearch)
  const rawUnscheduled = unscheduledQuery.data?.data ?? []
  const visibleUnscheduled = useMemo(
    () => sortUnscheduled(rawUnscheduled.filter((w) => unscheduledMatchesFilter(w, unschedFilter)), unschedSort),
    [rawUnscheduled, unschedFilter, unschedSort],
  )
  const visibleTimeOffBlocks = useMemo(() => {
    return [...(approvedTimeOffQuery.data?.data ?? [])].sort((a, b) => {
      const aDate = a.start_date ?? ''
      const bDate = b.start_date ?? ''
      if (aDate !== bDate) return aDate.localeCompare(bDate)
      return (a.account_name ?? '').localeCompare(b.account_name ?? '')
    })
  }, [approvedTimeOffQuery.data])

  const events: CalendarEvent[] = useMemo(() => {
    const rows = eventsQuery.data?.data ?? []
    return rows
      .filter((w) => !w.status?.id || !hiddenStatusIds.has(w.status.id))
      .filter((w) => !!w.scheduled_start_time)
      .map((w) => {
        const start = new Date(w.scheduled_start_time!)
        const end = w.scheduled_end_time
          ? new Date(w.scheduled_end_time)
          : new Date(start.getTime() + (w.estimated_duration_minutes ?? 60) * 60000)
        const customer = w.customer?.name ?? '—'
        const techShort = w.lead_tech?.name?.split(' ')[0] ?? ''
        const title = `${customer}${techShort ? ` · ${techShort}` : ''}`
        return {
          id: w.id,
          title,
          start,
          end,
          resource: w,
          resourceId: w.lead_tech?.id ?? UNASSIGNED_RESOURCE_ID,
        }
      })
  }, [eventsQuery.data, hiddenStatusIds])

  /**
   * Day-view tech swim lanes: one column per tech who has a scheduled
   * job in the current window. Plus an "Unassigned" column for jobs
   * without a lead tech. Derived from the events list so the column
   * set updates live as jobs are added / reassigned.
   */
  const resources = useMemo(() => {
    if (view !== Views.DAY) return undefined
    const map = new Map<string, { id: string; title: string }>()
    for (const e of events) {
      if (e.resourceId === UNASSIGNED_RESOURCE_ID) {
        map.set(UNASSIGNED_RESOURCE_ID, { id: UNASSIGNED_RESOURCE_ID, title: 'Unassigned' })
      } else if (e.resource.lead_tech?.id) {
        map.set(e.resource.lead_tech.id, {
          id: e.resource.lead_tech.id,
          title: e.resource.lead_tech.name || e.resource.lead_tech.email || 'Tech',
        })
      }
    }
    // Always include "Unassigned" in day view if it's not already in the map —
    // so dispatcher sees an empty column to drag jobs into.
    if (!map.has(UNASSIGNED_RESOURCE_ID)) {
      map.set(UNASSIGNED_RESOURCE_ID, { id: UNASSIGNED_RESOURCE_ID, title: 'Unassigned' })
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === UNASSIGNED_RESOURCE_ID) return 1
      if (b.id === UNASSIGNED_RESOURCE_ID) return -1
      return a.title.localeCompare(b.title)
    })
  }, [view, events])

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const wo = event.resource
    const late = isLate(wo)
    // The status color is now an accent rail/border. The card body stays matte
    // so busy calendars are easier to scan and dragged cards stay readable.
    const primaryHex = visibleStatusColor(wo.status?.color)
    const bg = matteStatusFill(primaryHex, wo.status?.color_secondary)
    const accentColor = statusAccentColor(primaryHex)
    const borderColor = matteStatusBorder(primaryHex)
    const crewColor = wo.crew?.color ? toHexColor(wo.crew.color) : null
    return {
      style: {
        background: bg,
        borderRadius: '4px',
        color: matteStatusTextColor(),
        border: late ? '2px solid #dc2626' : `1px solid ${borderColor}`,
        boxShadow: late
          ? '0 0 0 2px #fecaca'
          : crewColor
          ? `inset 4px 0 0 0 ${crewColor}`
          : `inset 4px 0 0 0 ${accentColor}`,
        fontWeight: 500,
      },
    }
  }, [])

  /**
   * Detect overlapping jobs on the target tech for the proposed time
   * window. Returns the conflicting events (excluding the event being
   * moved) so the caller can confirm with the user.
   */
  const findConflicts = useCallback(
    (eventId: string, targetTechId: string | null, start: Date, end: Date) => {
      if (!targetTechId || targetTechId === UNASSIGNED_RESOURCE_ID) return []
      const startMs = start.getTime()
      const endMs = end.getTime()
      return events.filter((ev) => {
        if (ev.id === eventId) return false
        if (ev.resource.lead_tech?.id !== targetTechId) return false
        const evStart = ev.start.getTime()
        const evEnd = ev.end.getTime()
        // Overlap: start < other_end && end > other_start
        return startMs < evEnd && endMs > evStart
      })
    },
    [events],
  )

  const findTimeOffConflicts = useCallback(
    (targetTechId: string | null, start: Date, end: Date) => {
      if (!targetTechId || targetTechId === UNASSIGNED_RESOURCE_ID) return []
      const startMs = start.getTime()
      const endMs = end.getTime()
      return (approvedTimeOffQuery.data?.data ?? []).filter((block) => {
        if (block.account_id !== targetTechId || !block.start_date || !block.end_date) return false
        const window = timeOffBlockWindow(block)
        if (!window) return false
        return startMs < window.end.getTime() && endMs > window.start.getTime()
      })
    },
    [approvedTimeOffQuery.data],
  )

  // Shared scheduling risk gate: overlaps plus practical dispatch warnings.
  const confirmScheduleRisks = useCallback(
    (
      eventId: string,
      targetTechId: string | null,
      start: Date,
      end: Date,
      moving?: ScheduleWorkOrder | null,
    ): boolean => {
      const conflicts = findConflicts(eventId, targetTechId, start, end)
      const timeOffConflicts = findTimeOffConflicts(targetTechId, start, end)
      const warnings: string[] = []
      const address = moving?.service_location?.formatted_address || moving?.service_location?.street_address
      if (!address) warnings.push('Missing service address')
      if (isOutsideWorkHours(start, end)) warnings.push('Outside normal work hours')
      const routeWarning = routeWarningForDrop(events, eventId, targetTechId, start, end, moving)
      if (routeWarning) warnings.push(routeWarning)

      if (conflicts.length === 0 && timeOffConflicts.length === 0 && warnings.length === 0) return true

      const lines: string[] = []
      if (timeOffConflicts.length > 0) {
        const name = timeOffConflicts[0].account_name ?? 'This tech'
        lines.push(`${name} has approved time off during this window:`)
        lines.push(
          ...timeOffConflicts.map(
            (block) => `  - ${humanizeTimeOffType(block.type)} (${formatTimeOffRange(block)})`,
          ),
        )
      }
      if (conflicts.length > 0) {
        if (lines.length > 0) lines.push('')
        const techName = conflicts[0].resource.lead_tech?.name ?? 'this tech'
        lines.push(`${techName} already has ${conflicts.length} overlapping job${conflicts.length === 1 ? '' : 's'}:`)
        lines.push(
          ...conflicts.map(
            (c) => `  - ${c.resource.customer?.name ?? '—'} @ ${c.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
          ),
        )
      }
      if (warnings.length > 0) {
        if (lines.length > 0) lines.push('')
        lines.push('Warnings:')
        lines.push(...warnings.map((w) => `  - ${w}`))
      }

      return window.confirm(`${lines.join('\n')}\n\nSchedule anyway?`)
    },
    [events, findConflicts, findTimeOffConflicts],
  )

  // The tenant's "Scheduled" status — applied when a job is dragged off the
  // To-Schedule queue onto the calendar.
  const scheduledStatusId = useMemo(() => {
    const list = statusesQuery.data?.data ?? []
    const found = list.find((s) => s.slug === 'scheduled' || /^scheduled$/i.test(s.name))
    return found?.id ?? null
  }, [statusesQuery.data])

  // When a job with no tech is scheduled off the queue, we pause and ask the
  // dispatcher to pick a tech (or keep it unassigned) via a small modal.
  const [pendingSchedule, setPendingSchedule] = useState<{
    id: string
    startIso: string
    endIso: string
  } | null>(null)

  // Tech roster for that modal. Same 'dispatch-board' key as the context menu,
  // so the cache is shared. Only fetched once the modal is needed.
  const techRosterQuery = useQuery({
    queryKey: ['dispatch-board'],
    queryFn: () =>
      apiRequest<{ data: { techs: Array<{ id: string; name: string }> } }>('/v1/dispatch/board'),
    staleTime: 60_000,
    enabled: !!pendingSchedule,
  })

  /**
   * Single scheduling path for ALL custom views (Month / Week / Day) and
   * sidebar drops. Codex flagged that the views bypassed conflict checks and
   * split reschedule+reassign into two mutations; this unifies them:
   *   - pushes undo (for on-calendar jobs)
   *   - conflict-checks against the target tech and confirms before overlap
   *   - fires ONE reschedule mutation, including leadTechAccountId when given
   *   - for an unscheduled sidebar job (not yet on the calendar) it ignores the
   *     view's placeholder end and uses estimated_duration_minutes (→ 60 fallback)
   *
   * leadTechAccountId semantics: undefined = leave tech unchanged,
   * null = unassign, string = assign that tech.
   */
  const scheduleEvent = useCallback(
    (
      id: string,
      startIso: string,
      endIso: string,
      leadTechAccountId?: string | null,
      opts?: { skipTechPrompt?: boolean },
    ) => {
      const scheduled = eventsQuery.data?.data.find((w) => w.id === id)
      const moving = scheduled ?? unscheduledQuery.data?.data.find((w) => w.id === id)
      const kind = moving?.kind ?? 'job'
      // Not on the calendar yet = being scheduled off the To-Schedule queue.
      const wasUnscheduled = !scheduled

      let start = new Date(startIso)
      let end = new Date(endIso)
      if (!scheduled) {
        // Sidebar drop of an unscheduled job → honor its estimated duration
        // instead of the view's hard-coded 60-minute placeholder.
        const durationMin = moving?.estimated_duration_minutes ?? 60
        end = new Date(start.getTime() + durationMin * 60000)
      }

      // Conflict scan against the resolved target tech (explicit reassign wins,
      // else the job's current lead tech).
      const targetTech =
        leadTechAccountId === undefined ? scheduled?.lead_tech?.id ?? null : leadTechAccountId

      // Scheduling a job off the queue with no tech → ask for one first.
      if (!opts?.skipTechPrompt && wasUnscheduled && kind === 'job' && !targetTech) {
        setPendingSchedule({ id, startIso: start.toISOString(), endIso: end.toISOString() })
        return
      }

      if (!confirmScheduleRisks(id, targetTech, start, end, moving)) return

      if (scheduled) pushUndo(id, scheduled.scheduled_start_time, scheduled.scheduled_end_time, kind)

      reschedule.mutate({
        id,
        start: start.toISOString(),
        end: end.toISOString(),
        leadTechAccountId,
        kind,
        // Flip a job to "Scheduled" when it lands on the calendar from the queue.
        statusId: wasUnscheduled && kind === 'job' ? scheduledStatusId : undefined,
      })
    },
    // pushUndo is a stable closure over setUndoStack; reschedule is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventsQuery.data, unscheduledQuery.data, confirmScheduleRisks, reschedule, scheduledStatusId],
  )

  // Drag-and-drop within the calendar reschedules the WO. Optimistic — the
  // server PATCH fires; on error TanStack Query will refetch and snap back.
  // In Day view, dropping onto a different tech's lane reassigns the lead
  // tech. Conflict-check warns before overwriting an overlap.
  const onEventDrop: NonNullable<withDragAndDropProps<CalendarEvent>['onEventDrop']> =
    useCallback((args) => {
      const start = args.start instanceof Date ? args.start : new Date(args.start)
      const end = args.end instanceof Date ? args.end : new Date(args.end)

      // resourceId arrives when the user drops onto a swim-lane column.
      // Undefined means a same-lane (time-only) drop — leave tech unchanged.
      const newResourceId = (args as unknown as { resourceId?: string }).resourceId
      let leadTechAccountId: string | null | undefined = undefined
      if (newResourceId !== undefined && newResourceId !== args.event.resourceId) {
        leadTechAccountId = newResourceId === UNASSIGNED_RESOURCE_ID ? null : newResourceId
      }

      // Route through the shared handler so the legacy fallback calendar gets
      // the same conflict check + single mutation as the custom views.
      scheduleEvent(args.event.id, start.toISOString(), end.toISOString(), leadTechAccountId)
    }, [scheduleEvent])

  const onEventResize: NonNullable<withDragAndDropProps<CalendarEvent>['onEventResize']> =
    onEventDrop

  // Keyboard shortcuts: M/W/D + T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || t.isContentEditable) return
      }
      if (e.key === 'm' || e.key === 'M') setView(Views.MONTH)
      else if (e.key === 'w' || e.key === 'W') setView(Views.WEEK)
      else if (e.key === 'd' || e.key === 'D') setView(Views.DAY)
      else if (e.key === 't' || e.key === 'T') setDate(tenantCalendarDate(tenantTimezone))
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(ZOOM_STEP) }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-ZOOM_STEP) }
      else if (e.key === '0') { e.preventDefault(); setZoom(1) }
      else if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const statuses = statusesQuery.data?.data ?? []

  // The "Needs Scheduling" lifecycle status (seeded into every tenant via
  // crewbarn:seed-common-statuses). Used to flag jobs pulled off the calendar.
  const needsSchedulingStatusId = useMemo(() => {
    const found = statuses.find(
      (s) => s.slug === 'needs-scheduling' || /needs?\s*schedul|unschedul/i.test(s.name),
    )
    return found?.id ?? null
  }, [statuses])

  // Pull a job off the calendar → back to the To-Schedule sidebar. Nulls the
  // unified scheduled_start_at (what the calendar reads + the unscheduled
  // query keys on); the model won't cascade from the legacy fields. For jobs
  // we also flip the status to "Needs Scheduling" so the queue is flagged;
  // estimates track approval_status instead, so their status is left alone.
  const unscheduleJob = (id: string) => {
    const kind = kindOf(id)
    const patch: Record<string, unknown> = {
      is_scheduled: false,
      scheduled_date: null,
      scheduled_start_time: null,
      scheduled_end_time: null,
      scheduled_start_at: null,
      scheduled_end_at: null,
    }
    if (kind === 'job' && needsSchedulingStatusId) {
      patch.status_id = needsSchedulingStatusId
    }
    updateWO.mutate({ id, patch, kind })
  }

  // Status change from the calendar (right-click → Change status). Geotag it
  // so the owner can audit where the tech was — best-effort, never blocks; a
  // blocked browser prompt is logged as 'denied'.
  const changeStatus = async (id: string, statusId: string) => {
    const patch: Record<string, unknown> = { status_id: statusId }
    Object.assign(patch, await captureStatusGeo())
    updateWO.mutate({ id, patch, kind: kindOf(id) })
  }

  return (
    <div data-tour="schedule-root" className="flex h-[calc(100vh-120px)] bg-white border-t border-slate-200">
      {/* Drag-and-drop polish. The cursor-flicker bug (mouse "leaves" the
          dragged event) is fixed by forcing `cursor: grabbing` on EVERY
          element while any drag/resize is happening — keeps the cursor
          state consistent regardless of what the pointer hovers over. */}
      <style>{`
        .rbc-event { cursor: grab; }
        .rbc-event:hover { filter: brightness(0.96); }
        .rbc-event.rbc-addons-dnd-dragging,
        .rbc-event.rbc-addons-dnd-resizing {
          opacity: 1;
          filter: none;
          transform: scale(1.02);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.24);
          z-index: 30;
        }
        .rbc-addons-dnd-drag-preview {
          opacity: 1;
          pointer-events: none;
          filter: none;
          border-radius: 8px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.24);
        }

        /* Modern :has() — supported in Chrome/Edge/Safari/Firefox 121+.
           When any element has .rbc-addons-dnd-dragging (set on the
           original event during drag), force grabbing cursor on every
           descendant so the cursor never flips back to default. */
        body:has(.rbc-addons-dnd-dragging),
        body:has(.rbc-addons-dnd-dragging) * {
          cursor: grabbing !important;
        }

        .rbc-time-slot { border-top-color: rgba(226, 232, 240, 0.6) !important; }
      `}</style>
      {/* Mobile backdrop behind the slide-in sidebar */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ===== Sidebar — overlay drawer on mobile, column on md+ ===== */}
      {/* md:relative (not static) so the absolute unschedule-drop overlay
          below is contained to the sidebar, not the whole viewport. */}
      <aside
        className={`relative ${
          mobileSidebarOpen
            ? 'fixed inset-y-0 left-0 z-40 w-[85vw] max-w-xs shadow-xl flex'
            : 'hidden'
        } md:relative md:z-auto md:flex md:w-72 md:shadow-none border-r border-slate-200 bg-white flex-col overflow-hidden`}
      >
        {/* Drop-target overlay for unscheduling: the custom views portal
            their @dnd-kit droppable in here while a card is being dragged.
            pointer-events-none so the sidebar stays interactive otherwise. */}
        <div ref={setSidebarDropEl} className="absolute inset-0 z-40 pointer-events-none" />
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              To Schedule
            </h2>
            {/* Close — only meaningful in the mobile overlay */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <input
            type="search"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search customer / address…"
            className="mt-2 w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {UNSCHED_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setUnschedFilter(filter.value)}
                aria-pressed={unschedFilter === filter.value}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  unschedFilter === filter.value
                    ? 'border-amber-500 bg-amber-100 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center justify-between gap-2">
            <span>📋 Jobs</span>
            <div className="flex items-center gap-1.5">
              <select
                value={unschedSort}
                onChange={(e) => setUnschedSort(e.target.value as UnschedSort)}
                className="text-[11px] normal-case font-normal border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-amber-500"
                title="Sort the unscheduled queue"
              >
                <option value="priority">Priority</option>
                <option value="oldest">Oldest</option>
                <option value="newest">Newest</option>
                <option value="customer">Customer</option>
                <option value="type">Type</option>
              </select>
              <select
                value={unschedGroupBy}
                onChange={(e) => setUnschedGroupBy(e.target.value as UnschedGroupBy)}
                className="text-[11px] normal-case font-normal border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-amber-500"
                title="Group the unscheduled queue"
              >
                <option value="none">Flat</option>
                <option value="priority">By priority</option>
                <option value="type">By type</option>
                <option value="customer">By customer</option>
              </select>
              <span className="text-amber-700 bg-amber-100 rounded px-1.5">
                {unscheduledQuery.isSuccess ? `${visibleUnscheduled.length}${rawUnscheduled.length !== visibleUnscheduled.length ? `/${rawUnscheduled.length}` : ''}` : '—'}
              </span>
            </div>
          </div>
          {unscheduledQuery.isLoading ? (
            <p role="status" className="px-4 py-6 text-xs text-slate-500">Loading unscheduled jobs…</p>
          ) : unscheduledQuery.isError ? (
            <div role="alert" className="px-4 py-4 text-xs text-red-700">
              Could not load unscheduled jobs.
              <button type="button" onClick={() => { void unscheduledQuery.refetch() }} disabled={unscheduledQuery.isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
            </div>
          ) : visibleUnscheduled.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">Nothing in this queue.</div>
          ) : unschedGroupBy === 'none' ? (
            <ul className="divide-y divide-slate-100">
              {visibleUnscheduled.map((w) => (
                <UnscheduledRow key={w.id} wo={w} onSelect={setSelected} />
              ))}
            </ul>
          ) : (
            groupUnscheduled(visibleUnscheduled, unschedGroupBy).map((g) => (
              <div key={g.key}>
                <div className="px-4 py-1 bg-slate-50 border-y border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-500 flex items-center justify-between gap-2">
                  <span className="truncate">{g.label}</span>
                  <span className="text-slate-400">{g.items.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((w) => (
                    <UnscheduledRow key={w.id} wo={w} onSelect={setSelected} />
                  ))}
                </ul>
              </div>
            ))
          )}
          <StaffTimeOffPanel blocks={visibleTimeOffBlocks} loading={approvedTimeOffQuery.isFetching} />
        </div>

        {/* Pending estimates — sent + not yet approved/rejected/expired */}
        <PendingEstimatesPanel />

      </aside>

      {/* ===== Calendar ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {[
          { label: 'Calendar jobs', query: eventsQuery },
          { label: 'Tasks', query: tasksQuery },
          { label: 'Staff time off', query: approvedTimeOffQuery },
          { label: 'Job statuses', query: statusesQuery },
          { label: 'Technician roster', query: techRosterQuery },
        ].filter(({ query }) => query.isError).map(({ label, query }) => (
          <div key={label} role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            {label} could not refresh. The schedule may be incomplete or out of date.
            <button type="button" onClick={() => { void query.refetch() }} disabled={query.isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
          </div>
        ))}
        <div className="border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Mobile-only: open the unscheduled-jobs drawer */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-300 rounded-md text-slate-700"
          >
            📋 Jobs
            {visibleUnscheduled.length > 0 && (
              <span className="text-amber-700 bg-amber-100 rounded px-1.5">
                {visibleUnscheduled.length}
              </span>
            )}
          </button>

          <div className="hidden md:inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
            {[
              { v: Views.MONTH, label: 'Month' },
              { v: Views.WEEK, label: 'Week' },
              { v: Views.DAY, label: 'Day' },
            ].map(({ v, label }, idx) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v as View)}
                aria-pressed={view === v}
                data-easy-view-option
                className={`px-3 py-1.5 ${idx > 0 ? 'border-l border-slate-300' : ''} ${
                  view === v ? 'bg-amber-100 text-amber-800 font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setDate(navDate(date, view, -1))}
              className="px-3 py-1.5 hover:bg-slate-50"
              title="Previous"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setDate(tenantCalendarDate(tenantTimezone))}
              className="px-3 py-1.5 border-l border-slate-300 hover:bg-slate-50"
              title="Today (T)"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDate(navDate(date, view, 1))}
              className="px-3 py-1.5 border-l border-slate-300 hover:bg-slate-50"
              title="Next"
            >
              →
            </button>
          </div>

          {/* Zoom — Day/Week scale the time grid; Month scales row height. */}
          {(view === Views.WEEK || view === Views.DAY || view === Views.MONTH) && (
            <div className="hidden md:inline-flex items-center rounded-md border border-slate-300 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => zoomBy(-ZOOM_STEP)}
                disabled={zoom <= ZOOM_MIN}
                className="px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Zoom out (−)"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 py-1.5 border-l border-slate-300 hover:bg-slate-50 tabular-nums w-14 text-center"
                title="Reset zoom (0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => zoomBy(ZOOM_STEP)}
                disabled={zoom >= ZOOM_MAX}
                className="px-2.5 py-1.5 border-l border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Zoom in (+)"
              >
                +
              </button>
            </div>
          )}

          <div className="hidden xl:inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
            {CARD_DENSITY_OPTIONS.map((option, idx) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCardDensity(option.value)}
                aria-pressed={cardDensity === option.value}
                data-easy-view-option
                className={`px-2.5 py-1.5 ${idx > 0 ? 'border-l border-slate-300' : ''} ${
                  cardDensity === option.value
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={option.title}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder="Filter by customer…"
            className="text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-amber-500 focus:outline-none"
            title="Filter the calendar to one tech's jobs"
          >
            <option value="">All techs</option>
            {(techRosterQuery.data?.data.techs ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <CrewFilter value={crewFilter} onChange={setCrewFilter} />
          <div className="flex items-center gap-2">
            <ScheduleLegendHoverButton label="Statuses" icon="◉">
              <StatusLegendList
                statuses={statuses}
                hiddenStatusIds={hiddenStatusIds}
                onToggleStatus={(id) => {
                  setHiddenStatusIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }}
                onColorChange={(id, input) => updateStatus.mutate({ id, input })}
              />
            </ScheduleLegendHoverButton>
            <ScheduleLegendHoverButton label="Card Badges" icon="🏷">
              <div className="p-3">
                <BadgeLegend />
              </div>
            </ScheduleLegendHoverButton>
          </div>

          <div className="ml-auto text-[11px] text-slate-400">
            {eventsQuery.isFetching ? '⟳ refreshing…' : `${events.length} on screen · auto-refresh 10s`}
          </div>
        </div>

        {/* Mobile: day agenda (the grid views don't work below md). */}
        <div className="md:hidden flex-1 overflow-hidden">
          <MobileScheduleAgenda
            date={date}
            events={(eventsQuery.data?.data ?? []).filter(
              (w) => !w.status?.id || !hiddenStatusIds.has(w.status.id),
            )}
            onSelectEvent={(wo) => setSelected(wo)}
            onStepDay={(delta) => setDate(addDays(date, delta))}
            onToday={() => setDate(tenantCalendarDate(tenantTimezone))}
            colorFor={(wo) => visibleStatusColor(wo.status?.color)}
            isLate={isLate}
          />
        </div>

        {/* Desktop: full drag-and-drop calendar grid */}
        <div
          className="hidden md:block flex-1 overflow-hidden"
          onDragOver={(e) => {
            // Allow dropping unscheduled jobs from sidebar.
            if (e.dataTransfer.types.includes('text/plain')) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }
          }}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain')
            if (!id) return
            // Fallback drop (outside any day cell/column) — default to 9 AM.
            // scheduleEvent recomputes the end from the job's estimated
            // duration and runs the shared conflict check.
            const start = startOfDay(date)
            start.setHours(9, 0, 0, 0)
            const end = new Date(start.getTime() + 60 * 60000)
            scheduleEvent(id, start.toISOString(), end.toISOString())
          }}
        >
          {view === Views.WEEK ? (
            <CustomWeekView
              date={date}
              events={(eventsQuery.data?.data ?? []).filter(
                (w) => !w.status?.id || !hiddenStatusIds.has(w.status.id),
              )}
              tasks={calendarTasks}
              timeOffBlocks={visibleTimeOffBlocks}
              onTaskRescheduleToDay={onTaskRescheduleToDay}
              onSelectEvent={(wo) => setSelected(wo)}
              onReschedule={(id, start, end) => scheduleEvent(id, start, end)}
              onChangeStatus={changeStatus}
              onReassign={(id, techId) =>
                updateWO.mutate({ id, patch: { lead_tech_account_id: techId }, kind: kindOf(id) })
              }
              onChangeTime={(id, start, end) => scheduleEvent(id, start, end)}
              onConvertEstimate={(id) => setConvertingEstimateId(id)}
              colorFor={(wo) => visibleStatusColor(wo.status?.color)}
              textColorFor={(hex) => textColorOn(hex)}
              isLate={isLate}
              onUnschedule={unscheduleJob}
              unscheduleDropContainer={sidebarDropEl}
              zoom={zoom}
              cardDensity={cardDensity}
            />
          ) : view === Views.DAY ? (
            <CustomDayView
              date={date}
              events={(eventsQuery.data?.data ?? []).filter(
                (w) => !w.status?.id || !hiddenStatusIds.has(w.status.id),
              )}
              tasks={calendarTasks}
              timeOffBlocks={visibleTimeOffBlocks}
              onTaskReassign={onTaskReassign}
              onSelectEvent={(wo) => setSelected(wo)}
              onReschedule={(id, start, end, techId) => scheduleEvent(id, start, end, techId)}
              onChangeStatus={changeStatus}
              onReassign={(id, techId) =>
                updateWO.mutate({ id, patch: { lead_tech_account_id: techId }, kind: kindOf(id) })
              }
              onChangeTime={(id, start, end) => scheduleEvent(id, start, end)}
              colorFor={(wo) => visibleStatusColor(wo.status?.color)}
              textColorFor={(hex) => textColorOn(hex)}
              isLate={isLate}
              onUnschedule={unscheduleJob}
              unscheduleDropContainer={sidebarDropEl}
              zoom={zoom}
              cardDensity={cardDensity}
            />
          ) : view === Views.MONTH ? (
            <CustomMonthView
              date={date}
              events={(eventsQuery.data?.data ?? []).filter(
                (w) => !w.status?.id || !hiddenStatusIds.has(w.status.id),
              )}
              tasks={calendarTasks}
              timeOffBlocks={visibleTimeOffBlocks}
              onTaskRescheduleToDay={onTaskRescheduleToDay}
              onSelectEvent={(wo) => setSelected(wo)}
              onReschedule={(id, start, end) => scheduleEvent(id, start, end)}
              onChangeStatus={changeStatus}
              onReassign={(id, techId) =>
                updateWO.mutate({ id, patch: { lead_tech_account_id: techId }, kind: kindOf(id) })
              }
              onChangeTime={(id, start, end) => scheduleEvent(id, start, end)}
              colorFor={(wo) => visibleStatusColor(wo.status?.color)}
              textColorFor={(hex) => textColorOn(hex)}
              isLate={isLate}
              onJumpToDay={(d) => {
                setDate(d)
                setView(Views.DAY)
              }}
              onUnschedule={unscheduleJob}
              unscheduleDropContainer={sidebarDropEl}
              zoom={zoom}
              cardDensity={cardDensity}
            />
          ) : (
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={(v: View) => setView(v)}
            date={date}
            onNavigate={(d: Date) => setDate(d)}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventPropGetter}
            onEventDrop={onEventDrop}
            onEventResize={onEventResize}
            onSelectEvent={(evt: CalendarEvent) => setSelected(evt.resource)}
            onSelectSlot={(slot: unknown) => {
              // Click-and-drag on empty calendar → quick-create stub
              // (full quick-create modal in Ship 2). For now, log it.
              console.info('[Schedule] Empty-slot select:', slot)
            }}
            selectable
            resizable
            style={{ height: '100%' }}
            popup
            tooltipAccessor={(e: CalendarEvent) =>
              `${e.resource.customer?.name ?? '—'}\n` +
              `${e.resource.status?.name ?? ''}` +
              (e.resource.lead_tech?.name ? `\nTech: ${e.resource.lead_tech.name}` : '')
            }
            // Day-view tech swim lanes — one column per tech. Hidden in
            // month/week views where it'd be too cramped.
            resources={resources}
            resourceIdAccessor={(r: { id: string }) => r.id}
            resourceTitleAccessor={(r: { title: string }) => r.title}
            // Bigger blocks + finer drag snap: 6 AM-10 PM range, 15-min
            // snap (smoother drag feel — events click into slots as you
            // pass over them), 2 slots per group keeps the row labels at
            // 30-min intervals.
            min={new Date(1970, 0, 1, 6, 0)}
            max={new Date(1970, 0, 1, 22, 0)}
            step={15}
            timeslots={2}
            components={{ event: BigEventTile }}
          />
          )}
        </div>
      </main>

      {/* ===== Side panel ===== */}
      {selected && (
        <EventDetailPanel wo={selected} onClose={() => setSelected(null)} />
      )}

      {/* ===== Convert-estimate-to-job overlay ===== */}
      {convertingEstimateId && convertingEstimateQuery.data && (
        <ConvertEstimateToJobModal
          isOpen
          onClose={() => setConvertingEstimateId(null)}
          estimate={convertingEstimateQuery.data}
        />
      )}

      {/* ===== Assign-tech prompt when scheduling an untech'd job ===== */}
      {pendingSchedule && (
        <TechSelectModal
          techs={techRosterQuery.data?.data.techs ?? []}
          loading={techRosterQuery.isLoading}
          failed={techRosterQuery.isError}
          retrying={techRosterQuery.isFetching}
          onRetry={() => { void techRosterQuery.refetch() }}
          onClose={() => setPendingSchedule(null)}
          onSelect={(techId) => {
            const p = pendingSchedule
            setPendingSchedule(null)
            scheduleEvent(p.id, p.startIso, p.endIso, techId, { skipTechPrompt: true })
          }}
          onKeepUnassigned={() => {
            const p = pendingSchedule
            setPendingSchedule(null)
            scheduleEvent(p.id, p.startIso, p.endIso, null, { skipTechPrompt: true })
          }}
        />
      )}
    </div>
  )
}

/**
 * Compact "who's taking this job?" modal shown when a job is dragged onto the
 * calendar with no tech assigned. Pick a tech (auto-assigns) or keep it
 * unassigned — either way the job gets scheduled.
 */
function ScheduleLegendHoverButton({
  label,
  icon,
  children,
}: {
  label: string
  icon: string
  children: ReactNode
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <span className="text-[13px] leading-none" aria-hidden="true">{icon}</span>
        {label}
      </button>
      <div className="invisible absolute left-0 top-full z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white text-left shadow-xl opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusLegendList({
  statuses,
  hiddenStatusIds,
  onToggleStatus,
  onColorChange,
}: {
  statuses: Array<{ id: string; name: string; color: string | null; color_secondary?: string | null }>
  hiddenStatusIds: Set<string>
  onToggleStatus: (id: string) => void
  onColorChange: (id: string, input: { color?: string; color_secondary?: string }) => void
}) {
  return (
    <div className="max-h-96 overflow-y-auto py-2">
      <p className="px-3 pb-2 text-xs leading-5 text-slate-500">
        Click a row to hide or show that status. Outline controls the outside lining; fill controls the card middle.
      </p>
      {statuses.length === 0 ? (
        <div className="px-3 py-2 text-xs text-slate-400">No statuses loaded.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {statuses.map((status) => {
            const hidden = hiddenStatusIds.has(status.id)
            const outline = toHexColor(status.color)
            const fill = toHexColor(status.color_secondary ?? status.color)
            return (
              <li
                key={status.id}
                className={`grid cursor-pointer grid-cols-[1fr_auto] gap-2 px-3 py-2 hover:bg-slate-50 ${hidden ? 'opacity-40' : ''}`}
              >
                <button type="button" className="min-w-0 text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500" onClick={() => onToggleStatus(status.id)} aria-pressed={!hidden} aria-label={`${status.name}: ${hidden ? 'show on' : 'hide from'} calendar`}>
                  <div className="truncate text-xs font-semibold text-slate-700">{status.name}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] text-slate-500" style={{ background: matteStatusFill(outline, fill), borderColor: matteStatusBorder(outline) }}>
                    <span className="h-4 w-1 rounded-full" style={{ background: statusAccentColor(outline) }} />
                    Preview
                  </div>
                  {hidden ? <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hidden</div> : null}
                </button>
                <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                  <label className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Outline
                    <input
                      type="color"
                      value={outline}
                      onChange={(event) => onColorChange(status.id, { color: event.target.value })}
                      className="h-6 w-8 cursor-pointer rounded border border-slate-300"
                      title="Outside lining color"
                    />
                  </label>
                  <label className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Fill
                    <input
                      type="color"
                      value={fill}
                      onChange={(event) => onColorChange(status.id, { color_secondary: event.target.value })}
                      className="h-6 w-8 cursor-pointer rounded border border-slate-300"
                      title="Middle fill color"
                    />
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
function TechSelectModal({
  techs,
  loading,
  failed,
  retrying,
  onRetry,
  onClose,
  onSelect,
  onKeepUnassigned,
}: {
  techs: Array<{ id: string; name: string }>
  loading: boolean
  failed: boolean
  retrying: boolean
  onRetry: () => void
  onClose: () => void
  onSelect: (techId: string) => void
  onKeepUnassigned: () => void
}) {
  return (
    <Modal isOpen onClose={onClose} title="Assign a tech?" size="sm">
      <Modal.Body>
        <p className="text-xs text-slate-500 mt-1">
          This job has no tech yet. Pick one to assign, or schedule it unassigned.
        </p>

        <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {loading && <div className="px-3 py-3 text-xs text-slate-400 italic">Loading techs…</div>}
          {failed && <div role="alert" className="px-3 py-3 text-xs text-red-700">Could not load the roster. <button type="button" onClick={onRetry} disabled={retrying} className="underline disabled:opacity-50">Retry</button></div>}
          {!loading && !failed && techs.length === 0 && (
            <div className="px-3 py-3 text-xs text-slate-400 italic">No techs on the roster.</div>
          )}
          {!loading && !failed && techs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50"
            >
              {t.name}
            </button>
          ))}
        </div>

      </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onKeepUnassigned}
            className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
          >
            Keep unassigned →
          </button>
        </Modal.Footer>
    </Modal>
  )
}

function StaffTimeOffPanel({ blocks, loading }: { blocks: ApprovedTimeOffBlock[]; loading: boolean }) {
  if (!loading && blocks.length === 0) return null

  return (
    <div className="mt-3 border-t border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Staff off</span>
        <span className="rounded bg-slate-100 px-1.5 text-slate-500">{blocks.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {loading && blocks.length === 0 ? (
          <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-400">
            Loading approved time off...
          </div>
        ) : (
          blocks.slice(0, 8).map((block) => (
            <div key={block.id} className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-800">{block.account_name ?? 'Staff member'}</div>
                  <div className="mt-0.5 text-sky-800">{humanizeTimeOffType(block.type)}</div>
                </div>
                <div className="shrink-0 text-right text-[11px] font-medium text-slate-500">
                  {formatTimeOffRange(block)}
                </div>
              </div>
              {block.reason && <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">{block.reason}</div>}
            </div>
          ))
        )}
        {blocks.length > 8 && (
          <div className="text-[11px] text-slate-400">+{blocks.length - 8} more approved request{blocks.length - 8 === 1 ? '' : 's'} in this view</div>
        )}
      </div>
    </div>
  )
}

function EventDetailPanel({ wo, onClose }: { wo: ScheduleWorkOrder; onClose: () => void }) {
  return (
    <aside
      className="fixed inset-0 z-40 bg-white flex flex-col md:static md:inset-auto md:z-auto md:w-80 md:border-l md:border-slate-200"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Job detail</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-10 h-10 flex items-center justify-center">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Customer</div>
          <div className="flex items-center gap-2">
            {/* Card avatar only for personal (residential) customers — companies
                get one office-set avatar shown on their account, not per-job. */}
            {wo.customer && wo.customer.type !== 'commercial' && (
              <Avatar name={wo.customer.name ?? '—'} colorKey={wo.customer.id} size={28} className="shrink-0" />
            )}
            <span className="font-medium">{wo.customer?.name ?? '—'}</span>
          </div>
        </div>
        {wo.service_location && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Location</div>
            {wo.service_location.nickname && (
              <div className="font-medium">{wo.service_location.nickname}</div>
            )}
            {wo.service_location.street_address && (
              <div className="mt-2">
                <JobLocationMap
                  address={wo.service_location.formatted_address ?? wo.service_location.street_address}
                  lat={wo.service_location.latitude}
                  lng={wo.service_location.longitude}
                  label={wo.service_location.nickname ?? wo.customer?.name ?? undefined}
                />
              </div>
            )}
          </div>
        )}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Status</div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ background: wo.status?.color ?? '#94a3b8' }} />
            <span>{wo.status?.name ?? '—'}</span>
            {isLate(wo) && <span className="text-xs text-red-700 font-semibold">⚠ LATE</span>}
          </div>
        </div>
        {/* Flags — labeled badges (renders nothing when there are none). */}
        <EventBadges
          flags={wo.flags}
          billTo={wo.bill_to}
          onSiteAt={wo.on_site_at}
          onSite={wo.on_site}
          labeled
        />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Tech</div>
          <div>{wo.lead_tech?.name ?? <span className="text-slate-400">Unassigned</span>}</div>
        </div>
        {wo.scheduled_start_time && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Scheduled</div>
            <div>{new Date(wo.scheduled_start_time).toLocaleString()}</div>
          </div>
        )}
        {wo.title && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Title</div>
            <div>{wo.title}</div>
          </div>
        )}
        <div className="pt-2 border-t border-slate-100">
          <Link
            to={`/jobs/${wo.id}`}
            className="text-sm text-amber-700 hover:underline"
          >
            Open job →
          </Link>
        </div>
      </div>
    </aside>
  )
}

/**
 * Custom event tile — bigger font + multi-line content so dispatchers
 * can read customer/time/tech/location at a glance. Service-Fusion-style
 * big block.
 */
function BigEventTile({ event }: { event: CalendarEvent }) {
  const wo = event.resource
  const customer = wo.customer?.name ?? '—'
  const tech = wo.lead_tech?.name?.split(' ')[0] ?? ''
  const loc = wo.service_location?.nickname ?? ''
  const time = event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="px-1.5 py-1 leading-tight text-[12px] overflow-hidden h-full">
      <div className="font-semibold truncate">{customer}</div>
      <div className="text-[11px] opacity-90 truncate">
        {time}{tech ? ` · ${tech}` : ''}
      </div>
      {loc && (
        <div className="text-[10px] opacity-75 truncate">📍 {loc}</div>
      )}
    </div>
  )
}

function navDate(d: Date, view: View, dir: -1 | 1): Date {
  const days = view === Views.MONTH ? 30 : view === Views.WEEK ? 7 : 1
  return addDays(d, days * dir)
}

// ── Unscheduled queue grouping ──────────────────────────────────────────
type UnschedGroupBy = 'none' | 'priority' | 'type' | 'customer'
type UnschedFilter = 'all' | 'emergency' | 'today' | 'estimates' | 'no_tech' | 'needs_approval'
type UnschedSort = 'priority' | 'oldest' | 'newest' | 'customer' | 'type'

const UNSCHED_FILTERS: Array<{ value: UnschedFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'today', label: 'Today' },
  { value: 'estimates', label: 'Estimates' },
  { value: 'no_tech', label: 'No tech' },
  { value: 'needs_approval', label: 'Needs approval' },
]

const CARD_DENSITY_OPTIONS: Array<{ value: ScheduleCardDensity; label: string; title: string }> = [
  { value: 'compact', label: 'Compact', title: 'Tighter cards for busy calendars' },
  { value: 'standard', label: 'Standard', title: 'Balanced schedule cards' },
  { value: 'detailed', label: 'Detailed', title: 'Show more job detail when space allows' },
]

const PRIORITY_RANK: Record<string, number> = { emergency: 0, urgent: 1, normal: 2, low: 3 }
const NORMAL_WORK_START_HOUR = 7
const NORMAL_WORK_END_HOUR = 19

function unscheduledMatchesFilter(wo: ScheduleWorkOrder, filter: UnschedFilter): boolean {
  if (filter === 'all') return true
  const text = `${wo.priority ?? ''} ${wo.title ?? ''} ${wo.job_type?.name ?? ''} ${wo.status?.name ?? ''}`.toLowerCase()
  if (filter === 'emergency') return /emergency|urgent|after[- ]?hours/.test(text)
  if (filter === 'today') return isSameLocalDate(queueDate(wo), new Date())
  if (filter === 'estimates') return wo.kind === 'estimate'
  if (filter === 'no_tech') return !wo.lead_tech?.id
  if (filter === 'needs_approval') return /approval|approve|pending|nte|needs/.test(`${wo.approval_status ?? ''} ${text}`)
  return true
}

function sortUnscheduled(items: ScheduleWorkOrder[], sort: UnschedSort): ScheduleWorkOrder[] {
  return [...items].sort((a, b) => {
    if (sort === 'priority') {
      const ar = PRIORITY_RANK[(a.priority || 'normal').toLowerCase()] ?? 9
      const br = PRIORITY_RANK[(b.priority || 'normal').toLowerCase()] ?? 9
      if (ar !== br) return ar - br
      return queueTime(a) - queueTime(b)
    }
    if (sort === 'oldest') return queueTime(a) - queueTime(b)
    if (sort === 'newest') return queueTime(b) - queueTime(a)
    if (sort === 'customer') return (a.customer?.name ?? '').localeCompare(b.customer?.name ?? '')
    return (a.job_type?.name ?? '').localeCompare(b.job_type?.name ?? '')
  })
}

function queueDate(wo: ScheduleWorkOrder): Date | null {
  const iso = wo.first_status_change_at || wo.scheduled_start_time
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function queueTime(wo: ScheduleWorkOrder): number {
  return queueDate(wo)?.getTime() ?? 0
}

function isSameLocalDate(a: Date | null, b: Date): boolean {
  return !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isOutsideWorkHours(start: Date, end: Date): boolean {
  const startHour = start.getHours() + start.getMinutes() / 60
  const endHour = end.getHours() + end.getMinutes() / 60
  return startHour < NORMAL_WORK_START_HOUR || endHour > NORMAL_WORK_END_HOUR
}

function humanizeTimeOffType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Time off'
}

function timeOffBlockWindow(block: ApprovedTimeOffBlock): { start: Date; end: Date } | null {
  if (!block.start_date || !block.end_date) return null

  if (!block.all_day && block.start_time && block.end_time && block.start_date === block.end_date) {
    const start = new Date(`${block.start_date}T${block.start_time.slice(0, 5)}:00`)
    const end = new Date(`${block.end_date}T${block.end_time.slice(0, 5)}:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return { start, end }
  }

  const start = startOfDay(new Date(`${block.start_date}T00:00:00`))
  const end = endOfDay(new Date(`${block.end_date}T00:00:00`))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start, end }
}

function formatHourLabel(value: string): string {
  const [hourRaw, minuteRaw = '00'] = value.split(':')
  const hour = Number(hourRaw)
  if (!Number.isFinite(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteRaw.padStart(2, '0')} ${suffix}`
}
function formatTimeOffRange(
  block: Pick<ApprovedTimeOffBlock, 'start_date' | 'end_date' | 'all_day' | 'start_time' | 'end_time'>,
): string {
  if (!block.start_date || !block.end_date) return 'date not set'
  const start = new Date(`${block.start_date}T00:00:00`)
  const end = new Date(`${block.end_date}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'date not set'
  const startLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`

  if (block.all_day || !block.start_time || !block.end_time) return dateLabel

  const startTime = formatHourLabel(block.start_time.slice(0, 5))
  const endTime = formatHourLabel(block.end_time.slice(0, 5))
  return `${dateLabel}, ${startTime}-${endTime}`
}

function routeWarningForDrop(
  events: CalendarEvent[],
  eventId: string,
  targetTechId: string | null,
  start: Date,
  end: Date,
  moving?: ScheduleWorkOrder | null,
): string | null {
  if (!targetTechId || targetTechId === UNASSIGNED_RESOURCE_ID || !moving) return null
  const movingCoords = coordsFor(moving)
  if (!movingCoords) return null
  const sameTechSameDay = events
    .filter((ev) => ev.id !== eventId && ev.resource.lead_tech?.id === targetTechId && isSameLocalDate(ev.start, start))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  let tightest: { miles: number; gap: number } | null = null
  for (const ev of sameTechSameDay) {
    const otherCoords = coordsFor(ev.resource)
    if (!otherCoords) continue
    const miles = distanceMiles(movingCoords, otherCoords)
    const gapBefore = Math.max(0, (start.getTime() - ev.end.getTime()) / 60000)
    const gapAfter = Math.max(0, (ev.start.getTime() - end.getTime()) / 60000)
    const gap = ev.end <= start ? gapBefore : ev.start >= end ? gapAfter : 0
    const driveMinutes = Math.ceil(miles * 2.2)
    if (gap > 0 && driveMinutes > gap) tightest = !tightest || gap < tightest.gap ? { miles, gap } : tightest
  }
  return tightest ? `Route looks tight: about ${Math.round(tightest.miles)} miles with ${Math.round(tightest.gap)} min gap` : null
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

function groupUnscheduled(
  items: ScheduleWorkOrder[],
  mode: UnschedGroupBy,
): Array<{ key: string; label: string; items: ScheduleWorkOrder[] }> {
  const map = new Map<string, { key: string; label: string; items: ScheduleWorkOrder[] }>()
  for (const w of items) {
    let key: string
    let label: string
    if (mode === 'priority') {
      key = (w.priority || 'normal').toLowerCase()
      label = key.charAt(0).toUpperCase() + key.slice(1)
    } else if (mode === 'type') {
      key = w.job_type?.id ?? '__none__'
      label = w.job_type?.name ?? 'No type'
    } else {
      key = w.customer?.id ?? '__none__'
      label = w.customer?.name ?? '—'
    }
    const g = map.get(key) ?? { key, label, items: [] }
    g.items.push(w)
    map.set(key, g)
  }
  const groups = Array.from(map.values())
  if (mode === 'priority') {
    groups.sort((a, b) => (PRIORITY_RANK[a.key] ?? 9) - (PRIORITY_RANK[b.key] ?? 9))
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label))
  }
  return groups
}

function createScheduleDragPreview(wo: ScheduleWorkOrder): HTMLElement {
  const preview = document.createElement('div')
  Object.assign(preview.style, {
    position: 'fixed',
    top: '-1000px',
    left: '-1000px',
    width: '300px',
    padding: '10px 12px',
    background: '#ffffff',
    border: '1px solid #f59e0b',
    borderLeft: '4px solid #f59e0b',
    borderRadius: '10px',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.24)',
    color: '#0f172a',
    pointerEvents: 'none',
    zIndex: '-1',
  })

  const customer = document.createElement('div')
  customer.textContent = wo.customer?.name ?? 'Unscheduled job'
  Object.assign(customer.style, {
    fontSize: '12px',
    fontWeight: '700',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  const title = document.createElement('div')
  title.textContent = wo.title || wo.work_order_number || wo.id
  Object.assign(title.style, {
    marginTop: '2px',
    fontSize: '11px',
    color: '#475569',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  const address = wo.service_location?.street_address
  if (address) {
    const location = document.createElement('div')
    location.textContent = address
    Object.assign(location.style, {
      marginTop: '4px',
      fontSize: '10px',
      color: '#64748b',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    })
    preview.append(customer, title, location)
  } else {
    preview.append(customer, title)
  }

  document.body.appendChild(preview)
  return preview
}

/** One draggable unscheduled-job row in the To-Schedule sidebar. */
function UnscheduledRow({
  wo,
  onSelect,
}: {
  wo: ScheduleWorkOrder
  onSelect: (wo: ScheduleWorkOrder) => void
}) {
  return (
    <li
      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', wo.id)
        e.dataTransfer.effectAllowed = 'move'
        const dragPreview = createScheduleDragPreview(wo)
        e.dataTransfer.setDragImage(dragPreview, 18, 18)
        window.setTimeout(() => dragPreview.remove(), 0)
      }}
      onClick={() => onSelect(wo)}
    >
      <div className="text-xs font-medium text-slate-800 truncate">{wo.customer?.name ?? '—'}</div>
      <div className="text-[11px] text-slate-500 truncate">
        {wo.title || wo.work_order_number || wo.id}
      </div>
      {wo.service_location?.street_address && (
        <div className="text-[10px] text-slate-400 truncate">📍 {wo.service_location.street_address}</div>
      )}
    </li>
  )
}

// textColorOn is now imported from '@/lib/statusColor' — shared with
// the Job Statuses settings page so calendar event text + status card
// labels stay readable against the same backgrounds.

/**
 * Sidebar panel: estimates that are sent + still pending. Soft-expires
 * (visual warning) when expires_at is within 3 days; the cron job
 * (estimates:expire-sent) flips status to 'expired' once the date passes,
 * which removes them from this list automatically.
 */
function PendingEstimatesPanel() {
  const { data, isLoading, isError, isFetching, refetch } = useEstimates({ status: 'sent', per_page: 25 })
  const rows = data?.data ?? []

  function relativeExpiry(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    const ms = d.getTime() - Date.now()
    const days = Math.round(ms / 86_400_000)
    if (days < 0) return `expired ${-days}d ago`
    if (days === 0) return 'expires today'
    if (days === 1) return 'expires tomorrow'
    return `expires in ${days}d`
  }

  return (
    <div className="border-t border-slate-200 max-h-[40%] flex flex-col">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Pending approval
        </span>
        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
          {isLoading || isError ? '—' : `${rows.length} shown`}
        </span>
      </div>
      <ul className="overflow-y-auto">
        {isLoading && (
          <li className="px-4 py-2 text-xs text-slate-400">Loading…</li>
        )}
        {isError && (
          <li role="alert" className="px-4 py-3 text-xs text-red-700">
            Could not load pending estimates.
            <button type="button" onClick={() => { void refetch() }} disabled={isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
          </li>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <li className="px-4 py-3 text-center text-xs text-slate-400">
            Nothing waiting.
          </li>
        )}
        {!isLoading && !isError && rows.map((est) => {
          const expiringSoon =
            !!est.expires_at &&
            new Date(est.expires_at).getTime() - Date.now() < 3 * 86_400_000
          return (
            <li key={est.id} className="px-4 py-2 hover:bg-slate-50">
              <Link to={`/estimates/${est.id}`} className="block">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {est.customer?.display_name ?? '—'}
                </div>
                <div className="flex items-center justify-between mt-0.5 gap-2">
                  <span className="text-[11px] font-mono text-slate-500">
                    {est.display_number ?? est.estimate_number}
                  </span>
                  {est.expires_at && (
                    <span className={`text-[10px] ${expiringSoon ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                      {relativeExpiry(est.expires_at)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Crew filter dropdown for the schedule. Fetches the tenant's crews and
 * shows them as a select. "All crews" clears the filter.
 */
function CrewFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const list = useQuery({
    queryKey: ['crews', 'for-calendar-filter'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string; color: string | null; active: boolean }> }>('/v1/crews'),
    staleTime: 60_000,
  })
  const crews = (list.data?.data ?? []).filter((c) => c.active)
  if (crews.length === 0) return null
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
      title="Filter to one crew"
    >
      <option value="">All crews</option>
      {crews.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
