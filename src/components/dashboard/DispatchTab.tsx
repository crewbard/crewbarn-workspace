import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { StickyNoteStrip } from '@/components/dashboard/StickyNoteStrip'
import { JobTypeChip } from '@/components/JobTypeChip'
// Lives in the Dispatch page rather than its own module — see the note on the
// export there. Imported so both screens share one assign implementation.
import { SuggestTechModal } from '@/pages/DispatchPage'
import { useCalendarEvents, useRescheduleWorkOrder, useUnscheduledJobs } from '@/hooks/useSchedule'
import { useJobStatuses } from '@/hooks/useJobStatuses'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'
import { visibleStatusColor, textColorOn } from '@/lib/statusColor'
import type { ScheduleWorkOrder } from '@/types/schedule'
import type { TenantAccount } from '@/lib/tenantAccounts'

// ── Timeline constants ────────────────────────────────────────────────

const SH = 7    // 7 am
const EH = 19   // 7 pm
const RH = EH - SH  // 12-hour visible range

// ── Pure helpers ─────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoToHour(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.getHours() + d.getMinutes() / 60
}

function leftPct(h: number): string {
  return `${Math.max(0, Math.min(100, ((h - SH) / RH) * 100)).toFixed(2)}%`
}

function widthPct(durH: number): string {
  return `${Math.max(1.5, (durH / RH) * 100).toFixed(2)}%`
}

/**
 * Address line for a queue card. The dispatch board serves a flat
 * `location.address`; the schedule payload carries the location's own fields
 * instead, so the same card text has to be rebuilt from those.
 */
function jobAddress(job: ScheduleWorkOrder): string {
  const loc = job.service_location
  return loc?.formatted_address ?? loc?.street_address ?? loc?.nickname ?? ''
}

/** Hours offered as one-click slots, in the order they're shown. */
const QUICK_SLOT_HOURS = [8, 10, 13, 15]

/**
 * The next few slots from right now, rolling into tomorrow once today's are
 * spent. Without the roll, a dispatcher working the queue in the evening — the
 * usual time to clear it — would only be offered times that already passed.
 */
function upcomingQuickSlots(count = 4): Date[] {
  const out: Date[] = []
  const now = new Date()
  for (let dayOffset = 0; out.length < count && dayOffset < 7; dayOffset++) {
    for (const hour of QUICK_SLOT_HOURS) {
      const slot = new Date(now)
      slot.setDate(slot.getDate() + dayOffset)
      slot.setHours(hour, 0, 0, 0)
      if (slot.getTime() > now.getTime() && out.length < count) out.push(slot)
    }
  }
  return out
}

