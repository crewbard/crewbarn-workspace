import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimePositions, type Position } from '@/hooks/useRealtimePositions'

interface CrewJob {
  id: string
  title: string | null
  customer_name: string | null
  scheduled_start_at: string | null
  lead_tech_account_id: string | null
  status: { category: string } | null
  location: { label: string | null; address: string } | null
}

interface CrewTech {
  id: string
  name: string
  work_status: 'idle' | 'scheduled' | 'on_job'
  job_count?: number
  position: Position | null
  tracking?: {
    enrolled: boolean
    providers: string[]
    has_phone: boolean
    has_hardware: boolean
    last_seen_at: string | null
  }
}

interface DispatchBoard {
  generated_at: string
  jobs: CrewJob[]
  techs: CrewTech[]
}

type CrewState = 'on_site' | 'driving' | 'idle' | 'no_ping' | 'tracker_offline' | 'off_duty' | 'not_set_up'

const stateStyle: Record<CrewState, { label: string; chip: string; border: string; row: string }> = {
  on_site: { label: 'ON SITE', chip: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-500', row: 'bg-emerald-50/35' },
  driving: { label: 'DRIVING', chip: 'bg-blue-100 text-blue-700', border: 'border-l-blue-500', row: 'bg-blue-50/25' },
  idle: { label: 'IDLE', chip: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500', row: '' },
  no_ping: { label: 'NO PING', chip: 'bg-rose-100 text-rose-700', border: 'border-l-rose-500', row: 'bg-rose-50/45' },
  tracker_offline: { label: 'TRACKER OFF', chip: 'bg-amber-100 text-amber-800', border: 'border-l-amber-500', row: 'bg-amber-50/30' },
  off_duty: { label: 'OFF DUTY', chip: 'bg-slate-100 text-slate-600', border: 'border-l-slate-300', row: '' },
  not_set_up: { label: 'NO APP', chip: 'bg-slate-100 text-slate-500', border: 'border-l-slate-200', row: '' },
}

/**
 * Four states used to collapse into one red NO PING, which made the badge
 * useless: at 10pm it painted the whole off-duty crew — plus everyone who
 * never installed the app — the same alarming red as a tech genuinely gone
 * dark mid-job. A dispatcher who learns to ignore that stops noticing the one
 * that matters.
 *
 * Silence is only an alarm when someone is supposed to be reporting, and what
 * you do about it depends on what they're tracked by. So:
 *
 *   no signal + no device        → NO APP        nothing to fix remotely; enroll them
 *   no signal + nothing on today → OFF DUTY      correct and deliberate; we don't
 *                                                track off-duty phones at all
 *   no signal + hardware only    → TRACKER OFF   the box in the truck is quiet, and
 *                                                no push from here can reach it
 *   no signal + working + phone  → NO PING       the real alarm. The server is
 *                                                already push-waking this phone every
 *                                                5 min (crewbarn:gps-poke-stale); if
 *                                                it's still red, that failed.
 */
function crewState(tech: CrewTech, hasWorkToday: boolean): CrewState {
  const age = tech.position?.age_seconds
  const fresh = tech.position != null && age != null && age <= 15 * 60
  if (fresh) {
    if ((tech.position!.speed_mph ?? 0) >= 5) return 'driving'
    if (tech.work_status === 'on_job') return 'on_site'
    return 'idle'
  }
  if (!tech.tracking?.enrolled) return 'not_set_up'
  if (!hasWorkToday) return 'off_duty'
  // Hardware-only and quiet: pushing the tech's phone would do nothing, since
  // the feed comes from a box we can't reach.
  if (!tech.tracking.has_phone && tech.tracking.has_hardware) return 'tracker_offline'
  return 'no_ping'
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase()
}

function timeLabel(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function ageLabel(seconds: number | null | undefined): string {
  if (seconds == null) return 'No GPS'
  if (seconds < 60) return 'Now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function livePositionAge(position: Position | null, nowMs: number): number | null {
  if (!position) return null
  if (position.recorded_at) {
    const recorded = new Date(position.recorded_at).getTime()
    if (Number.isFinite(recorded)) return Math.max(0, Math.floor((nowMs - recorded) / 1000))
  }
  const base = position.age_seconds
  if (base == null) return null
  return base + Math.max(0, Math.floor((nowMs - (position.received_at ?? nowMs)) / 1000))
}
export function CrewRightNowPanel() {
  const navigate = useNavigate()
  const { account } = useAuth()
  const livePositions = useRealtimePositions(account)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  const boardQ = useQuery({
    queryKey: ['dashboard', 'crew-right-now'],
    queryFn: async () => (await apiRequest<{ data: DispatchBoard }>('/v1/dispatch/board')).data,
    refetchInterval: 120_000,
  })

  const rows = useMemo(() => {
    const jobs = boardQ.data?.jobs ?? []
    return (boardQ.data?.techs ?? []).map((tech) => {
      const position = livePositions.get(tech.id) ?? tech.position
      const ageSeconds = livePositionAge(position, nowMs)
      const liveTech: CrewTech = { ...tech, position: position ? { ...position, age_seconds: ageSeconds } : null }
      const assigned = jobs
        .filter((job) => job.lead_tech_account_id === tech.id)
        .sort((a, b) => (a.scheduled_start_at ?? '').localeCompare(b.scheduled_start_at ?? ''))
      const current = assigned.find((job) => job.status?.category === 'in_progress')
        ?? (tech.work_status === 'on_job' ? assigned[0] : null)
      const next = assigned.find((job) => job.id !== current?.id) ?? null
      // job_count is the board's own tally and includes scheduled assessments,
      // so a tech whose whole day is walkthroughs still counts as working.
      const hasWorkToday = (tech.job_count ?? assigned.length) > 0
      return { tech: liveTech, state: crewState(liveTech, hasWorkToday), current, next, ageSeconds }
    })
  }, [boardQ.data, livePositions, nowMs])

  const counts = useMemo(() => rows.reduce<Record<CrewState, number>>(
    (out, row) => ({ ...out, [row.state]: out[row.state] + 1 }),
    { on_site: 0, driving: 0, idle: 0, no_ping: 0, tracker_offline: 0, off_duty: 0, not_set_up: 0 },
  ), [rows])

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <h2 className="text-sm font-bold text-navy-900">Crew right now</h2>
        <span className="text-xs font-medium text-slate-400">
          Live · {new Date(nowMs).toLocaleTimeString()}
        </span>
        <div className="ml-auto flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{counts.on_site} on site</span>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{counts.driving} driving</span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{counts.idle} idle</span>
          {/* Always shown, because a zero here is the reassuring part. Kept
              neutral at zero so the red only ever means something is wrong. */}
          <span className={`rounded-full px-2 py-1 ${counts.no_ping > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
            {counts.no_ping} no ping
          </span>
          {/* The rest are conditions, not a running tally — no point printing
              "0 tracker off" every day of the year. */}
          {counts.tracker_offline > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{counts.tracker_offline} tracker off</span>
          )}
          {counts.not_set_up > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{counts.not_set_up} no app</span>
          )}
        </div>
      </header>

      {boardQ.isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((row) => <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">No field crew found.</p>
      ) : (
        <>
          <div className="hidden grid-cols-[180px_110px_minmax(260px,1.35fr)_120px_minmax(220px,1fr)_180px] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 lg:grid">
            <span>Tech</span><span>Status</span><span>Working on</span><span>GPS update</span><span>Next</span><span />
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map(({ tech, state, current, next, ageSeconds }) => {
              const style = stateStyle[state]
              return (
                <div key={tech.id} className={`grid gap-3 border-l-4 px-4 py-3 lg:grid-cols-[180px_110px_minmax(260px,1.35fr)_120px_minmax(220px,1fr)_180px] lg:items-center ${style.border} ${style.row}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-600">{initials(tech.name)}</span>
                    <span className="truncate text-sm font-semibold text-navy-900">{tech.name}</span>
                  </div>
                  <div><span className={`rounded px-2 py-1 text-[10px] font-bold ${style.chip}`}>{style.label}</span></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{current?.title ?? 'No active job'}</p>
                    <p className="truncate text-xs text-slate-500">{current ? `${current.customer_name ?? 'Customer'} · ${current.location?.label ?? current.location?.address ?? ''}` : 'Available for assignment'}</p>
                  </div>
                  {/* "2h 46m" reads as a fault; for someone who never installed
                      the app there is no elapsed time to report, only a gap. */}
                  <span className={`text-xs font-semibold ${state === 'no_ping' ? 'text-rose-700' : 'text-slate-600'}`}>
                    {state === 'not_set_up' ? 'No app' : ageLabel(ageSeconds)}
                  </span>
                  <div className="min-w-0 text-xs text-slate-500">
                    {next ? <><span className="font-medium text-slate-700">{timeLabel(next.scheduled_start_at)}</span> {next.customer_name ?? next.title}</> : 'Nothing assigned'}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => navigate('/communications')} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Message</button>
                    <button type="button" onClick={() => navigate(current ? `/jobs/${current.id}` : state === 'driving' ? '/dispatch' : '/schedule')} className="rounded-md bg-navy-950 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-900">
                      {current ? 'Open job' : state === 'driving' ? 'Track' : 'Assign job'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}