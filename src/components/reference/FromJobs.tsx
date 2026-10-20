import { Link } from 'react-router-dom'
import type { FromJobs as FromJobsSummary } from '@/lib/referenceCards'

/**
 * What a card learned from this shop's finished jobs: the parts they took
 * most, how long the work usually takes, and the latest notes, each with
 * who said it and on which job.
 *
 * Filled by "What worked?" at close-out, never typed here. Nothing at all
 * until a job has answered, so a card nobody has worked from looks the same
 * as it always did.
 */
export function FromJobs({ fromJobs, tour }: { fromJobs?: FromJobsSummary | null; tour?: string }) {
  if (!fromJobs || fromJobs.jobs === 0) return null

  const { jobs, parts, typical_minutes: minutes, recent } = fromJobs

  return (
    <div data-tour={tour} className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        What worked <span className="font-normal normal-case text-emerald-700">· from {jobs} {jobs === 1 ? 'job' : 'jobs'}</span>
      </h3>

      {parts.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {parts.map((part) => (
            <li key={part.description} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-900">{part.description}</span>
              <span className="shrink-0 text-xs tabular-nums text-emerald-800">
                {part.jobs} {part.jobs === 1 ? 'job' : 'jobs'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {minutes !== null && (
        <p className="mt-1.5 text-xs text-emerald-900">Usually takes about {formatMinutes(minutes)}.</p>
      )}

      {recent.length > 0 && (
        <ul className="mt-2 space-y-2 border-t border-emerald-200 pt-2">
          {recent.map((r, i) => (
            <li key={`${r.work_order_id ?? 'job'}-${i}`}>
              {r.note && <p className="whitespace-pre-wrap text-sm text-slate-800">{r.note}</p>}
              <p className="mt-0.5 text-[11px] text-slate-500">
                {[r.by, r.vehicle, new Date(r.at).toLocaleDateString(), r.minutes !== null ? formatMinutes(r.minutes) : null]
                  .filter(Boolean)
                  .join(' · ')}
                {r.work_order_id && (
                  <>
                    {' · '}
                    <Link to={`/jobs/${r.work_order_id}`} className="text-emerald-800 underline hover:text-emerald-900">
                      Job {r.work_order_number ? `#${r.work_order_number}` : ''}
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}
