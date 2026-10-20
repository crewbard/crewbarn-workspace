import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { encounterAnswerLabel, encounterColor, encounterTime, type FieldEncounterRow } from '@/lib/fieldEncounters'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

/** GET /v1/dispatch/techs/{id}/day (TechDay on the server). */
interface TechDayJob {
  id: string
  job_number: number | null
  customer: string | null
  title: string | null
  address: string | null
  status: string | null
  state: 'done' | 'on_site' | 'en_route' | 'late' | 'to_do'
  window: string
  arrived_label: string | null
  left_label: string | null
  completed_label: string | null
  minutes_on_job: number
  late_minutes: number | null
  /** About how long from the stop before (straight line); null for the first. */
  drive_minutes: number | null
  link: string
}

interface TechDayTask {
  id: string
  title: string
  done: boolean
  overdue: boolean
  due_label: string | null
  link: string
}

interface TechDayData {
  tech: { id: string; name: string; phone: string | null }
  date_label: string
  /** A day ahead (Tomorrow): the plan, nothing on site yet. */
  ahead: boolean
  clock: { clocked_in: boolean; first_in_label: string; last_out_label: string | null; minutes: number } | null
  now: { state: 'on_site' | 'en_route'; job_id: string; job_number: number | null; customer: string | null; minutes: number | null } | null
  next: { job_id: string; job_number: number | null; customer: string | null; window: string } | null
  jobs: TechDayJob[]
  tasks: TechDayTask[]
  /** "Is this the job's address?" checks they answered that day. */
  location_checks?: FieldEncounterRow[]
  summary: {
    jobs: number
    done: number
    to_go: number
    late: number
    minutes_on_jobs: number
    drive_minutes: number
    tasks_open: number
    tasks_overdue: number
    line: string
  }
}

const STATE: Record<TechDayJob['state'], { label: string; cls: string }> = {
  done: { label: 'Done', cls: 'bg-emerald-100 text-emerald-800' },
  on_site: { label: 'On site', cls: 'bg-amber-100 text-amber-900' },
  en_route: { label: 'On the way', cls: 'bg-sky-100 text-sky-800' },
  late: { label: 'Running late', cls: 'bg-red-100 text-red-800' },
  to_do: { label: 'To do', cls: 'bg-slate-100 text-slate-700' },
}

/** 80 → "1 h 20 m", 45 → "45 m". */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${m} m` : ''}` : `${m} m`
}

/**
 * One tech's day, opened by clicking them on the dispatch map or in the
 * roster: what they're on and for how long, the day's jobs in order with
 * their times, their to-dos, and a one-line summary. Refreshes every minute
 * so the time on the current job keeps counting.
 */
