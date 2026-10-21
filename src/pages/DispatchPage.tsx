import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { continueAfterFailedConflictCheck } from '@/lib/conflictCheck'
import { type JobSub, SUB_STATE_CLASS } from '@/lib/subLane'
import { loadGoogleMaps } from '@/lib/googleMaps'
import { dispatchJobAppearance } from '@/lib/dispatchJobColor'
import { assignedVisits, hasRouteCoordinates, recentRouteOrigin, routePlanForTech, routeSegments, type RoutePoint } from '@/lib/dispatchRoutePlan'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { useLazyGeocode } from '@/hooks/useLazyGeocode'
import { useRealtimePositions, type Position } from '@/hooks/useRealtimePositions'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { JobTypeChip } from '@/components/JobTypeChip'
import { Modal } from '@/components/ui/Modal'
import { IncomingRequestsPanel } from '@/components/dispatch/IncomingRequestsPanel'
import { IncomingEstimateRequestsPanel } from '@/components/dispatch/IncomingEstimateRequestsPanel'
import { TechDayPanel } from '@/components/dispatch/TechDayPanel'
import { FieldEncounterPanel } from '@/components/dispatch/FieldEncounterPanel'
import {
  FIELD_ENCOUNTERS_KEY, encounterAnswerLabel, encounterColor, encounterTime, fetchFieldEncounters, type FieldEncounterRow,
} from '@/lib/fieldEncounters'

/**
 * /dispatch — the Dispatch dashboard.
 *
 * Left rail: technician roster (with live GPS freshness) + today's
 * unassigned jobs. Main pane: a live Google map plotting today's jobs
 * and every technician's most recent GPS position.
 *
 * Data:
 *   - GET /v1/dispatch/board      full payload, refetched every 30 s
 *   - Reverb `position.updated` — server pushes each new position as it's
 *                                  ingested (useRealtimePositions). ~1s
 *                                  latency from phone to map; no polling.
 *                                  Replaced the SSE stream, which held a
 *                                  php-fpm worker per open tab.
 *
 * Positions are fed provider-agnostically by POST /v1/positions — an OBD
 * dongle, a hardwired tracker, or the (future) technician phone app all
 * land in the same place, so this board doesn't care which GPS vendor a
 * tenant uses.
 */

interface BoardJob {
  /** 'job' = work order, 'estimate' = scheduled on-site assessment. */
  kind?: 'job' | 'estimate'
  /** Estimates only: quote lifecycle (draft/sent/approved/…). */
  approval_status?: string | null
  /** Server confirms all active invoices are paid, without exposing amounts. */
  paid_in_full?: boolean
  id: string
  work_order_number: number | null
  display_number: string | null
  title: string | null
  priority: string | null
  scheduled_start_at: string | null
  lead_tech_account_id: string | null
  lead_tech_name: string | null
  status: { id: string; name: string; color: string; category: string } | null
  job_type?: { name: string; color: string | null; icon: string | null } | null
  territory?: { id: string; name: string } | null
  customer_name: string | null
  /** Bill-to (dealer) when the invoice goes to someone other than the service customer. */
  bill_to_name?: string | null
  location: {
    id: string
    label: string | null
    address: string
    latitude: number | null
    longitude: number | null
  } | null
  /** Sent to a sub company: not this company's to assign. */
  sub?: JobSub | null
}

interface BoardTech {
  id: string
  name: string
  role: string | null
  email: string | null
  /** Profile photo → avatar marker on the map (initials fallback). */
  avatar_url?: string | null
  /** Today's job count (jobs + assessments) — drives the roster "X jobs" line. */
  job_count: number
  /** How many of job_count are scheduled estimates (assessments). */
  assessment_count?: number
  /** Total incomplete jobs assigned to this tech across all dates —
   *  every WO whose status category is open / in_progress / blocked. */
  open_jobs_count: number
  /** Workload state — drives the roster dot color. */
  work_status: 'idle' | 'scheduled' | 'on_job'
  position: Position | null
}

/** Roster dot — workload, NOT GPS freshness (that's in the text line). */
const WORK_STATUS_META: Record<BoardTech['work_status'], { dot: string; label: string }> = {
  idle: { dot: 'bg-slate-300', label: 'Open' },
  scheduled: { dot: 'bg-blue-500', label: 'Scheduled' },
  on_job: { dot: 'bg-emerald-500', label: 'On a job' },
}

/**
 * Map-marker fill — all techs use the brand orange so they pop on any
 * map tile. Workload (idle / scheduled / on-job) stays in the roster
 * dot; the map is for "where is everyone."
 */
const TECH_MARKER_COLOR = '#f59e0b'

/** Threshold (mph) below which we treat the tech as stationary — no
 *  directional chevron, no speed readout (shows "Parked" instead). GPS
 *  jitter at a desk can read up to ~4 mph, so anything below this is noise. */
const MIN_MOVING_MPH = 5

// Predictive "at risk of late": a tech whose live-GPS drive estimate to an
// upcoming, not-yet-started job already exceeds the time left (+ buffer). Mirrors
// the server's at_risk reminder heuristic so the map and the push agree.
const AT_RISK_LEAD_MIN = 90 // only judge jobs starting within this window
const AT_RISK_BUFFER_MIN = 5 // flag when predicted at least this many minutes late
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Suggestion {
  account_id: string
  name: string
  distance_miles: number | null
  has_gps: boolean
  lat: number | null
  lng: number | null
  available_now: boolean
  next_free_at: string | null
  jobs_today: number
  reason: string
}

interface ApprovedTimeOffBlock {
  id: string
  account_id: string
  account_name: string | null
  type: string
  start_date: string | null
  end_date: string | null
  all_day: boolean
  start_time: string | null
  end_time: string | null
  status: 'approved'
  reason: string | null
}

interface NeedsSchedulingItem {
  kind: 'job' | 'estimate'
  id: string
  number: string
  title: string | null
  priority: string | null
  status: string | null
  customer: { id: string; display_name: string } | null
  address: string | null
  from_portal: boolean
  created_at: string | null
}

interface BoardPayload {
  date: string
  generated_at: string
  selected_territory_id: string | null
  territory_restricted: boolean
  territories: { id: string; name: string }[]
  jobs: BoardJob[]
  techs: BoardTech[]
  /** Open jobs + estimates with no date — never on any day's board otherwise. */
  needs_scheduling?: NeedsSchedulingItem[]
}

/** A GPS fix older than this reads as "stale" — gray, not live. */
const STALE_AFTER_SECONDS = 15 * 60