function quickSlotLabel(slot: Date): string {
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const day = sameDay(slot, today) ? 'Today' : sameDay(slot, tomorrow) ? 'Tomorrow' : slot.toLocaleDateString(undefined, { weekday: 'short' })
  return `${day} ${slot.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

function nowHour(): number {
  const n = new Date()
  return n.getHours() + n.getMinutes() / 60
}

function fmt12(h: number): string {
  const w = Math.floor(h)
  const m = Math.round((h - w) * 60)
  const ap = h >= 12 ? 'p' : 'a'
  const disp = w % 12 || 12
  return m === 0 ? `${disp}${ap}` : `${disp}:${String(m).padStart(2, '0')} ${ap}`
}

function jobStartLabel(w: ScheduleWorkOrder): string {
  const h = isoToHour(w.scheduled_start_time)
  return h !== null ? fmt12(h) : '—'
}

function isDone(w: ScheduleWorkOrder): boolean {
  return !!w.completed_at
}

function isActive(w: ScheduleWorkOrder): boolean {
  return !!w.on_site && !isDone(w)
}

const PALETTE = ['#1e3a8a', '#7c3aed', '#059669', '#b45309', '#0369a1', '#9f1239']
function techColor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff
  return PALETTE[h % PALETTE.length]
}

function techInitials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

const TICKS = Array.from({ length: RH }, (_, i) => SH + i)

type CalResponse = { data?: ScheduleWorkOrder[] }

// ── Skeletons ────────────────────────────────────────────────────────

function SkeletonLanes() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="grid border-b border-slate-200"
          style={{ gridTemplateColumns: '140px 1fr', height: 76 }}
        >
          <div className="p-3 border-r border-slate-200 flex flex-col gap-2 justify-center">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
          </div>
          <div className="p-3 flex items-center">
            <div className="h-12 bg-slate-100 rounded animate-pulse w-1/3" />
          </div>
        </div>
      ))}
    </>
  )
}

function SkeletonCards() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ── BoardLane ────────────────────────────────────────────────────────

function BoardLane({
  tech,
  jobs,
  nowH,
  navigate,
}: {
  tech: TenantAccount
  jobs: ScheduleWorkOrder[]
  nowH: number | null
  navigate: (to: string) => void
}) {
  const hasActive = jobs.some(isActive)
  const color = techColor(tech.id)

  return (
    <div
      className="grid border-b border-slate-200 bg-white hover:bg-slate-50/40 transition-colors"
      style={{ gridTemplateColumns: '140px 1fr', minHeight: 76 }}
    >
      {/* Tech identity */}
      <div className="px-3 py-3 border-r border-slate-200 flex flex-col justify-center gap-1.5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: color }}
          >
            {techInitials(tech.name)}
          </div>
          <span className="text-xs font-semibold text-slate-900 truncate leading-tight">
            {tech.name}
          </span>
        </div>
        <div
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit ${
            hasActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {hasActive ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              On site
            </>
          ) : (
            '○ Scheduled'
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative" style={{ minHeight: 76 }}>
        {/* Now line */}
        {nowH !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 pointer-events-none"
            style={{ left: leftPct(nowH) }}
          />
        )}

        {/* Job blocks */}
        {jobs.map((job) => {
          const sh = isoToHour(job.scheduled_start_time)
          if (sh === null) return null
          const durH = job.estimated_duration_minutes ? job.estimated_duration_minutes / 60 : 1
          const eh = isoToHour(job.scheduled_end_time) ?? sh + durH
          const cs = Math.max(sh, SH)
          const ce = Math.min(eh, EH)
          if (ce <= cs) return null
          const done = isDone(job)
          const live = isActive(job)
          const hex = visibleStatusColor(job.status?.color)

          return (
            <button
              key={job.id}
              type="button"
              onClick={() => navigate(job.kind === 'estimate' ? `/estimates/${job.id}` : `/jobs/${job.id}`)}
              className={`absolute top-2.5 border-l-[3px] rounded-md px-1.5 overflow-hidden text-left transition-shadow hover:shadow-md hover:z-20 ${
                done
                  ? 'bg-emerald-50'
                  : live
                    ? 'bg-amber-50 ring-1 ring-amber-300'
                    : 'bg-slate-50 hover:bg-white'
              }`}
              style={{
                left: leftPct(cs),
                width: widthPct(ce - cs),
                height: 52,
                borderLeftColor: hex,
              }}
            >
              <div className="text-[10px] font-bold text-slate-900 truncate">
                {live ? '● ' : done ? '✓ ' : ''}
                {job.customer?.name ?? '—'}
              </div>
              <div className="text-[9px] text-slate-500 truncate">{job.title ?? '—'}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">{jobStartLabel(job)}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── DispatchBoard (management / owner view) ──────────────────────────

function DispatchBoard() {
  const navigate = useNavigate()
  // Right-clicked unassigned card, with the click position to anchor the menu.
  const [jobMenu, setJobMenu] = useState<{ x: number; y: number; job: ScheduleWorkOrder } | null>(null)
  // Assign a tech without leaving the dashboard — same modal the Dispatch page
  // opens, so there's one suggestion/assign implementation rather than two.
  const [suggestJobId, setSuggestJobId] = useState<string | null>(null)
  const reschedule = useRescheduleWorkOrder()
  const statusesQuery = useJobStatuses()
  // The tenant's "Scheduled" status, applied when a job leaves the queue —
  // same lookup the Schedule page uses, so a job scheduled from here ends up
  // in the same state as one dragged onto the calendar.
  const scheduledStatusId = useMemo(() => {
    const list = statusesQuery.data?.data ?? []
    const found = list.find((s) => s.slug === 'scheduled' || /^scheduled$/i.test(s.name))
    return found?.id ?? null
  }, [statusesQuery.data])

  /**
   * Put a date on an unscheduled job without leaving the dashboard.
   *
   * Mirrors SchedulePage.scheduleEvent for the queue case: the end comes from
   * estimated_duration_minutes (60 fallback) rather than a fixed hour, and a
   * job leaving the queue flips to the Scheduled status. The tech is left
   * alone — these cards are unassigned by definition, and once a job has a
   * scheduled_start_at it appears on the dispatch board, where the existing
   * suggest-a-tech flow can assign it.
   */
  const quickSchedule = (job: ScheduleWorkOrder, slot: Date) => {
    const durationMin = job.estimated_duration_minutes ?? 60
    reschedule.mutate({
      id: job.id,
      start: slot.toISOString(),
      end: new Date(slot.getTime() + durationMin * 60000).toISOString(),
      kind: job.kind ?? 'job',
      statusId: (job.kind ?? 'job') === 'job' ? scheduledStatusId : undefined,
    })
  }

  const today = todayIso()
  const calQ = useCalendarEvents({ start: today, end: today })
  const unstQ = useUnscheduledJobs()
  const techsQ = useTenantAccounts('', 100)

  const jobs: ScheduleWorkOrder[] = (calQ.data as CalResponse | undefined)?.data ?? []
  const unscheduled: ScheduleWorkOrder[] = unstQ.data?.data ?? []
  const now = nowHour()
  const showNow = now >= SH && now <= EH

  const lanes = useMemo(() => {
    const map = new Map<string, { tech: TenantAccount; jobs: ScheduleWorkOrder[] }>()

    for (const t of techsQ.data ?? []) {
      map.set(t.id, { tech: t, jobs: [] })
    }

    for (const job of jobs) {
      const tid = job.lead_tech?.id
      if (!tid) continue
      if (!map.has(tid)) {
        map.set(tid, {
          tech: {
            id: tid,
            name: job.lead_tech?.name ?? 'Unknown',
            email: job.lead_tech?.email ?? null,
            role: null,
            app_access: true,
          },
          jobs: [],
        })
      }
      map.get(tid)!.jobs.push(job)
    }

    // Only show techs who have at least one scheduled job today
    return [...map.values()].filter((l) => l.jobs.length > 0)
  }, [jobs, techsQ.data])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Timeline board */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: 820 }}>
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-slate-200 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200 border-l-2 border-emerald-500" />
              Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border-l-2 border-amber-400" />
              On site
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-100 border-l-2 border-slate-400" />
              Upcoming
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-medium text-amber-700">
              <span className="inline-block w-0.5 h-3 bg-amber-400 rounded" />
              Now — {fmt12(now)}
            </span>
          </div>

          {/* Time header */}
          <div
            className="grid sticky top-0 z-10 bg-white border-b-2 border-slate-200"
            style={{ gridTemplateColumns: '140px 1fr' }}
          >
            <div className="px-3 py-2 border-r border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              Tech
            </div>
            <div className="flex">
              {TICKS.map((h) => (
                <div
                  key={h}
                  className="flex-1 py-2 pl-1.5 text-[10px] text-slate-400 border-r border-slate-100"
                >
                  {fmt12(h)}
                </div>
              ))}
            </div>
          </div>

          {/* Lanes */}
          {calQ.isLoading ? (
            <SkeletonLanes />
          ) : lanes.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              No scheduled jobs today.
            </div>
          ) : (
            lanes.map(({ tech, jobs: lj }) => (
              <BoardLane
                key={tech.id}
                tech={tech}
                jobs={lj}
                nowH={showNow ? now : null}
                navigate={navigate}
              />
            ))
          )}
        </div>
      </div>

      {/* Unassigned sidebar */}
      <div className="w-52 flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
        <div className="px-3 py-2.5 border-b border-slate-200 flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Unassigned
          </span>
          {unscheduled.length > 0 && (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 rounded-full px-1.5 py-0.5 leading-none">
              {unscheduled.length}
            </span>
          )}
        </div>
        <div className="p-2 space-y-1.5">
          {unscheduled.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-4 text-center">All jobs assigned</p>
          ) : (
            // Same card as the Dispatch page's unassigned list: job-type chip,
            // title, customer · address, bill-to stamp, and the amber
            // "Suggest a tech" affordance. Assessments get the sky treatment
            // and route to the estimate, because the suggest flow is
            // work-order-only there too.
            unscheduled.slice(0, 25).map((job) =>
              job.kind === 'estimate' ? (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(`/estimates/${job.id}`)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setJobMenu({ x: e.clientX, y: e.clientY, job })
                  }}
                  title="Click to open · right-click to schedule"
                  className="w-full text-left px-2 py-1.5 rounded-md border border-sky-200 bg-sky-50/60 hover:bg-sky-100"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-sky-700 bg-sky-100 rounded px-1 py-px">
                      Assessment
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {job.title || 'Estimate'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {job.customer?.name ?? '—'}
                    {jobAddress(job) ? ` · ${jobAddress(job)}` : ''}
                  </div>
                  <div className="text-[11px] text-sky-700 font-medium mt-0.5">Open assessment →</div>
                </button>
              ) : (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSuggestJobId(job.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setJobMenu({ x: e.clientX, y: e.clientY, job })
                  }}
                  title="Click to suggest a tech · right-click to schedule"
                  className="w-full text-left px-2 py-1.5 rounded-md border border-amber-200 bg-amber-50/60 hover:bg-amber-100"
                >
                  <div className="flex items-center gap-1.5">
                    {job.job_type && (
                      <JobTypeChip color={job.job_type.color} icon={job.job_type.icon} size={20} />
                    )}
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {job.title || `WO ${job.work_order_number ?? ''}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {job.customer?.name ?? '—'}
                    {jobAddress(job) ? ` · ${jobAddress(job)}` : ''}
                  </div>
                  {job.bill_to?.name && (
                    <div className="mt-0.5">
                      <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                        {job.bill_to.name}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-amber-700 font-medium mt-0.5">Suggest a tech →</div>
                </button>
              ),
            )
          )}
        </div>
      </div>

      {/* Right-click on an unassigned card.
          Scheduling points at the Schedule page, NOT Dispatch: these jobs have
          no scheduled_start_at, and /v1/dispatch/board requires one, so they
          can never appear on the dispatch board. Sending them there would open
          a screen that structurally cannot show them. The Schedule page owns
          the unscheduled queue, the duration defaults and the conflict prompt. */}
      {jobMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setJobMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setJobMenu(null)
          }}
        >
          <div
            className="absolute bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-56"
            style={{
              left: Math.min(jobMenu.x, window.innerWidth - 240),
              top: Math.min(jobMenu.y, window.innerHeight - 120),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">
              {jobMenu.job.customer?.name ?? 'Unassigned'}
            </div>
            {upcomingQuickSlots().map((slot) => (
              <button
                key={slot.toISOString()}
                type="button"
                disabled={reschedule.isPending}
                onClick={() => {
                  const job = jobMenu.job
                  setJobMenu(null)
                  quickSchedule(job, slot)
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                📅 {quickSlotLabel(slot)}
              </button>
            ))}

            <div className="my-1 border-t border-slate-100" />

            {jobMenu.job.kind !== 'estimate' && (
              <button
                type="button"
                onClick={() => {
                  const id = jobMenu.job.id
                  setJobMenu(null)
                  setSuggestJobId(id)
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                🧭 Suggest a tech
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const { id, kind } = jobMenu.job
                setJobMenu(null)
                navigate(kind === 'estimate' ? `/estimates/${id}` : `/jobs/${id}`)
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              📄 Open {jobMenu.job.kind === 'estimate' ? 'estimate' : 'job'}
            </button>
          </div>
        </div>
      )}

      {/* job={null}: these come off the unscheduled queue, so there's no
          scheduled date for the time-off conflict window to check against. */}
      {suggestJobId && (
        <SuggestTechModal jobId={suggestJobId} job={null} onClose={() => setSuggestJobId(null)} />
      )}
    </div>
  )
}

// ── MyJobCard ────────────────────────────────────────────────────────

function MyJobCard({
  job,
  navigate,
}: {
  job: ScheduleWorkOrder
  navigate: (to: string) => void
}) {
  const done = isDone(job)
  const live = isActive(job)
  const hex = visibleStatusColor(job.status?.color)

  return (
    <button
      type="button"
      onClick={() => navigate(job.kind === 'estimate' ? `/estimates/${job.id}` : `/jobs/${job.id}`)}
      className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow ${
        live
          ? 'bg-amber-50 border-amber-300 shadow-sm'
          : done
            ? 'bg-white border-slate-200 opacity-55'
            : 'bg-white border-slate-200'
      }`}
    >
      {/* Status color bar */}
      <div className="h-11 w-1 rounded-full flex-shrink-0" style={{ background: hex }} />

      {/* Time + live indicator */}
      <div className="text-xs text-slate-500 w-14 flex-shrink-0 text-left">
        <span className="block font-medium">{jobStartLabel(job)}</span>
        {live && (
          <span className="flex items-center gap-1 text-emerald-600 font-semibold mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Now
          </span>
        )}
      </div>

      {/* Customer + title + address */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate">
          {job.customer?.name ?? '—'}
        </div>
        <div className="text-xs text-slate-500 truncate">{job.title ?? 'No title'}</div>
        {job.service_location?.street_address && (
          <div className="text-xs text-slate-400 truncate mt-0.5">
            📍 {job.service_location.street_address}
          </div>
        )}
      </div>

      {/* Status pill */}
      {job.status && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: hex, color: textColorOn(hex) }}
        >
          {done ? '✓ ' : ''}
          {job.status.name}
        </span>
      )}
    </button>
  )
}

// ── MySchedule (individual tech view) ────────────────────────────────

function MySchedule() {
  const navigate = useNavigate()
  const { accountId } = usePermissions()
  const today = todayIso()
  const calQ = useCalendarEvents({ start: today, end: today, tech_id: accountId ?? undefined })
  const now = nowHour()
  const showNow = now >= SH && now <= EH

  const jobs = useMemo(() => {
    const raw: ScheduleWorkOrder[] = (calQ.data as CalResponse | undefined)?.data ?? []
    return [...raw].sort(
      (a, b) =>
        (isoToHour(a.scheduled_start_time) ?? 99) - (isoToHour(b.scheduled_start_time) ?? 99),
    )
  }, [calQ.data])

  const doneCount = jobs.filter(isDone).length

  return (
    <div className="px-4 sm:px-6 py-5 space-y-4 max-w-3xl">
      <StickyNoteStrip />
      {/* Mini timeline overview */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            My day
          </span>
          <span className="text-xs text-slate-400">
            {doneCount}/{jobs.length} done
          </span>
        </div>
        <div className="relative bg-slate-50" style={{ height: 64 }}>
          {/* Hour tick lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {TICKS.map((h) => (
              <div key={h} className="flex-1 border-r border-slate-200 relative">
                {(h === SH || h % 2 === 0) && (
                  <span className="absolute top-1 left-0.5 text-[8px] text-slate-300 leading-none">
                    {fmt12(h)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Now line */}
          {showNow && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 pointer-events-none"
              style={{ left: leftPct(now) }}
            />
          )}

          {/* Job blocks */}
          {jobs.map((job) => {
            const sh = isoToHour(job.scheduled_start_time)
            if (sh === null) return null
            const durH = job.estimated_duration_minutes ? job.estimated_duration_minutes / 60 : 1
            const eh = isoToHour(job.scheduled_end_time) ?? sh + durH
            const cs = Math.max(sh, SH)
            const ce = Math.min(eh, EH)
            if (ce <= cs) return null
            const hex = visibleStatusColor(job.status?.color)
            const done = isDone(job)
            const live = isActive(job)

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(job.kind === 'estimate' ? `/estimates/${job.id}` : `/jobs/${job.id}`)}
                className={`absolute rounded border-l-2 px-1 overflow-hidden text-left transition-all hover:brightness-95 ${
                  done
                    ? 'bg-emerald-50'
                    : live
                      ? 'bg-amber-100 ring-1 ring-amber-300'
                      : 'bg-white border border-slate-100'
                }`}
                style={{
                  top: 14,
                  height: 38,
                  left: leftPct(cs),
                  width: widthPct(ce - cs),
                  borderLeftColor: hex,
                }}
              >
                <div className="text-[9px] font-bold truncate text-slate-800 leading-tight">
                  {job.customer?.name ?? '—'}
                </div>
                <div className="text-[8px] text-slate-500 truncate">{jobStartLabel(job)}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Job card list */}
      {calQ.isLoading ? (
        <SkeletonCards />
      ) : jobs.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          No jobs scheduled for today.
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <MyJobCard key={job.id} job={job} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────

/** Roles that see the full multi-tech board. Everyone else sees their own schedule. */
const BOARD_ROLES = ['owner', 'admin', 'dispatcher']

export function DispatchTab() {
  const { role_slug, isPlatformAdmin, isLoading } = usePermissions()
  if (isLoading) return <SkeletonLanes />
  const isDispatcher = BOARD_ROLES.includes(role_slug ?? '') || isPlatformAdmin
  return isDispatcher ? <DispatchBoard /> : <MySchedule />
}