export function TechDayPanel({ techId, fallbackName, onClose, onOpenCheck }: {
  techId: string
  fallbackName?: string
  onClose: () => void
  /** Open a location check's own panel. */
  onOpenCheck?: (check: FieldEncounterRow) => void
}) {
  const [when, setWhen] = useState<'today' | 'tomorrow'>('today')
  const q = useQuery({
    queryKey: ['tech-day', techId, when],
    queryFn: () => apiRequest<{ data: TechDayData }>(`/v1/dispatch/techs/${encodeURIComponent(techId)}/day${when === 'tomorrow' ? '?date=tomorrow' : ''}`),
    refetchInterval: when === 'today' ? 60_000 : false,
  })
  const day = q.data?.data
  // Ask their phone for a fresh GPS fix (the roster's Ping).
  const locate = useMutation({
    mutationFn: () => apiRequest(`/v1/dispatch/techs/${encodeURIComponent(techId)}/locate`, { method: 'POST' }),
  })
  const phone = day?.tech.phone ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      aria-label={`${day?.tech.name ?? fallbackName ?? 'Tech'}'s day`}
      className="absolute bottom-3 right-3 top-3 z-20 flex w-[360px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-navy-900">{day?.tech.name ?? fallbackName ?? 'Tech'}</h2>
          <p className="text-[11px] text-slate-500">{day ? day.date_label : 'Loading their day…'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          ✕
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
        <div role="tablist" aria-label="Which day" className="mr-auto flex overflow-hidden rounded-md border border-slate-200 text-[11px] font-semibold">
          {(['today', 'tomorrow'] as const).map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={when === w}
              onClick={() => setWhen(w)}
              className={`px-2.5 py-1 ${when === w ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {w === 'today' ? 'Today' : 'Tomorrow'}
            </button>
          ))}
        </div>
        {phone && (
          <>
            <a href={`tel:${phone}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-navy-900 hover:border-amber-300 hover:bg-amber-50">
              Call
            </a>
            <a href={`sms:${phone}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-navy-900 hover:border-amber-300 hover:bg-amber-50">
              Text
            </a>
          </>
        )}
        <button
          type="button"
          onClick={() => locate.mutate()}
          disabled={locate.isPending || locate.isSuccess}
          title="Ask their phone for a fresh location"
          className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-navy-900 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-60"
        >
          {locate.isPending ? 'Locating…' : locate.isSuccess ? 'Location asked' : locate.isError ? 'Try locate again' : 'Locate'}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
        {q.isError && <p className="text-xs text-red-700">{(q.error as Error).message || "Couldn't load their day."}</p>}
        {day && (
          <>
            <p className="text-[13px] font-medium leading-snug text-navy-900">{day.summary.line}</p>

            <div className="grid grid-cols-3 gap-2 text-center">
              {day.ahead ? (
                <>
                  <Stat label="Jobs" value={String(day.summary.jobs)} />
                  <Stat label="Driving" value={day.summary.drive_minutes ? `~${duration(day.summary.drive_minutes)}` : '—'} />
                </>
              ) : (
                <>
                  <Stat label="Jobs" value={`${day.summary.done}/${day.summary.jobs}`} hint="done" />
                  <Stat
                    label={day.clock ? 'Clocked' : 'On jobs'}
                    value={duration(day.clock ? day.clock.minutes : day.summary.minutes_on_jobs)}
                    hint={day.clock ? `${duration(day.summary.minutes_on_jobs)} on jobs` : undefined}
                  />
                </>
              )}
              <Stat label="To-dos" value={String(day.summary.tasks_open)} hint={day.summary.tasks_overdue ? `${day.summary.tasks_overdue} overdue` : undefined} warn={day.summary.tasks_overdue > 0} />
            </div>

            {day.now ? (
              <Link to={`/jobs/${day.now.job_id}`} className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 hover:border-amber-300">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{day.now.state === 'on_site' ? 'On site now' : 'On the way now'}</p>
                <p className="font-semibold text-navy-900">
                  {day.now.customer ?? `Job #${day.now.job_number}`}
                  {day.now.job_number != null && <span className="font-normal text-slate-500"> · #{day.now.job_number}</span>}
                </p>
                {day.now.minutes != null && <p className="text-xs text-amber-900">There for {duration(day.now.minutes)}</p>}
              </Link>
            ) : day.next ? (
              <Link to={`/jobs/${day.next.job_id}`} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-slate-300">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next</p>
                <p className="font-semibold text-navy-900">{day.next.customer ?? `Job #${day.next.job_number}`}</p>
                <p className="text-xs text-slate-600">{day.next.window}</p>
              </Link>
            ) : null}

            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{day.ahead ? 'Jobs' : 'Jobs today'}</h3>
              {day.jobs.length === 0 ? (
                <p className="text-xs text-slate-500">No jobs today.</p>
              ) : (
                <ol className="space-y-1.5">
                  {day.jobs.map((j) => (
                    <li key={j.id}>
                      {j.drive_minutes != null && j.drive_minutes > 0 && (
                        <p className="mb-1 pl-3 text-[10px] text-slate-400">↓ about {duration(j.drive_minutes)} drive</p>
                      )}
                      <Link to={j.link} className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-amber-300 hover:bg-amber-50/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold tabular-nums text-slate-700">{j.window}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATE[j.state].cls}`}>
                            {STATE[j.state].label}
                            {j.state === 'late' && j.late_minutes ? ` · ${j.late_minutes} m` : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-semibold text-navy-900">
                          {j.customer ?? 'No customer'}
                          {j.job_number != null && <span className="font-normal text-slate-500"> · #{j.job_number}</span>}
                        </p>
                        {j.title && <p className="truncate text-xs text-slate-600">{j.title}</p>}
                        {(j.arrived_label || j.minutes_on_job > 0) && (
                          <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                            {j.arrived_label && `Arrived ${j.arrived_label}`}
                            {j.left_label && ` · left ${j.left_label}`}
                            {j.minutes_on_job > 0 && ` · ${duration(j.minutes_on_job)} on the job`}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">To-dos</h3>
              {day.tasks.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing on their list.</p>
              ) : (
                <ul className="space-y-1">
                  {day.tasks.map((t) => (
                    <li key={t.id}>
                      <Link to={t.link} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-slate-50">
                        <span aria-hidden className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${t.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                          {t.done ? '✓' : ''}
                        </span>
                        <span className={`min-w-0 flex-1 text-xs ${t.done ? 'text-slate-400 line-through' : 'text-navy-900'}`}>{t.title}</span>
                        {t.due_label && (
                          <span className={`shrink-0 text-[11px] tabular-nums ${t.overdue ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                            {t.overdue ? `Overdue · ${t.due_label}` : t.due_label}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(day.location_checks ?? []).length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Location checks</h3>
                <ul className="space-y-1">
                  {(day.location_checks ?? []).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => onOpenCheck?.(c)}
                        className="flex w-full items-start gap-2 rounded px-1 py-1 text-left hover:bg-slate-50"
                      >
                        <span aria-hidden className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: encounterColor(c) }} />
                        <span className="min-w-0 flex-1 text-xs text-navy-900">
                          {c.address ?? 'Unnamed spot'}
                          <span className="block text-[11px] text-slate-500">{encounterAnswerLabel(c)}</span>
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{encounterTime(c)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function Stat({ label, value, hint, warn = false }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold tabular-nums text-navy-900">{value}</p>
      {hint && <p className={`text-[10px] ${warn ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{hint}</p>}
    </div>
  )
}