function freshness(ageSeconds: number | null): { label: string; dot: string; text: string } {
  if (ageSeconds == null) return { label: 'No GPS', dot: 'bg-slate-300', text: 'text-slate-400' }
  if (ageSeconds <= 90) return { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-700' }
  if (ageSeconds <= STALE_AFTER_SECONDS) {
    const m = Math.round(ageSeconds / 60)
    return { label: `${m}m ago`, dot: 'bg-amber-400', text: 'text-amber-700' }
  }
  const h = Math.floor(ageSeconds / 3600)
  const m = Math.round((ageSeconds % 3600) / 60)
  return { label: h > 0 ? `${h}h ${m}m ago` : `${m}m ago`, dot: 'bg-slate-300', text: 'text-slate-400' }
}

/**
 * "Open" / "Closed" after the freshness word: whether the app was on screen
 * when the phone sent that fix. Only worth saying while the fix is recent —
 * on a stale fix the phone's state is as old as the dot.
 */
function appStateLabel(p: Position | null, ageSeconds: number | null): string | null {
  if (!p?.app_state || ageSeconds == null || ageSeconds > STALE_AFTER_SECONDS) return null
  return p.app_state === 'open' ? 'Open' : 'Closed'
}

/** Age of a fix RIGHT NOW — the server-computed age plus the time elapsed
 *  since we received it (board fetch or Reverb push). Paired with the 15s
 *  ticker so labels count up between updates instead of freezing. */
function liveAgeSeconds(p: Position | null, nowMs: number): number | null {
  if (!p || p.age_seconds == null) return null
  const elapsed = p.received_at ? Math.max(0, (nowMs - p.received_at) / 1000) : 0
  return p.age_seconds + elapsed
}

/** When a fix was recorded (ms epoch) — for picking the newest of two fixes. */
function recordedMs(p: Position): number {
  return p.recorded_at ? new Date(p.recorded_at).getTime() : 0
}

/** Fixes with worse accuracy than this can't displace a recent good fix —
 *  one garbage cell fix (hundreds of meters off) shouldn't teleport a marker
 *  away from a solid track. */
const MAX_DISPLAY_ACCURACY_M = 150

/** Prefer the newer of two fixes — unless the newer one has garbage accuracy
 *  and the older one is good and recorded within the last 5 minutes. */
function bestFix(a: Position, b: Position): Position {
  const [older, newer] = recordedMs(a) <= recordedMs(b) ? [a, b] : [b, a]
  const newerGarbage = newer.accuracy_m != null && newer.accuracy_m > MAX_DISPLAY_ACCURACY_M
  const olderGood = older.accuracy_m == null || older.accuracy_m <= MAX_DISPLAY_ACCURACY_M
  const olderRecent = recordedMs(newer) - recordedMs(older) < 5 * 60_000
  return newerGarbage && olderGood && olderRecent ? older : newer
}

export type MapRange = 'day' | 'week' | 'month' | 'year'

/** A MapRange → from/to date strings (yyyy-MM-dd) for the map-jobs query. */
function rangeToDates(range: MapRange): { from: string; to: string } {
  const now = new Date()
  const f = (d: Date) => format(d, 'yyyy-MM-dd')
  switch (range) {
    case 'week':
      return { from: f(startOfWeek(now, { weekStartsOn: 1 })), to: f(endOfWeek(now, { weekStartsOn: 1 })) }
    case 'month':
      return { from: f(startOfMonth(now)), to: f(endOfMonth(now)) }
    case 'year':
      return { from: f(startOfYear(now)), to: f(endOfYear(now)) }
    default:
      return { from: f(now), to: f(now) }
  }
}

function scheduledDateForJob(job: Pick<BoardJob, 'scheduled_start_at'> | null | undefined): string | null {
  if (!job?.scheduled_start_at) return null
  const date = new Date(job.scheduled_start_at)
  if (Number.isNaN(date.getTime())) return null
  return format(date, 'yyyy-MM-dd')
}

async function fetchApprovedTimeOff(accountId: string, from: string, to: string): Promise<ApprovedTimeOffBlock[]> {
  const response = await apiRequest<{ data: ApprovedTimeOffBlock[] }>(
    `/v1/time-off-requests?status=approved&account_id=${encodeURIComponent(accountId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  )
  return response.data ?? []
}

function humanizeTimeOffType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Time off'
}

function formatHourLabel(value: string): string {
  const [hourRaw, minuteRaw = '00'] = value.split(':')
  const hour = Number(hourRaw)
  if (!Number.isFinite(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteRaw.padStart(2, '0')} ${suffix}`
}
function formatTimeOffRange(block: Pick<ApprovedTimeOffBlock, 'start_date' | 'end_date' | 'all_day' | 'start_time' | 'end_time'>): string {
  if (!block.start_date || !block.end_date) return 'date not set'
  const start = new Date(`${block.start_date}T00:00:00`)
  const end = new Date(`${block.end_date}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'date not set'
  const startLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
  if (block.all_day || !block.start_time || !block.end_time) return dateLabel
  return `${dateLabel}, ${formatHourLabel(block.start_time.slice(0, 5))}-${formatHourLabel(block.end_time.slice(0, 5))}`
}

function timeOffCoversDate(block: ApprovedTimeOffBlock, date: string): boolean {
  if (!block.start_date || !block.end_date) return false
  return block.start_date <= date && block.end_date >= date
}

function confirmTimeOffAssignment(techName: string, conflicts: ApprovedTimeOffBlock[], actionLabel: string): boolean {
  if (conflicts.length === 0) return true
  const lines = [
    `${techName} has approved time off during this assignment:`,
    ...conflicts.map((block) => `  - ${humanizeTimeOffType(block.type)} (${formatTimeOffRange(block)})`),
    '',
    `${actionLabel} anyway?`,
  ]
  return window.confirm(lines.join('\n'))
}

export function DispatchPage() {
  const { theme } = useTheme()
  const focus = theme === 'focus'
  const [focusRailSection, setFocusRailSection] = useState<'crew' | 'queue' | 'subs'>('crew')
  const [focusWorkspaceView, setFocusWorkspaceView] = useState<'board' | 'map'>('board')
  const [searchParams] = useSearchParams()
  const requestedTechId = searchParams.get('tech')
  const [territoryId, setTerritoryId] = useState(() => searchParams.get('territory') ?? '')
  const board = useQuery({
    queryKey: ['dispatch-board', territoryId],
    queryFn: () => apiRequest<{ data: BoardPayload }>(
      `/v1/dispatch/board${territoryId ? `?territory_id=${encodeURIComponent(territoryId)}` : ''}`,
    ),
    // 30s — positions ride Reverb between fetches, but job/roster changes and
    // GPS ages need a frequent baseline for the map to read as live.
    refetchInterval: 30_000,
  })

  // Live age ticker — re-renders every 15s so "Xm ago" labels and stale
  // dimming advance between fetches instead of freezing until the next poll.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  // Date range for the MAP only (Day/Week/Month/Year). The roster + unassigned
  // list stay on today's board; this just controls which jobs get plotted.
  const [mapRange, setMapRange] = useState<MapRange>('day')
  const { from: mapFrom, to: mapTo } = useMemo(() => rangeToDates(mapRange), [mapRange])
  const mapBoard = useQuery({
    queryKey: ['dispatch-map-jobs', mapFrom, mapTo, territoryId],
    queryFn: () =>
      apiRequest<{ data: { from: string; to: string; jobs: BoardJob[] } }>(
        `/v1/dispatch/map-jobs?from=${mapFrom}&to=${mapTo}${territoryId ? `&territory_id=${encodeURIComponent(territoryId)}` : ''}`,
      ),
    refetchInterval: 120_000,
  })

  // Live tech positions over Reverb — replaces the old SSE poll that pinned a
  // php-fpm worker per open dashboard tab. Patched in place as fixes arrive.
  const { account } = useAuth()
  const livePositions = useRealtimePositions(account)

  // Unassigned job whose "suggest a tech" panel is open.
  const [suggestJobId, setSuggestJobId] = useState<string | null>(null)

  // Mobile-only view toggle. Desktop shows roster + map side by side;
  // on a phone there's no room for both, so we flip between them. Tapping
  // a tech in the roster auto-switches to the map (focusOnTech below).
  const [mobileView, setMobileView] = useState<'roster' | 'map'>(() => requestedTechId ? 'map' : 'roster')

  // Click a tech in the roster to fit their daily route. The `seq`
  // bumps on every click so re-clicking the same tech re-centres the map.
  const [focusTech, setFocusTech] = useState<{ id: string; seq: number } | null>(() => requestedTechId ? { id: requestedTechId, seq: 1 } : null)
  // The tech whose day is open on the map (TechDayPanel).
  const [dayTechId, setDayTechId] = useState<string | null>(null)
  // Until the dispatcher acts, show the first technician with visits. Once
  // changed, expansion belongs to the dispatcher and polling cannot reopen it.
  const [expandedTechs, setExpandedTechs] = useState<Set<string> | null>(null)
  const focusOnTech = (id: string) => {
    setFocusTech((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }))
    setDayTechId(id)
    setExpandedTechs((previous) => new Set(previous ?? visibleExpandedTechs).add(id))
    if (focus) setFocusWorkspaceView('map')
    // On mobile, jump to the map so the focus actually shows.
    setMobileView('map')
  }
  const showAllTechs = () => {
    setFocusTech(null)
    setDayTechId(null)
  }

  useEffect(() => {
    if (requestedTechId) focusOnTech(requestedTechId)
    // Only react when navigation changes the requested technician.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTechId])

  // Right-click a tech → ping their phone for a fresh GPS fix ("Locate
  // now"). The phone answers through the normal positions channel, so the
  // roster freshness flips to "Just now" on its own when it responds.
  const [pingMenu, setPingMenu] = useState<{ x: number; y: number; tech: BoardTech } | null>(null)
  const [pinged, setPinged] = useState<Map<string, 'sending' | 'sent'>>(new Map())
  const pingTech = async (tech: BoardTech) => {
    setPingMenu(null)
    setPinged((m) => new Map(m).set(tech.id, 'sending'))
    try {
      await apiRequest(`/v1/dispatch/techs/${tech.id}/locate`, { method: 'POST' })
      setPinged((m) => new Map(m).set(tech.id, 'sent'))
      window.setTimeout(() => {
        setPinged((m) => {
          const n = new Map(m)
          n.delete(tech.id)
          return n
        })
      }, 30_000)
    } catch (e) {
      setPinged((m) => {
        const n = new Map(m)
        n.delete(tech.id)
        return n
      })
      alert(e instanceof Error ? e.message : 'Could not ping the phone.')
    }
  }

  const data = board.data?.data
  const jobs = data?.jobs ?? []
  const selectedTerritoryId = territoryId || data?.selected_territory_id || ''
  const techs = data?.techs ?? []

  const firstTechWithVisits = techs.find((tech) => jobs.some((job) => job.lead_tech_account_id === tech.id))
  const visibleExpandedTechs = expandedTechs ?? new Set(firstTechWithVisits ? [firstTechWithVisits.id] : [])

  // Merge the Reverb-pushed positions with the board payload — NEWEST fix
  // wins (a refetched board can be fresher than the last push if the socket
  // hiccuped). Board fixes get stamped with the fetch time so their age can
  // tick forward between polls.
  const boardFetchedAt = board.dataUpdatedAt
  const positionByAccount = useMemo(() => {
    const m = new Map<string, Position>()
    for (const t of techs) {
      if (t.position) m.set(t.id, { ...t.position, received_at: boardFetchedAt || undefined })
    }
    for (const [id, p] of livePositions) {
      const existing = m.get(id)
      m.set(id, existing ? bestFix(existing, p) : p)
    }
    return m
  }, [techs, livePositions, boardFetchedAt])

  const techsById = useMemo(() => {
    const m = new Map<string, BoardTech>()
    for (const t of techs) m.set(t.id, t)
    return m
  }, [techs])

  // A job sent to a sub isn't waiting on a tech of ours: it goes under
  // "Sent to subs", grouped by the company doing it.
  const unassigned = jobs.filter((j) => !j.lead_tech_account_id && !j.sub)
  const sentToSubs = useMemo(() => {
    const bySub = new Map<string, { name: string; jobs: BoardJob[] }>()
    for (const j of jobs) {
      if (!j.sub) continue
      const key = j.sub.subcontractor_id ?? j.sub.name
      const group = bySub.get(key) ?? { name: j.sub.name, jobs: [] }
      group.jobs.push(j)
      bySub.set(key, group)
    }
    return Array.from(bySub.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [jobs])
  const needsScheduling = data?.needs_scheduling ?? []
  // The MAP plots the selected date range (day/week/month/year) from the
  // lightweight map-jobs feed; the roster above stays on today's board.
  const mapJobs = mapBoard.data?.data?.jobs ?? []
  const mappableJobs = mapJobs.filter((j) => hasRouteCoordinates(j.location))
  const unmappableCount = mapJobs.length - mappableJobs.length

  // Auto-fill coordinates for in-view jobs that lack them, so the map populates
  // itself as you browse ranges — no manual backfill required.
  useLazyGeocode(mapJobs)

  return (
    <div data-tour="dispatch-root" data-focus-page="dispatch" data-easy-board="" className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row">
      {/* Mobile-only Roster / Map toggle. Hidden on md+ where both panes
          show side by side. */}
      <div data-tour="dispatch-mobile-toggle" className="md:hidden flex border-b border-slate-200 bg-white shrink-0">
        <button
          type="button"
          onClick={() => setMobileView('roster')}
          aria-pressed={mobileView === 'roster'}
          data-easy-view-option
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${
            mobileView === 'roster'
              ? 'border-amber-500 text-navy-900'
              : 'border-transparent text-slate-500'
          }`}
        >
          Roster
        </button>
        <button
          type="button"
          onClick={() => setMobileView('map')}
          aria-pressed={mobileView === 'map'}
          data-easy-view-option
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${
            mobileView === 'map'
              ? 'border-amber-500 text-navy-900'
              : 'border-transparent text-slate-500'
          }`}
        >
          Map
        </button>
      </div>

      {/* Left rail — full-width on mobile when roster is selected */}
      <aside
        className={`${
          mobileView === 'map' ? 'hidden' : 'flex'
        } md:flex w-full md:w-80 border-r border-slate-200 bg-white flex-col overflow-hidden shrink-0`}
      >
        <div data-tour="dispatch-header" className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-navy-900">Dispatch</h1>
            <span className="flex items-center gap-2">
              <Link data-tour="dispatch-link-routes" to="/dispatch/route-history" className="text-[11px] text-amber-700 hover:underline whitespace-nowrap">
                Routes →
              </Link>
              <Link data-tour="dispatch-link-field-review" to="/dispatch/field-review" className="text-[11px] text-amber-700 hover:underline whitespace-nowrap">
                Field review →
              </Link>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {data ? new Date(data.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Loading…'}
            {' · '}
            {jobs.length} job{jobs.length === 1 ? '' : 's'}
          </p>
          {(data?.territories.length ?? 0) > 0 && (
            <label data-tour="dispatch-territory" className="block mt-2">
              <span className="sr-only">Dispatch territory</span>
              <select
                value={selectedTerritoryId}
                onChange={(event) => setTerritoryId(event.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                {!data?.territory_restricted && <option value="">All territories</option>}
                {data?.territories.map((territory) => (
                  <option key={territory.id} value={territory.id}>{territory.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {focus && (
          <nav data-focus-dispatch-tabs data-tour="dispatch-rail-tabs" aria-label="Dispatch rail" className="flex gap-1 border-b border-slate-200 px-2 py-2">
            {([
              { key: 'crew', label: 'Crew', count: techs.length },
              { key: 'queue', label: 'To assign', count: unassigned.length + needsScheduling.length },
              { key: 'subs', label: 'Subs', count: sentToSubs.reduce((total, group) => total + group.jobs.length, 0) },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                data-tour={`dispatch-rail-${key}`}
                aria-pressed={focusRailSection === key}
                onClick={() => setFocusRailSection(key)}
                className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold"
              >
                {label} <span className="opacity-70 tabular-nums">{count}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Tech roster */}
          <section data-tour="dispatch-roster" data-focus-rail-active={focus ? String(focusRailSection === 'crew') : undefined} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Technicians ({techs.length})</span>
              <button type="button" onClick={showAllTechs} aria-pressed={!focusTech} className="rounded px-1.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">All technicians</button>
            </div>
            {board.isLoading && <p className="text-xs text-slate-400 italic">Loading…</p>}
            {board.isError && <p role="alert" className="text-xs text-rose-700">Dispatch data unavailable. <button type="button" onClick={() => board.refetch()} className="underline">Try again</button></p>}
            {board.isSuccess && techs.length === 0 && (
              <p className="text-xs text-slate-400 italic">No staff accounts found.</p>
            )}
            <ul className="space-y-1.5">
              {techs.map((t) => {
                const pos = positionByAccount.get(t.id) ?? null
                const liveAge = liveAgeSeconds(pos, nowMs)
                const f = freshness(liveAge)
                const ws = WORK_STATUS_META[t.work_status] ?? WORK_STATUS_META.idle
                const visits = assignedVisits(jobs, t.id)
                const expanded = visibleExpandedTechs.has(t.id)
                return (
                  <li
                    key={t.id}
                    data-tour="dispatch-tech-row"
                    data-gps={liveAge == null ? 'none' : liveAge <= 90 ? 'live' : 'recent'}
                    className={`rounded-lg border overflow-hidden ${focusTech?.id === t.id ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center">
                    <button type="button" onClick={() => focusOnTech(t.id)} aria-pressed={focusTech?.id === t.id}
                      aria-label={`Show ${t.name}'s visits and route on map`}
                      onContextMenu={(e) => { e.preventDefault(); setPingMenu({ x: e.clientX, y: e.clientY, tech: t }) }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                      title="Show visits and route · right-click to ping the phone">
                    {/* Dot = workload (open / scheduled / on a job). */}
                    <span
                      className={['w-2.5 h-2.5 rounded-full shrink-0', ws.dot].join(' ')}
                      title={ws.label}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{t.name}</div>
                      <div className="text-[11px]">
                        <span className="text-slate-600">{ws.label}</span>
                        <span className="text-slate-300"> · </span>
                        {/* GPS freshness lives in the text line — and whether
                            the app was on screen for that fix. */}
                        <span className={f.text}>{f.label}</span>
                        {appStateLabel(pos, liveAge) && (
                          <span className={pos?.app_state === 'open' ? 'text-emerald-700' : 'text-slate-500'}> · {appStateLabel(pos, liveAge)}</span>
                        )}
                        {/* Speed only when the fix is FRESH and above the jitter
                            floor — a parked phone can read a phantom 2-4 mph. */}
                        {pos?.speed_mph != null &&
                          pos.speed_mph >= MIN_MOVING_MPH &&
                          liveAge != null &&
                          liveAge <= 90 && (
                            <span className="text-slate-400"> · {Math.round(pos.speed_mph)} mph</span>
                          )}
                        {pos?.battery_pct != null && pos.battery_pct <= 20 && (
                          <span className="text-red-600"> · {pos.battery_pct}% battery</span>
                        )}
                        {pinged.get(t.id) && (
                          <span className="text-amber-600 font-medium">
                            {' · '}{pinged.get(t.id) === 'sending' ? 'pinging…' : 'pinged ✓'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {(() => {
                        const a = t.assessment_count ?? 0
                        const jobsOnly = t.job_count - a
                        return a > 0
                          ? `${jobsOnly} job${jobsOnly === 1 ? '' : 's'} · ${a} assess.`
                          : `${t.job_count} job${t.job_count === 1 ? '' : 's'}`
                      })()}
                    </span>
                    </button>
                    <button type="button" aria-expanded={expanded} aria-controls={`dispatch-visits-${t.id}`}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${t.name}'s visits`}
                      onClick={() => setExpandedTechs((previous) => { const next = new Set(previous ?? visibleExpandedTechs); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next })}
                      className="self-stretch px-2.5 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
                      <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
                    </button>
                    </div>
                    <div id={`dispatch-visits-${t.id}`} hidden={!expanded} className="border-t border-slate-100 px-2 py-2">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Today's visits · includes overdue</p>
                      {visits.length === 0 ? <p className="py-1 text-xs text-slate-500">No scheduled visits on this board.</p> : (
                        <ol className="space-y-1">
                          {visits.map((visit) => {
                            const scheduled = visit.scheduled_start_at ? new Date(visit.scheduled_start_at) : null
                            const validDate = scheduled && !Number.isNaN(scheduled.getTime()) ? scheduled : null
                            const dateLabel = validDate && format(validDate, 'yyyy-MM-dd') !== data?.date ? format(validDate, 'MMM d') : null
                            return <li key={`${visit.kind ?? 'job'}:${visit.id}`}>
                              <Link to={visit.kind === 'estimate' ? `/estimates/${visit.id}` : `/jobs/${visit.id}`} className="block rounded-md px-2 py-1.5 text-xs hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="font-semibold tabular-nums text-slate-700">{dateLabel && `${dateLabel} · `}{validDate ? format(validDate, 'h:mm a') : 'Time not set'}</span>
                                  <span className="text-[10px] text-slate-500">{visit.kind === 'estimate' ? 'Assessment' : 'Job'} {visit.display_number ?? visit.work_order_number ?? ''}</span>
                                </div>
                                <div className="mt-0.5 truncate font-medium text-slate-900">{visit.title || (visit.kind === 'estimate' ? 'Assessment' : 'Work order')}</div>
                                {visit.customer_name && <div className="truncate text-[11px] text-slate-500">{visit.customer_name}</div>}
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                                  <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dispatchJobAppearance(visit).color }} />{dispatchJobAppearance(visit).label}</span>
                                  {!hasRouteCoordinates(visit.location) && <span>No map coordinates</span>}
                                </div>
                              </Link>
                            </li>
                          })}
                        </ol>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Unassigned jobs */}
          <section data-tour="dispatch-unassigned" data-count={board.isSuccess ? unassigned.length : undefined} data-focus-rail-active={focus ? String(focusRailSection === 'queue') : undefined} className="px-4 py-3 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
              Unassigned today ({board.isSuccess ? unassigned.length : '—'})
            </div>
            {board.isSuccess && unassigned.length === 0 && (
              <p className="text-xs text-slate-400 italic">Every job today has a tech. 🎉</p>
            )}
            <ul className="space-y-1.5">
              {board.isSuccess && unassigned.map((j) =>
                j.kind === 'estimate' ? (
                  // Assessments assign a tech on the estimate itself — the
                  // suggest-tech modal is work-order-only, so route there.
                  <li key={j.id}>
                    <Link
                      data-tour="dispatch-assessment"
                      to={`/estimates/${j.id}`}
                      className="block px-2 py-1.5 rounded-md border border-sky-200 bg-sky-50/60 hover:bg-sky-100"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-sky-700 bg-sky-100 rounded px-1 py-px">
                          Assessment
                        </span>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {j.title || `Estimate ${j.display_number ?? ''}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {j.customer_name ?? '—'}
                        {j.location?.address ? ` · ${j.location.address}` : ''}
                      </div>
                      <div className="text-[11px] text-sky-700 font-medium mt-0.5">
                        Open assessment →
                      </div>
                    </Link>
                  </li>
                ) : (
                  <li key={j.id}>
                    <button
                      type="button"
                      data-tour="dispatch-suggest-open"
                      onClick={() => setSuggestJobId(j.id)}
                      className="w-full text-left px-2 py-1.5 rounded-md border border-amber-200 bg-amber-50/60 hover:bg-amber-100"
                    >
                      <div className="flex items-center gap-1.5">
                        {j.job_type && <JobTypeChip color={j.job_type.color} icon={j.job_type.icon} size={20} />}
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {j.title || `WO ${j.display_number ?? j.work_order_number ?? ''}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {j.customer_name ?? '—'}
                        {j.location?.address ? ` · ${j.location.address}` : ''}
                      </div>
                      {j.bill_to_name && (
                        <div className="mt-0.5">
                          <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            {j.bill_to_name}
                          </span>
                        </div>
                      )}
                      <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                        Suggest a tech →
                      </div>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>

          {/* Sent to subs: today's jobs other companies are doing for us,
              by company, with their tech and where they're at. */}
          {sentToSubs.length > 0 && (
            <section data-tour="dispatch-subs" data-focus-rail-active={focus ? String(focusRailSection === 'subs') : undefined} className="px-4 py-3 border-t border-slate-100" aria-labelledby="dispatch-sent-to-subs">
              <div id="dispatch-sent-to-subs" className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
                Sent to subs ({sentToSubs.reduce((n, g) => n + g.jobs.length, 0)})
              </div>
              <div className="space-y-2">
                {sentToSubs.map((group) => (
                  <div key={group.name}>
                    <div className="text-xs font-semibold text-slate-800 truncate">{group.name}</div>
                    <ul className="mt-1 space-y-1">
                      {group.jobs.map((j) => (
                        <li key={j.id}>
                          <Link to={`/jobs/${j.id}`} className="block rounded-md border border-slate-200 px-2 py-1.5 hover:bg-slate-50">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">
                                {j.title || `WO ${j.display_number ?? j.work_order_number ?? ''}`}
                              </span>
                              {j.sub && (
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SUB_STATE_CLASS[j.sub.state]}`}>{j.sub.label}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              {j.scheduled_start_at ? new Date(j.scheduled_start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'No time'}
                              {j.sub?.tech_name ? ` · ${j.sub.tech_name}` : ''}
                              {j.customer_name ? ` · ${j.customer_name}` : ''}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Needs scheduling: accepted requests and anything else entered
              without a date. Without this lane these lived only on the
              customer's account, which is where they went "missing". */}
          {needsScheduling.length > 0 && (
            <section data-tour="dispatch-needs-scheduling" data-focus-rail-active={focus ? String(focusRailSection === 'queue') : undefined} className="px-4 py-3 border-t border-slate-100">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
                Needs scheduling ({needsScheduling.length})
              </div>
              <ul className="space-y-1.5">
                {needsScheduling.map((n) => (
                  <li key={`${n.kind}-${n.id}`}>
                    <Link
                      to={n.kind === 'estimate' ? `/estimates/${n.id}` : `/jobs/${n.id}`}
                      className={`block px-2 py-1.5 rounded-md border ${n.kind === 'estimate' ? 'border-sky-200 bg-sky-50/60 hover:bg-sky-100' : 'border-violet-200 bg-violet-50/60 hover:bg-violet-100'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wide rounded px-1 py-px ${n.kind === 'estimate' ? 'text-sky-700 bg-sky-100' : 'text-violet-700 bg-violet-100'}`}>
                          {n.kind === 'estimate' ? 'Estimate' : 'Job'}
                        </span>
                        {n.from_portal && (
                          <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1 py-px text-emerald-700 bg-emerald-100">
                            Portal
                          </span>
                        )}
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {n.title || n.number}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {n.customer?.display_name ?? '—'}
                        {n.address ? ` · ${n.address}` : ''}
                      </div>
                      <div className={`text-[11px] font-medium mt-0.5 ${n.kind === 'estimate' ? 'text-sky-700' : 'text-violet-700'}`}>
                        {n.kind === 'estimate' ? 'Schedule the visit →' : 'Schedule it →'}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {focus && focusRailSection === 'subs' && sentToSubs.length === 0 && (
            <p className="px-4 py-5 text-sm text-slate-500">No jobs are assigned to subs today.</p>
          )}
        </div>

        {unmappableCount > 0 && (
          <div data-tour="dispatch-unmappable" className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500">
            {unmappableCount} job{unmappableCount === 1 ? '' : 's'} not on the map — no saved coordinates.
          </div>
        )}
      </aside>

      {/* Right-click context menu: ping a tech's phone for a fresh fix. */}
      {pingMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setPingMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setPingMenu(null)
          }}
        >
          <div
            className="absolute bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-60"
            style={{
              left: Math.min(pingMenu.x, window.innerWidth - 250),
              top: Math.min(pingMenu.y, window.innerHeight - 120),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">
              {pingMenu.tech.name}
            </div>
            <button
              type="button"
              onClick={() => pingTech(pingMenu.tech)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              📍 Ping phone for fresh location
            </button>
            <Link
              to={`/dispatch/route-history?account=${encodeURIComponent(pingMenu.tech.id)}`}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              🗺️ Route history
            </Link>
          </div>
        </div>
      )}

      {focus && focusWorkspaceView === 'board' && (
        <main data-focus-dispatch-board className="hidden md:flex flex-1 min-w-0 flex-col overflow-hidden bg-slate-50">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900">Dispatch board</h1>
              <p className="text-xs text-slate-500">Assign work, scan today's schedule, and open the map when you need it.</p>
            </div>
            <button type="button" onClick={() => setFocusWorkspaceView('map')} className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Open live map
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 xl:p-5">
            <div data-focus-dispatch-metrics className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div><strong>{board.isSuccess ? jobs.length : '—'}</strong><span>Today's visits</span></div>
              <div><strong>{board.isSuccess ? unassigned.length : '—'}</strong><span>Need a technician</span></div>
              <div><strong>{board.isSuccess ? needsScheduling.length : '—'}</strong><span>Need a date</span></div>
              <div><strong>{board.isSuccess ? techs.filter((tech) => tech.work_status === 'idle').length : '—'}</strong><span>Available crew</span></div>
            </div>
            {board.isError && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Could not refresh the dispatch board. <button type="button" onClick={() => { void board.refetch() }} className="font-semibold underline">Retry</button>
              </div>
            )}
            <div data-focus-dispatch-columns className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(250px,0.8fr)]">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Today's work</h2>
                  <span className="text-xs text-slate-500">{data?.date ?? 'Today'}</span>
                </div>
                {board.isLoading ? (
                  <p role="status" className="p-4 text-sm text-slate-500">Loading today's work…</p>
                ) : jobs.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No visits on today's board.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {[...jobs].sort((a, b) => (a.scheduled_start_at ?? '').localeCompare(b.scheduled_start_at ?? '')).map((job) => (
                      <div key={`${job.kind ?? 'job'}-${job.id}`} data-focus-dispatch-job className="flex items-center gap-3 px-4 py-3">
                        <div className="w-14 shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                          {job.scheduled_start_at ? format(new Date(job.scheduled_start_at), 'h:mm a') : '—'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link to={job.kind === 'estimate' ? `/estimates/${job.id}` : `/jobs/${job.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-amber-700">
                            {job.title || (job.kind === 'estimate' ? `Estimate ${job.display_number ?? ''}` : `Job ${job.display_number ?? job.work_order_number ?? ''}`)}
                          </Link>
                          <div className="truncate text-xs text-slate-500">{job.customer_name ?? 'Customer not listed'}{job.location?.address ? ` · ${job.location.address}` : ''}</div>
                        </div>
                        <div className="hidden min-w-24 max-w-36 truncate text-xs text-slate-600 lg:block">{job.lead_tech_name ?? (job.sub ? `Sub: ${job.sub.name}` : 'Unassigned')}</div>
                        {job.lead_tech_account_id || job.sub ? (
                          <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 lg:inline">{job.status?.name ?? 'Scheduled'}</span>
                        ) : job.kind === 'estimate' ? (
                          <Link to={`/estimates/${job.id}`} className="shrink-0 rounded-md border border-sky-200 px-2 py-1 text-xs font-semibold text-sky-800">Open</Link>
                        ) : (
                          <button type="button" onClick={() => setSuggestJobId(job.id)} className="shrink-0 rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400">Assign</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="min-w-0 space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">Crew availability</h2>
                  <div className="mt-2 space-y-1">
                    {techs.length === 0 && <p className="text-xs text-slate-500">No crew on this board.</p>}
                    {techs.map((tech) => (
                      <button key={tech.id} type="button" onClick={() => focusOnTech(tech.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50">
                        <span className="truncate text-sm font-medium text-slate-800">{tech.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{WORK_STATUS_META[tech.work_status].label} · {tech.job_count} visits</span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">Incoming requests</h2>
                  <div className="mt-2 max-h-72 overflow-y-auto"><IncomingRequestsPanel /><IncomingEstimateRequestsPanel /></div>
                </section>
                <Link to="/schedule" className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-50">Open scheduling calendar →</Link>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Map — full-width on mobile when map is selected */}
      <div
        data-tour="dispatch-map"
        className={`${
          mobileView === 'roster' ? 'hidden' : 'block'
        } ${focus && focusWorkspaceView === 'board' ? 'md:hidden' : 'md:block'} flex-1 relative`}
      >
        {focus && focusWorkspaceView === 'map' && (
          <button type="button" onClick={() => { setFocusWorkspaceView('board'); setMobileView('roster') }} className="absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow md:block">
            Dispatch board
          </button>
        )}
        {(!focus || focusWorkspaceView === 'map' || mobileView === 'map') && (
          <>
        {/* Floating incoming-requests + estimate-RFQ panels — both hide when
            empty. Sit BELOW the Day/Week/Month/Year toggle (top-3 left-3) and
            clear of the legend on the right; scroll inside their own box so a
            busy morning doesn't paper over the whole map. */}
        <div className="absolute top-14 left-3 right-3 md:right-48 z-10 pointer-events-none">
          <div data-tour="dispatch-incoming" className="pointer-events-auto max-w-2xl max-h-[60vh] overflow-y-auto rounded-xl">
            <IncomingRequestsPanel />
            <IncomingEstimateRequestsPanel />
          </div>
        </div>

        <DispatchMap
          dayTechId={dayTechId}
          onOpenDay={(id) => { if (id) focusOnTech(id); else setDayTechId(null) }}
          onShowAll={showAllTechs}
          jobs={mapJobs}
          jobsLoading={mapBoard.isLoading}
          jobsError={mapBoard.isError}
          positions={positionByAccount}
          techsById={techsById}
          focusTech={focusTech}
          range={mapRange}
          onRangeChange={setMapRange}
          nowMs={nowMs}
        />
        {board.isError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-1.5 rounded shadow">
            {(board.error as Error).message}
          </div>
        )}
          </>
        )}
      </div>

      {suggestJobId && (
        <SuggestTechModal
          jobId={suggestJobId}
          job={jobs.find((j) => j.id === suggestJobId) ?? null}
          onClose={() => setSuggestJobId(null)}
        />
      )}
    </div>
  )
}

// ---------- Suggest-a-tech modal ----------

/**
 * Exported so the dashboard's Dispatch tab can open the SAME assign flow
 * instead of carrying a second copy of the suggestion ranking, the drive-time
 * re-rank and the approved-time-off prompt.
 *
 * `job` is only read for its scheduled date (the time-off conflict window), so
 * the prop is the narrow Pick rather than a full BoardJob — the dashboard's
 * queue jobs aren't board jobs and have no schedule yet.
 */
export function SuggestTechModal({
  jobId,
  job,
  onClose,
}: {
  jobId: string
  job: Pick<BoardJob, 'scheduled_start_at'> | null
  onClose: () => void
}) {
  const qc = useQueryClient()

  const suggest = useQuery({
    queryKey: ['dispatch-suggest', jobId],
    queryFn: () =>
      apiRequest<{
        data: {
          work_order: {
            id: string
            title: string | null
            display_number: string | null
            lead_tech_account_id: string | null
            has_location: boolean
            latitude: number | null
            longitude: number | null
            address: string | null
          }
          suggestions: Suggestion[]
        }
      }>(`/v1/dispatch/suggest/${jobId}`),
  })

  const assign = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest(`/v1/work-orders/${jobId}`, {
        method: 'PATCH',
        body: { lead_tech_account_id: accountId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispatch-board'] })
      onClose()
    },
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const wo = suggest.data?.data.work_order
  const suggestions = suggest.data?.data.suggestions ?? []

  // Real drive-time (minutes) per tech → one Distance Matrix call (all techs
  // with GPS → the job), on the browser key. Upgrades the straight-line rank.
  const [driveMin, setDriveMin] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    if (wo?.latitude == null || wo?.longitude == null) return
    const origins = suggestions.filter((s) => s.lat != null && s.lng != null)
    if (origins.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const g = await loadGoogleMaps()
        const { DistanceMatrixService } = (await g.maps.importLibrary('routes')) as google.maps.RoutesLibrary
        const res = await new DistanceMatrixService().getDistanceMatrix({
          origins: origins.map((s) => ({ lat: s.lat as number, lng: s.lng as number })),
          destinations: [{ lat: wo.latitude as number, lng: wo.longitude as number }],
          travelMode: g.maps.TravelMode.DRIVING,
        })
        if (cancelled) return
        const next = new Map<string, number>()
        res.rows.forEach((row, i) => {
          const el = row.elements?.[0]
          if (el?.duration?.value != null) next.set(origins[i].account_id, Math.round(el.duration.value / 60))
        })
        setDriveMin(next)
      } catch {
        // Distance Matrix unavailable — keep the straight-line order.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest.data])

  // Re-rank: techs with a known drive-time sort by it (closest first); the
  // rest keep the backend's availability + straight-line order, after them.
  const ranked = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      const da = driveMin.get(a.account_id)
      const db = driveMin.get(b.account_id)
      if (da != null && db != null) return da - db
      if (da != null) return -1
      if (db != null) return 1
      return 0
    })
  }, [suggestions, driveMin])

  const assignWithTimeOffCheck = async (suggestion: Suggestion) => {
    const scheduledDate = scheduledDateForJob(job)
    if (scheduledDate) {
      try {
        const conflicts = await fetchApprovedTimeOff(suggestion.account_id, scheduledDate, scheduledDate)
        if (!confirmTimeOffAssignment(suggestion.name, conflicts, 'Assign this job')) return
      } catch (error) {
        // A dispatcher who can't see staff time off (403) assigns as before; other failures ask.
        if (!continueAfterFailedConflictCheck(error, 'tech time off')) return
      }
    }
    assign.mutate(suggestion.account_id)
  }

  return (
    <Modal isOpen onClose={onClose} title="Suggest a tech" size="sm"
      subtitle={wo ? `${wo.title || `WO ${wo.display_number ?? ''}`}${wo.address ? ` · ${wo.address}` : ''}` : 'Loading…'}>
        <Modal.Body>
          <div data-tour="dispatch-suggest">
          {suggest.isLoading && <p className="text-sm text-slate-500">Ranking technicians…</p>}
          {suggest.isError && (
            <div role="alert" className="text-sm text-red-700">
              Could not load technician suggestions.
              <button type="button" onClick={() => { void suggest.refetch() }} disabled={suggest.isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
            </div>
          )}

          {wo && !wo.has_location && (
            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
              ⚠ This job has no saved coordinates — techs are ranked by availability only,
              not distance.
            </div>
          )}

          {suggest.isSuccess && suggestions.length === 0 && (
            <p className="text-sm text-slate-500 italic">No technicians on the roster.</p>
          )}

          <ul data-tour="dispatch-suggest-list" className="space-y-1.5">
            {suggest.isSuccess && ranked.map((s, i) => (
              <li
                key={s.account_id}
                className={[
                  'flex items-center gap-3 px-3 py-2 rounded-lg border',
                  i === 0 ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    i === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {s.name}
                    {wo?.lead_tech_account_id === s.account_id && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                        current
                      </span>
                    )}
                  </div>
                  <div
                    className={[
                      'text-[11px]',
                      s.available_now ? 'text-emerald-700' : 'text-amber-700',
                    ].join(' ')}
                  >
                    {s.reason}
                    {driveMin.get(s.account_id) != null && (
                      <span className="text-slate-700 font-medium"> · {driveMin.get(s.account_id)} min drive</span>
                    )}
                    {s.jobs_today > 0 && (
                      <span className="text-slate-400"> · {s.jobs_today} today</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  data-tour="dispatch-suggest-assign"
                  onClick={() => { void assignWithTimeOffCheck(s) }}
                  disabled={assign.isPending || wo?.lead_tech_account_id === s.account_id}
                  className="text-xs px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-40 shrink-0"
                >
                  {assign.isPending ? '…' : 'Assign'}
                </button>
              </li>
            ))}
          </ul>

          {assign.isError && (
            <p role="alert" className="text-xs text-red-700 mt-2">{(assign.error as Error).message}</p>
          )}
          </div>
        </Modal.Body>

        <Modal.Footer className="justify-between">
          <span className="text-[11px] text-slate-500">
            Ranked by distance + availability
          </span>
          <Link
            data-tour="dispatch-suggest-job"
            to={`/jobs/${jobId}`}
            className="text-xs text-amber-700 hover:underline font-medium"
          >
            Open job →
          </Link>
        </Modal.Footer>
    </Modal>
  )
}

// ---------- Map ----------

// Per-tech route colors (day view). Cycled so each tech's path is distinct.
const ROUTE_COLORS = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04']

// Map overlay layers the dispatcher can toggle (persisted per browser).
type MapLayers = { techs: boolean; jobs: boolean; routes: boolean; traffic: boolean; checks: boolean }
const LAYERS_KEY = 'crewbarn.dispatchMap.layers'
const DEFAULT_LAYERS: MapLayers = { techs: true, jobs: true, routes: true, traffic: false, checks: true }
function loadMapLayers(): MapLayers {
  try {
    const raw = localStorage.getItem(LAYERS_KEY)
    return raw ? { ...DEFAULT_LAYERS, ...(JSON.parse(raw) as Partial<MapLayers>) } : { ...DEFAULT_LAYERS }
  } catch {
    return { ...DEFAULT_LAYERS }
  }
}

function DispatchMap({
  dayTechId,
  onOpenDay,
  onShowAll,
  jobs,
  jobsLoading,
  jobsError,
  positions,
  techsById,
  focusTech,
  range,
  onRangeChange,
  nowMs,
}: {
  /** The tech whose day is open (TechDayPanel); a marker click or the roster opens it. */
  dayTechId: string | null
  onOpenDay: (techId: string | null) => void
  onShowAll: () => void
  jobs: BoardJob[]
  jobsLoading: boolean
  jobsError: boolean
  positions: Map<string, Position>
  techsById: Map<string, BoardTech>
  /** Bumps each time the dispatcher clicks a tech in the roster. */
  focusTech: { id: string; seq: number } | null
  range: MapRange
  onRangeChange: (r: MapRange) => void
  /** 15s ticker from the parent — advances marker ages/dimming live. */
  nowMs: number
}) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const jobMarkers = useRef<Map<string, google.maps.Marker>>(new Map())
  const jobClusterer = useRef<MarkerClusterer | null>(null)
  const techMarkers = useRef<Map<string, TechAvatarMarker>>(new Map())
  const directionsSvc = useRef<google.maps.DirectionsService | null>(null)
  const routeDrawings = useRef<Map<string, { key: string; color: string; renderers: google.maps.DirectionsRenderer[]; points: RoutePoint[]; hasOrigin: boolean }>>(new Map())
  const [routeStates, setRouteStates] = useState<Record<string, 'loading' | 'ready' | 'error'>>({})
  const [routeOrigins, setRouteOrigins] = useState<Record<string, boolean>>({})
  const [routeRevision, setRouteRevision] = useState(0)
  const routeGeneration = useRef(0)
  const routeRequests = useRef(new Map<string, number>())
  const selectedTechId = focusTech?.id ?? null
  const selectedTechRef = useRef(selectedTechId)
  useLayoutEffect(() => { selectedTechRef.current = selectedTechId }, [selectedTechId])
  // A stable primitive prevents board polls and GPS renders from issuing the same Directions requests.
  const routePlanKey = JSON.stringify(jobs.map((job) => [job.kind, job.id, job.lead_tech_account_id, job.scheduled_start_at, job.status?.category, job.location?.latitude, job.location?.longitude]).sort())
  const selectedPlan = selectedTechId ? routePlanForTech(jobs, selectedTechId) : null
  const trafficLayer = useRef<google.maps.TrafficLayer | null>(null)
  // Once the user pans/zooms, the viewport is theirs — auto-fit stands down
  // until the date range changes. Until then we keep fitting as pins land
  // (lazy geocoding fills coordinates in over several seconds).
  const userMoved = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [layers, setLayers] = useState<MapLayers>(loadMapLayers)
  // Location checks: "is this the job's address?" when a tech starts a job
  // or estimate on the phone. A dot each, today; click for the details.
  const [openCheck, setOpenCheck] = useState<FieldEncounterRow | null>(null)
  const checkMarkers = useRef<google.maps.Marker[]>([])
  const checksQ = useQuery({
    queryKey: FIELD_ENCOUNTERS_KEY,
    queryFn: () => fetchFieldEncounters(),
    refetchInterval: 60_000,
    enabled: layers.checks,
  })
  const layersRef = useRef(layers)
  useEffect(() => {
    layersRef.current = layers
    try { localStorage.setItem(LAYERS_KEY, JSON.stringify(layers)) } catch { /* ignore */ }
  }, [layers])

  // Jobs (and their techs) predicted to be late → ⚠ above the job pin + red tech
  // pill. Mirror of the server at_risk heuristic; recomputes on each GPS poll.
  const atRiskSets = useMemo(() => {
    const now = nowMs
    const jobsSet = new Set<string>()
    const techsSet = new Set<string>()
    for (const j of jobs) {
      const techId = j.lead_tech_account_id
      if (!techId) continue
      const cat = j.status?.category
      if (cat === 'in_progress' || cat === 'complete') continue
      if (!j.scheduled_start_at || j.location?.latitude == null || j.location?.longitude == null) continue
      const startMs = new Date(j.scheduled_start_at).getTime()
      if (Number.isNaN(startMs)) continue
      const minsToStart = (startMs - now) / 60000
      if (minsToStart <= 0 || minsToStart > AT_RISK_LEAD_MIN) continue
      const pos = positions.get(techId)
      if (!pos) continue
      const etaMin = (haversineMiles(pos.latitude, pos.longitude, j.location.latitude, j.location.longitude) / 30) * 60
      if (etaMin > minsToStart + AT_RISK_BUFFER_MIN) {
        jobsSet.add(j.id)
        techsSet.add(techId)
      }
    }
    return { jobs: jobsSet, techs: techsSet }
  }, [jobs, positions, nowMs])

  // Lasso bulk-assign: draw a box → select the jobs inside → assign all to one
  // tech. The drawing manager is created once the map is ready (effect below).
  const qc = useQueryClient()
  const lassoRect = useRef<google.maps.Rectangle | null>(null)
  const jobsRef = useRef(jobs)
  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])
  const [lassoMode, setLassoMode] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [assignTo, setAssignTo] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Init the map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const g = await loadGoogleMaps()
        if (cancelled || !mapEl.current) return
        const { Map } = (await g.maps.importLibrary('maps')) as google.maps.MapsLibrary
        const { InfoWindow } = (await g.maps.importLibrary('maps')) as google.maps.MapsLibrary
        mapRef.current = new Map(mapEl.current, {
          center: { lat: 39.5, lng: -98.35 }, // US centroid until we have points
          zoom: 4,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        })
        // Hand the viewport to the user on their first pan/zoom. Wheel +
        // dblclick catch zooming (programmatic fitBounds also fires
        // zoom_changed, so that event can't be trusted for "user did it").
        mapRef.current.addListener('dragstart', () => {
          userMoved.current = true
        })
        mapEl.current.addEventListener('wheel', () => {
          userMoved.current = true
        }, { passive: true })
        mapRef.current.addListener('dblclick', () => {
          userMoved.current = true
        })
        infoRef.current = new InfoWindow()
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // A new range is a fresh viewport request — auto-fit takes over again.
  useEffect(() => {
    userMoved.current = false
  }, [range])

  // Layer: live traffic overlay.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (layers.traffic) {
      if (!trafficLayer.current) trafficLayer.current = new google.maps.TrafficLayer()
      trafficLayer.current.setMap(mapRef.current)
    } else {
      trafficLayer.current?.setMap(null)
    }
  }, [ready, layers.traffic])

  // Layer toggle: show/hide tech markers (jobs are owned by the clusterer).
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    for (const m of techMarkers.current.values()) m.setMap(layers.techs ? map : null)
  }, [ready, layers.techs])

  // Location check dots: green yes, amber no, grey not answered.
  useEffect(() => {
    for (const m of checkMarkers.current) m.setMap(null)
    checkMarkers.current = []
    const map = mapRef.current
    if (!ready || !map || !layers.checks) return
    for (const c of checksQ.data ?? []) {
      const marker = new google.maps.Marker({
        map,
        position: { lat: c.latitude, lng: c.longitude },
        zIndex: 900,
        title: `${c.tech?.name ?? 'Tech'} · ${encounterTime(c)} · ${encounterAnswerLabel(c)}`,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: encounterColor(c), fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
      })
      marker.addListener('click', () => {
        onOpenDay(null)
        setOpenCheck(c)
      })
      checkMarkers.current.push(marker)
    }
  }, [ready, layers.checks, checksQ.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Opening a tech's day (roster, marker) closes a check that was open.
  useEffect(() => {
    if (dayTechId) setOpenCheck(null)
  }, [dayTechId])

  // Lasso bulk-assign. Google removed DrawingManager in Maps JS 3.65, so this
  // is a two-click box: click one corner, then the opposite corner. Active only
  // while lasso mode is on; jobs inside the box are selected + the panel opens.
  useEffect(() => {
    if (!ready || !mapRef.current || !lassoMode) return
    const map = mapRef.current
    let firstCorner: google.maps.LatLng | null = null
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      if (!firstCorner) {
        firstCorner = e.latLng
        return
      }
      const bounds = new google.maps.LatLngBounds()
      bounds.extend(firstCorner)
      bounds.extend(e.latLng)
      lassoRect.current?.setMap(null)
      lassoRect.current = new google.maps.Rectangle({
        bounds,
        map,
        fillColor: '#2563eb',
        fillOpacity: 0.08,
        strokeColor: '#2563eb',
        strokeWeight: 2,
        clickable: false,
        zIndex: 1,
      })
      const picked: string[] = []
      for (const j of jobsRef.current) {
        const lat = j.location?.latitude
        const lng = j.location?.longitude
        if (lat == null || lng == null) continue
        if (bounds.contains({ lat, lng })) picked.push(j.id)
      }
      setSelectedJobIds(picked)
      firstCorner = null
      setLassoMode(false)
    })
    return () => listener.remove()
  }, [ready, lassoMode])

  // Sync job markers when the job list changes.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    const seen = new Set<string>()
    const selectedStops = selectedTechId && range === 'day' ? routePlanForTech(jobs, selectedTechId).remaining.filter((job) => hasRouteCoordinates(job.location)) : []
    const stopNumbers = new Map(selectedStops.map((job, index) => [`${job.kind ?? 'job'}:${job.id}`, index + 1]))

    for (const j of jobs) {
      if (!hasRouteCoordinates(j.location)) continue
      seen.add(j.id)
      const pos = { lat: j.location!.latitude!, lng: j.location!.longitude! }
      const appearance = dispatchJobAppearance(j)
      const color = appearance.color
      let marker = jobMarkers.current.get(j.id)
      if (!marker) {
        marker = new google.maps.Marker({ position: pos })
        marker.addListener('click', () => {
          if (!infoRef.current) return
          // Payments and status can change between board polls; do not show
          // the job snapshot captured when this marker was first created.
          const currentJob = jobsRef.current.find((job) => job.id === j.id && job.kind === j.kind) ?? j
          const currentAppearance = dispatchJobAppearance(currentJob)
          infoRef.current.setContent(
            `<div style="font:13px system-ui;max-width:220px">
               ${currentJob.kind === 'estimate' ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#0369a1">Assessment</div>` : ''}
               <div style="font-weight:600">${escapeHtml(currentJob.title || (currentJob.kind === 'estimate' ? 'Assessment' : 'Work order'))}</div>
               <div style="color:#475569">${escapeHtml(currentJob.customer_name ?? '')}</div>
               ${currentJob.bill_to_name ? `<div style="margin-top:2px"><span style="background:#eef2ff;color:#4338ca;font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px">${escapeHtml(currentJob.bill_to_name)}</span></div>` : ''}
               <div style="color:#64748b;font-size:12px">${escapeHtml(currentJob.location?.address ?? '')}</div>
               <div style="margin-top:4px;font-size:12px">
                 <span style="color:${currentAppearance.color}">●</span> ${escapeHtml(currentAppearance.label)}
                 ${currentJob.lead_tech_name ? ` · ${escapeHtml(currentJob.lead_tech_name)}` : ' · <em>unassigned</em>'}
               </div>
             </div>`,
          )
          infoRef.current.setPosition(pos)
          infoRef.current.open(map)
        })
        jobMarkers.current.set(j.id, marker)
      }
      marker.setPosition(pos)
      const jobAtRisk = atRiskSets.jobs.has(j.id)
      const stopNumber = stopNumbers.get(`${j.kind ?? 'job'}:${j.id}`)
      const markerLabel = j.title || (j.kind === 'estimate' ? 'Assessment' : 'Work order')
      marker.setTitle(`${stopNumber ? `Stop ${stopNumber} · ` : ''}${markerLabel} — ${appearance.label}${jobAtRisk ? ' — tech may be late' : ''}`)
      marker.setLabel(stopNumber ? { text: String(stopNumber), color: '#ffffff', fontSize: '10px', fontWeight: '700' } : null)
      marker.setZIndex(stopNumber ? 700 : jobAtRisk ? 600 : null)
      marker.setIcon(
        jobAtRisk
          ? atRiskJobIcon(color)
          : {
              path: google.maps.SymbolPath.CIRCLE,
              scale: stopNumber ? 11 : 8,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
      )
    }

    // Drop markers for jobs no longer present.
    for (const [id, marker] of jobMarkers.current) {
      if (!seen.has(id)) {
        marker.setMap(null)
        jobMarkers.current.delete(id)
      }
    }

    // Auto-fit to the plotted jobs — and KEEP fitting as lazy geocoding adds
    // pins — until the user pans/zooms (their viewport wins until the range
    // changes). A lone pin gets a sane city zoom; fitBounds on a single
    // point slams to max zoom (a wall of green).
    if (!focusTech && !userMoved.current && jobs.length > 0) {
      const pts: google.maps.LatLngLiteral[] = []
      for (const j of jobs) {
        if (hasRouteCoordinates(j.location)) {
          pts.push({ lat: j.location!.latitude!, lng: j.location!.longitude! })
        }
      }
      if (pts.length === 1) {
        map.setCenter(pts[0])
        map.setZoom(12)
      } else if (pts.length > 1) {
        const bounds = new google.maps.LatLngBounds()
        pts.forEach((p) => bounds.extend(p))
        map.fitBounds(bounds, 64)
      }
    }
  }, [ready, jobs, atRiskSets, focusTech, selectedTechId, range])

  // Cluster the job markers — keeps thousands of pins fast + readable. Rebuilds
  // only when the job set or the Jobs layer changes, NOT on every GPS poll, so
  // clusters never churn. Job markers are created without a map; the clusterer
  // owns their visibility from here (zoom in → bubbles split into pins).
  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (!jobClusterer.current) jobClusterer.current = new MarkerClusterer({ map: mapRef.current })
    jobClusterer.current.clearMarkers()
    if (layers.jobs) jobClusterer.current.addMarkers([...jobMarkers.current.values()])
  }, [ready, jobs, layers.jobs])

  // Sync technician avatar markers on every position update AND every 15s
  // age tick — dimming, "Xm ago", speed/Parked all stay live between fixes.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    const TechAvatarMarker = getTechAvatarMarkerClass()
    const seen = new Set<string>()

    for (const [accountId, p] of positions) {
      seen.add(accountId)
      const tech = techsById.get(accountId)
      const name = tech?.name ?? 'Technician'
      const age = liveAgeSeconds(p, nowMs)
      const stale = age != null && age > STALE_AFTER_SECONDS
      // Motion is only trusted on a FRESH fix — a parked phone's last
      // driving fix would otherwise show a phantom speed for minutes.
      const fresh = age != null && age <= 90
      const moving = fresh && p.speed_mph != null && p.speed_mph >= MIN_MOVING_MPH
      const atRisk = atRiskSets.techs.has(accountId)
      const info: TechMarkerInfo = {
        name,
        avatarUrl: tech?.avatar_url ?? null,
        initials: initialsFor(name),
        ring: atRisk ? '#dc2626' : TECH_MARKER_COLOR,
        dim: stale,
        heading: moving ? p.heading : null,
        openJobs: tech?.open_jobs_count ?? 0,
        speedMph: moving ? p.speed_mph : null,
        parked: fresh && !moving,
        batteryPct: p.battery_pct,
        ageLabel: freshness(age).label,
        appState: appStateLabel(p, age),
        source: p.source,
        atRisk,
        onOpen: () => onOpenDay(accountId),
      }
      let marker = techMarkers.current.get(accountId)
      if (!marker) {
        marker = new TechAvatarMarker({ lat: p.latitude, lng: p.longitude }, info)
        marker.setMap(layersRef.current.techs ? map : null)
        techMarkers.current.set(accountId, marker)
      }
      marker.update({ lat: p.latitude, lng: p.longitude }, info)
    }

    for (const [id, marker] of techMarkers.current) {
      if (!seen.has(id)) {
        marker.setMap(null)
        techMarkers.current.delete(id)
      }
    }
  }, [ready, positions, techsById, atRiskSets, nowMs, onOpenDay])

  useEffect(() => { if (!focusTech) userMoved.current = false }, [focusTech])

  // Re-focus the selected route when clicked, when geocoding finishes, or when
  // Directions adds road geometry. Live GPS ticks never seize the viewport.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    const candidateDrawing = focusTech ? routeDrawings.current.get(focusTech.id) : null
    const drawing = candidateDrawing?.key === routePlanKey ? candidateDrawing : null
    const plan = focusTech ? routePlanForTech(jobs, focusTech.id) : null
    const selectedJobs = focusTech ? jobs.filter((job) => job.lead_tech_account_id === focusTech.id) : jobs
    let points = range === 'day' && focusTech
      ? drawing?.points ?? plan?.stops ?? []
      : selectedJobs.filter((job) => hasRouteCoordinates(job.location)).map((job) => ({ lat: job.location!.latitude!, lng: job.location!.longitude! }))
    if (focusTech) {
      userMoved.current = true
      const position = positions.get(focusTech.id)
      if (!points.length && position && hasRouteCoordinates(position)) points = [{ lat: position.latitude, lng: position.longitude }]
    } else if (userMoved.current) return
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(12) }
    else if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      points.forEach((point) => bounds.extend(point))
      map.fitBounds(bounds, { top: 64, left: 64, bottom: 96, right: focusTech && (mapEl.current?.clientWidth ?? 0) > 800 ? 400 : 64 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTech, ready, range, routePlanKey, routeRevision])

  // Selection changes only route visibility/style, with no Directions request.
  useEffect(() => {
    for (const [techId, drawing] of routeDrawings.current) {
      for (const renderer of drawing.renderers) {
        renderer.setMap(layers.routes && range === 'day' && (!selectedTechId || selectedTechId === techId) ? mapRef.current : null)
        renderer.setOptions({ polylineOptions: { strokeColor: drawing.color, strokeWeight: selectedTechId === techId ? 6 : 4, strokeOpacity: selectedTechId === techId ? 0.95 : 0.7 } })
      }
    }
  }, [selectedTechId, layers.routes, range, routeRevision])

  // Called by the board effect and deliberately by Refresh route. The latter
  // uses this render's newest GPS snapshot and leaves other routes untouched.
  const requestTechRoute = async (tid: string, color: string, generation: number) => {
    const request = (routeRequests.current.get(tid) ?? 0) + 1
    routeRequests.current.set(tid, request)
    const current = () => routeGeneration.current === generation && routeRequests.current.get(tid) === request
    const previousDrawing = routeDrawings.current.get(tid)
    if (previousDrawing) for (const renderer of previousDrawing.renderers) renderer.setMap(null)
    routeDrawings.current.delete(tid)
    setRouteStates((previous) => ({ ...previous, [tid]: 'loading' }))
    const { stops } = routePlanForTech(jobs, tid)
    const p = positions.get(tid)
    const origin = recentRouteOrigin(p ?? null, liveAgeSeconds(p ?? null, Date.now()), STALE_AFTER_SECONDS)
    const hasOrigin = Boolean(origin)
    setRouteOrigins((previous) => ({ ...previous, [tid]: hasOrigin }))
    const path = origin && stops.length ? [origin, ...stops] : stops
    const drawing = { key: routePlanKey, color, renderers: [] as google.maps.DirectionsRenderer[], points: path, hasOrigin }
    routeDrawings.current.set(tid, drawing)
    try {
      const g = await loadGoogleMaps()
      const { DirectionsService, DirectionsRenderer } = (await g.maps.importLibrary('routes')) as google.maps.RoutesLibrary
      if (!current() || !mapRef.current) return
      if (!directionsSvc.current) directionsSvc.current = new DirectionsService()
      for (const segment of routeSegments(path)) {
        const res = await directionsSvc.current.route({
          origin: segment[0], destination: segment[segment.length - 1],
          waypoints: segment.slice(1, -1).map((point) => ({ location: point, stopover: true })),
          optimizeWaypoints: false, travelMode: g.maps.TravelMode.DRIVING,
        })
        if (!current() || !mapRef.current) return
        const renderer = new DirectionsRenderer({ suppressMarkers: true, preserveViewport: true })
        renderer.setOptions({ polylineOptions: { strokeColor: color, strokeWeight: selectedTechRef.current === tid ? 6 : 4, strokeOpacity: selectedTechRef.current === tid ? 0.95 : 0.7 } })
        renderer.setDirections(res)
        renderer.setMap(!selectedTechRef.current || selectedTechRef.current === tid ? mapRef.current : null)
        drawing.renderers.push(renderer)
        const roadPoints = res.routes[0]?.overview_path ?? []
        drawing.points = [...drawing.points, ...roadPoints.map((point) => ({ lat: point.lat(), lng: point.lng() }))]
      }
      if (current()) setRouteStates((previous) => ({ ...previous, [tid]: 'ready' }))
    } catch {
      if (!current()) return
      // Hide partial routes: disconnected segments must not look complete.
      for (const renderer of drawing.renderers) renderer.setMap(null)
      drawing.renderers = []
      drawing.points = path
      setRouteStates((previous) => ({ ...previous, [tid]: 'error' }))
    }
    if (current() && (!selectedTechRef.current || selectedTechRef.current === tid)) setRouteRevision((revision) => revision + 1)
  }

  // Per-tech road routes (DirectionsService) — only in the DAY view, where a
  // tech's stops form an actual daily route. Wider ranges just show pins.
  // Recomputes on job/range change, not every GPS tick (keeps Directions cheap).
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const generation = ++routeGeneration.current

    const clearRoutes = () => {
      for (const drawing of routeDrawings.current.values()) for (const renderer of drawing.renderers) renderer.setMap(null)
      routeDrawings.current.clear()
    }
    clearRoutes()
    if (range !== 'day' || !layers.routes) {
      return
    }

    const techIds = [...new Set(jobs.map((job) => job.lead_tech_account_id).filter((id): id is string => Boolean(id)))].sort()
    ;(async () => {
      // Publish pending routes when the external map loader answers, so all
      // technicians read as loading while their Directions requests queue.
      await loadGoogleMaps().catch(() => null)
      if (routeGeneration.current !== generation) return
      setRouteStates(Object.fromEntries(techIds.map((id) => [id, 'loading'])))
      for (const [index, tid] of techIds.entries()) {
        if (routeGeneration.current !== generation) return
        await requestTechRoute(tid, ROUTE_COLORS[index % ROUTE_COLORS.length], generation)
      }
    })()

    return () => {
      routeGeneration.current = generation + 1
      clearRoutes()
    }
    // positions intentionally excluded — routes recompute on jobs/range, not
    // on every live GPS tick (would burn Directions calls).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routePlanKey, range, layers.routes])

  const startLasso = () => {
    lassoRect.current?.setMap(null)
    lassoRect.current = null
    setSelectedJobIds([])
    setAssignError(null)
    setLassoMode(true)
  }
  const clearLasso = () => {
    lassoRect.current?.setMap(null)
    lassoRect.current = null
    setLassoMode(false)
    setSelectedJobIds([])
    setAssignTo('')
    setAssignError(null)
  }

  const confirmLassoAssignment = async (): Promise<boolean> => {
    if (!assignTo) return true
    const selected = jobs.filter((job) => selectedJobIds.includes(job.id))
    const scheduledDates = selected
      .map((job) => scheduledDateForJob(job))
      .filter((date): date is string => Boolean(date))

    if (scheduledDates.length === 0) return true

    const from = scheduledDates.reduce((min, date) => (date < min ? date : min), scheduledDates[0])
    const to = scheduledDates.reduce((max, date) => (date > max ? date : max), scheduledDates[0])

    try {
      const blocks = await fetchApprovedTimeOff(assignTo, from, to)
      const conflicts = blocks.filter((block) => scheduledDates.some((date) => timeOffCoversDate(block, date)))
      const techName = techsById.get(assignTo)?.name ?? conflicts[0]?.account_name ?? 'This tech'
      return confirmTimeOffAssignment(techName, conflicts, `Assign ${selectedJobIds.length} job${selectedJobIds.length === 1 ? '' : 's'}`)
    } catch (error) {
      return continueAfterFailedConflictCheck(error, 'tech time off')
    }
  }

  const doAssign = async () => {
    if (!assignTo || assigning || selectedJobIds.length === 0) return
    const okToAssign = await confirmLassoAssignment()
    if (!okToAssign) return
    setAssigning(true)
    setAssignError(null)
    // Jobs and estimate visits live behind different endpoints. Keep going
    // past a failure so one bad row doesn't strand the rest, then report.
    const failed: string[] = []
    let firstMessage: string | null = null
    try {
      for (const id of selectedJobIds) {
        const kind = jobs.find((job) => job.id === id)?.kind ?? 'job'
        const url = kind === 'estimate' ? `/v1/estimates/${id}` : `/v1/work-orders/${id}`
        try {
          await apiRequest(url, {
            method: 'PATCH',
            body: { lead_tech_account_id: assignTo },
          })
        } catch (e) {
          failed.push(id)
          if (!firstMessage) firstMessage = e instanceof Error ? e.message : String(e)
        }
      }
      qc.invalidateQueries({ queryKey: ['dispatch-board'] })
      qc.invalidateQueries({ queryKey: ['dispatch-map-jobs'] })
      if (failed.length === 0) {
        clearLasso()
      } else {
        // Leave only the ones that didn't go through selected, so a retry
        // doesn't re-send the ones that already worked.
        const total = selectedJobIds.length
        setSelectedJobIds(failed)
        setAssignError(
          `${failed.length} of ${total} could not be assigned${firstMessage ? `: ${firstMessage}` : '.'} They are still selected so you can try again.`,
        )
      }
    } finally {
      setAssigning(false)
    }
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-sm px-6">
          <div className="text-sm font-medium text-slate-700">Map unavailable</div>
          <div className="text-xs text-slate-500 mt-1">{error}</div>
          <Link to="/tool-shed/storage-maps" className="text-xs text-amber-700 hover:underline mt-2 inline-block">
            Storage & Maps →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full relative bg-slate-100">
      <div ref={mapEl} className="absolute inset-0" />
      {selectedTechId && selectedPlan && (
        <div data-tour="dispatch-selected-route" className="absolute bottom-16 left-3 z-10 max-w-[min(20rem,calc(100%-1.5rem))] rounded-lg border border-amber-200 bg-white/95 px-3 py-2 shadow" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-900">{techsById.get(selectedTechId)?.name ?? 'Technician'} · {range === 'day' ? 'daily route' : `${range} visits`}</span>
            <button type="button" onClick={onShowAll} className="shrink-0 text-[11px] font-medium text-amber-800 underline">All technicians</button>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            {jobsError ? 'Map visits unavailable. The route may be out of date.'
              : jobsLoading ? 'Loading map visits…'
              : range !== 'day' ? 'Showing this range’s visit pins. Choose Day to see a daily route.'
              : selectedPlan.remaining.length === 0 ? 'No unfinished visits in this day’s map range.'
              : selectedPlan.stops.length === 0 ? 'No visit coordinates available to plot this route.'
              : !layers.routes ? 'Routes layer is off.'
              : routeStates[selectedTechId] === 'error' ? 'Driving route unavailable. Visit pins are still shown.'
              : routeStates[selectedTechId] === 'loading' ? 'Loading driving route…'
              : selectedPlan.stops.length === 1 && !routeOrigins[selectedTechId] ? 'One mapped stop. No recent GPS origin to draw a driving route.'
              : `${selectedPlan.stops.length} mapped stop${selectedPlan.stops.length === 1 ? '' : 's'}, in scheduled order.`}
          </p>
          {range === 'day' && !jobsLoading && !jobsError && selectedPlan.missingCoordinates > 0 && <p className="mt-1 text-[11px] text-amber-800">{selectedPlan.missingCoordinates} unfinished visit{selectedPlan.missingCoordinates === 1 ? ' is' : 's are'} missing map coordinates.</p>}
          {range === 'day' && layers.routes && routeStates[selectedTechId] === 'ready' && !jobsLoading && !jobsError && selectedPlan.stops.length > 1 && !routeOrigins[selectedTechId] && <p className="mt-1 text-[10px] text-slate-500">No recent GPS origin. Route starts at the first mapped visit.</p>}
          {range === 'day' && selectedPlan.stops.length > 0 && routeOrigins[selectedTechId] && <p className="mt-1 text-[10px] text-slate-500">Starts at the last GPS fix when this route was loaded.</p>}
          <button type="button" data-tour="dispatch-refresh-route"
            disabled={!ready || range !== 'day' || !layers.routes || jobsLoading || jobsError || !selectedPlan.stops.length || routeStates[selectedTechId] === 'loading'}
            onClick={() => {
              const ids = [...new Set(jobs.map((job) => job.lead_tech_account_id).filter((id): id is string => Boolean(id)))].sort()
              void requestTechRoute(selectedTechId, ROUTE_COLORS[Math.max(0, ids.indexOf(selectedTechId)) % ROUTE_COLORS.length], routeGeneration.current)
            }}
            className="mt-2 rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Rebuild this route using the newest recent GPS fix">
            Refresh route
          </button>
        </div>
      )}
      {openCheck ? (
        <FieldEncounterPanel
          check={openCheck}
          onClose={() => setOpenCheck(null)}
          onOpenDay={(id) => {
            setOpenCheck(null)
            onOpenDay(id)
          }}
        />
      ) : dayTechId && (
        <TechDayPanel
          techId={dayTechId}
          fallbackName={techsById.get(dayTechId)?.name}
          onClose={() => onOpenDay(null)}
          onOpenCheck={(c) => {
            onOpenDay(null)
            setOpenCheck(c)
          }}
        />
      )}
      {/* Date-range selector — which jobs to plot (roster stays on today). */}
      <div data-tour="dispatch-map-range" className="absolute top-3 left-3 z-10 bg-white/95 border border-slate-200 rounded-md shadow flex overflow-hidden text-[11px]">
        {(['day', 'week', 'month', 'year'] as MapRange[]).map((r) => (
          <button
            key={r}
            type="button"
            data-tour={`dispatch-map-range-${r}`}
            aria-pressed={range === r}
            onClick={() => onRangeChange(r)}
            className={`px-2.5 py-1 capitalize ${
              range === r ? 'bg-amber-500 text-white font-semibold' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {/* Lasso bulk-assign — draw a box around jobs, assign them to one tech. */}
      <button
        data-tour="dispatch-lasso"
        type="button"
        onClick={lassoMode ? clearLasso : startLasso}
        className={`absolute bottom-4 left-3 z-10 px-3 py-1.5 rounded-md shadow border text-[11px] font-medium ${
          lassoMode
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        {lassoMode ? 'Click two corners · click to cancel' : '▱ Lasso assign'}
      </button>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 pointer-events-none">
          Loading map…
        </div>
      )}
      {/* Map layers — toggle overlays on/off (persisted per browser). Top-right
          so it clears the incoming-request panels (top-left). */}
      <div data-tour="dispatch-layers" className="absolute top-3 right-3 z-10 bg-white/95 border border-slate-200 rounded-md shadow px-3 py-2 text-[11px] text-slate-600 space-y-1 w-40">
        <div className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide">Map layers</div>
        {([
          ['techs', 'Technicians'],
          ['jobs', 'Jobs'],
          ['routes', 'Routes (day)'],
          ['traffic', 'Traffic'],
          ['checks', 'Location checks'],
        ] as [keyof MapLayers, string][]).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => setLayers((prev) => ({ ...prev, [key]: e.target.checked }))}
              className="accent-amber-500"
            />
            {label}
          </label>
        ))}
        <div className="pt-1 border-t border-slate-100 space-y-0.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} /> Complete & paid in full
          </div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#d97706' }} /> Complete · payment not confirmed</div>
          <div className="text-slate-500">Other job pins use status colors; green is reserved for complete and paid jobs.</div>
          {layers.traffic && (
            <>
              <div className="text-slate-500 font-medium pt-0.5">Traffic</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-1 rounded-sm bg-green-500" /> Clear</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-1 rounded-sm bg-amber-400" /> Moderate</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-1 rounded-sm bg-red-500" /> Heavy / stopped</div>
            </>
          )}
          <div className="flex items-center gap-1.5 pt-0.5"><span className="text-red-600">⚠</span> over job / red tech = predicted late</div>
          {layers.checks && (
            <>
              <div className="text-slate-500 font-medium pt-0.5">Location checks</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" /> Job is here</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600" /> Job is elsewhere</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500" /> Not answered</div>
            </>
          )}
          <div className="text-slate-400 pt-0.5">Faded tech pill = stale GPS</div>
        </div>
      </div>

      {selectedJobIds.length > 0 && (
        <div data-tour="dispatch-lasso-bar" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-lg shadow-lg border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">
            {selectedJobIds.length} job{selectedJobIds.length === 1 ? '' : 's'} selected
          </span>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-2 py-1.5"
          >
            <option value="">Assign to…</option>
            {[...techsById.entries()].map(([id, t]) => (
              <option key={id} value={id}>{t.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={doAssign}
            disabled={!assignTo || assigning}
            className="text-sm px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-40"
          >
            {assigning ? 'Assigning…' : `Assign ${selectedJobIds.length}`}
          </button>
          <button type="button" onClick={clearLasso} className="text-sm text-slate-500 hover:text-slate-700">
            Clear
          </button>
          {assignError && (
            <div role="alert" className="basis-full max-w-md text-xs text-red-700">
              {assignError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Build a pill-shaped SVG marker with the tech's name baked in. Width
 * scales with the name length so it stays readable; opacity dims the
 * whole pill when the GPS fix is stale.
 *
 * When `heading` is non-null (i.e. the tech is moving) a small triangle
 * sits above the pill, rotated to point in the heading direction
 * (0° = north, 90° = east). Header area is reserved either way so the
 * anchor offset stays stable across stationary / moving transitions —
 * the pill doesn't jump when the chevron appears or disappears.
 */
// A job whose assigned tech is predicted to arrive late: the status-colored dot
// with a red ⚠ floating ABOVE it (anchor sits on the dot; triangle points up).
function atRiskJobIcon(color: string): google.maps.Icon {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42">` +
    `<path d="M14 1 L26 21 L2 21 Z" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<text x="14" y="18" text-anchor="middle" font-family="system-ui,Arial" font-size="15" font-weight="bold" fill="#ffffff">!</text>` +
    `<circle cx="14" cy="34" r="7" fill="${color}" stroke="#ffffff" stroke-width="2"/>` +
    `</svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(28, 42),
    anchor: new google.maps.Point(14, 34),
  }
}

// ---------- Tech avatar markers (HTML OverlayView) ----------

/** Everything one tech marker needs to render its avatar + hover card. */
interface TechMarkerInfo {
  name: string
  avatarUrl: string | null
  initials: string
  /** Ring/accent color — brand orange, or red when at risk of running late. */
  ring: string
  /** Stale GPS → dim the whole marker. */
  dim: boolean
  /** Direction of travel when actively moving on a fresh fix; null = no chevron. */
  heading: number | null
  openJobs: number
  /** Clamped speed — null when parked/stale (GPS jitter reads up to ~4 mph). */
  speedMph: number | null
  /** Fresh fix below the moving threshold → show "Parked" instead of a speed. */
  parked: boolean
  batteryPct: number | null
  ageLabel: string
  /** 'Open' / 'Closed' (app on screen for this fix), null when unknown or stale. */
  appState: string | null
  source: string
  atRisk: boolean
  /** Click: open the tech's day (TechDayPanel). */
  onOpen?: () => void
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * A photo-avatar map marker with a live hover card. Marker icons are images,
 * and SVG-as-image can't load external photos — so this is a real DOM node in
 * the map's overlayMouseTarget pane (google.maps.OverlayView). Hover (or a
 * roster click) shows the card: name, open jobs, speed/Parked, battery, and
 * a ticking "updated Xm ago". Click pins the card open; click again unpins.
 */
interface TechAvatarMarker {
  setMap(map: google.maps.Map | null): void
  update(pos: google.maps.LatLngLiteral, info: TechMarkerInfo): void
  /** Pin the card open (roster click → focus). */
  showCard(): void
}

type TechAvatarMarkerCtorType = new (
  pos: google.maps.LatLngLiteral,
  info: TechMarkerInfo,
) => TechAvatarMarker

let techAvatarMarkerCtor: TechAvatarMarkerCtorType | null = null

/** Built lazily — google.maps.OverlayView doesn't exist until the Maps JS loads. */
function getTechAvatarMarkerClass(): TechAvatarMarkerCtorType {
  if (techAvatarMarkerCtor) return techAvatarMarkerCtor

  class Impl extends google.maps.OverlayView implements TechAvatarMarker {
    private root = document.createElement('div')
    private chevron = document.createElement('div')
    private avatar = document.createElement('div')
    private img = document.createElement('img')
    private initialsEl = document.createElement('div')
    private badge = document.createElement('div')
    private nameTag = document.createElement('div')
    private card = document.createElement('div')
    private pos: google.maps.LatLngLiteral
    private info: TechMarkerInfo
    private imgSrc = ''
    private imgOk = false
    private pinned = false
    private hovered = false

    constructor(pos: google.maps.LatLngLiteral, info: TechMarkerInfo) {
      super()
      this.pos = pos
      this.info = info

      this.root.style.cssText =
        'position:absolute;transform:translate(-50%,-50%);cursor:pointer;z-index:999;font-family:system-ui,-apple-system,sans-serif;'
      this.chevron.style.cssText =
        'position:absolute;left:50%;top:-17px;width:16px;height:14px;transform:translateX(-50%);display:none;'
      this.avatar.style.cssText =
        'width:44px;height:44px;border-radius:50%;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;'
      this.img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:none;'
      this.img.alt = ''
      this.img.draggable = false
      this.img.onload = () => {
        this.imgOk = true
        this.img.style.display = 'block'
        this.initialsEl.style.display = 'none'
      }
      this.img.onerror = () => {
        this.imgOk = false
        this.img.style.display = 'none'
        this.initialsEl.style.display = 'flex'
      }
      this.initialsEl.style.cssText =
        'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:700;'
      this.badge.style.cssText =
        'position:absolute;top:-5px;right:-7px;background:#0f172a;color:#fff;font-size:10px;font-weight:700;line-height:1;padding:3px 5px;border-radius:999px;border:2px solid #fff;display:none;'
      this.nameTag.style.cssText =
        'position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(255,255,255,.95);color:#0f172a;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.3);'
      this.card.style.cssText =
        'position:absolute;bottom:calc(100% + 12px);left:50%;transform:translateX(-50%);min-width:185px;max-width:250px;background:#fff;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.22);padding:10px 12px;font-size:12px;color:#334155;display:none;text-align:left;'

      this.avatar.appendChild(this.img)
      this.avatar.appendChild(this.initialsEl)
      this.root.appendChild(this.chevron)
      this.root.appendChild(this.avatar)
      this.root.appendChild(this.badge)
      this.root.appendChild(this.nameTag)
      this.root.appendChild(this.card)

      this.root.addEventListener('mouseenter', () => {
        this.hovered = true
        this.syncCard()
      })
      this.root.addEventListener('mouseleave', () => {
        this.hovered = false
        this.syncCard()
      })
      // Click opens the tech's day; the hover card is just the glance.
      this.root.addEventListener('click', (e) => {
        e.stopPropagation()
        if (this.info.onOpen) {
          this.pinned = false
          this.syncCard()
          this.info.onOpen()
          return
        }
        this.pinned = !this.pinned
        this.syncCard()
      })

      this.render()
    }

    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.root)
    }

    onRemove() {
      this.root.remove()
    }

    draw() {
      const proj = this.getProjection()
      if (!proj) return
      const pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(this.pos))
      if (!pt) return
      this.root.style.left = `${pt.x}px`
      this.root.style.top = `${pt.y}px`
    }

    update(pos: google.maps.LatLngLiteral, info: TechMarkerInfo) {
      this.pos = pos
      this.info = info
      this.render()
      if (this.getProjection()) this.draw()
    }

    showCard() {
      this.pinned = true
      this.syncCard()
    }

    private syncCard() {
      const show = this.pinned || this.hovered
      this.card.style.display = show ? 'block' : 'none'
      this.root.style.zIndex = show ? '1200' : '999'
    }

    private render() {
      const i = this.info
      this.root.style.opacity = i.dim ? '0.55' : '1'
      this.root.title = i.atRisk ? `${i.name} — at risk of running late` : i.name
      this.avatar.style.border = `3px solid ${i.ring}`
      this.initialsEl.style.background = i.ring
      this.initialsEl.textContent = i.initials

      // Photo — swap only when the URL changes; initials cover load/error.
      const url = i.avatarUrl ?? ''
      if (url !== this.imgSrc) {
        this.imgSrc = url
        this.imgOk = false
        this.img.style.display = 'none'
        this.initialsEl.style.display = 'flex'
        if (url) this.img.src = url
        else this.img.removeAttribute('src')
      } else if (this.imgOk) {
        this.img.style.display = 'block'
        this.initialsEl.style.display = 'none'
      }

      // Heading chevron — only while actively moving on a fresh fix.
      if (i.heading != null) {
        this.chevron.style.display = 'block'
        this.chevron.style.transform = `translateX(-50%) rotate(${i.heading}deg)`
        this.chevron.innerHTML = `<svg width="16" height="14" viewBox="0 0 16 14"><polygon points="8,0 1,13 15,13" fill="${i.ring}" stroke="white" stroke-width="2"/></svg>`
      } else {
        this.chevron.style.display = 'none'
      }

      // Open-jobs badge on the avatar; full detail lives in the card.
      if (i.openJobs > 0) {
        this.badge.style.display = 'block'
        this.badge.textContent = String(i.openJobs)
      } else {
        this.badge.style.display = 'none'
      }

      this.nameTag.textContent = i.atRisk ? `⚠ ${i.name}` : i.name
      this.nameTag.style.background = i.atRisk ? '#dc2626' : 'rgba(255,255,255,.95)'
      this.nameTag.style.color = i.atRisk ? '#fff' : '#0f172a'

      const lines: string[] = []
      lines.push(
        `<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">${escapeHtml(i.name)}</div>`,
      )
      if (i.atRisk) {
        lines.push('<div style="color:#dc2626;font-weight:600">⚠ At risk of running late</div>')
      }
      lines.push(
        `<div>${i.openJobs > 0 ? `${i.openJobs} open job${i.openJobs === 1 ? '' : 's'}` : 'No open jobs'}</div>`,
      )
      if (i.speedMph != null) {
        lines.push(`<div>Driving · ${Math.round(i.speedMph)} mph</div>`)
      } else if (i.parked) {
        lines.push('<div>Parked</div>')
      }
      if (i.batteryPct != null) {
        const low = i.batteryPct <= 20
        lines.push(
          `<div style="${low ? 'color:#dc2626;font-weight:600' : ''}">Battery ${i.batteryPct}%</div>`,
        )
      }
      const updated =
        i.ageLabel === 'Live'
          ? 'Live · just now'
          : i.ageLabel === 'No GPS'
            ? 'No GPS'
            : `Updated ${i.ageLabel}`
      const appState = i.appState ? ` · app ${i.appState.toLowerCase()}` : ''
      lines.push(
        `<div style="margin-top:4px;color:#94a3b8;font-size:11px">${escapeHtml(updated)} · ${escapeHtml(i.source)}${escapeHtml(appState)}</div>`,
      )
      this.card.innerHTML = lines.join('')
    }
  }

  techAvatarMarkerCtor = Impl
  return techAvatarMarkerCtor
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
