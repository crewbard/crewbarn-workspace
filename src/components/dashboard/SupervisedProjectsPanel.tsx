import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

type SupervisedJob = {
  id: string
  wo_number: string | number
  title: string | null
  customer: string | null
  status: string | null
  status_color: string | null
  scheduled_start_at: string | null
  lead_tech_account_id: string | null
}

type Supervised = {
  /** False for anybody who sees every job — the panel then renders nothing. */
  applies: boolean
  total: number
  unassigned: number
  overdue: number
  jobs: SupervisedJob[]
}

/**
 * The work this person is answerable for but is not doing.
 *
 * Kept apart from their own schedule on purpose. A foreman's own jobs
 * belong on his day; his people's do not, or he turns up somewhere
 * because a job was in his list and it was in his list because somebody
 * else is doing it.
 *
 * **Hidden entirely for anybody who sees every job.** For an owner
 * "jobs I am not working" is the whole company, and a panel listing
 * that is noise where a number should be. The server says so with
 * `applies` rather than leaving a zero to be misread as "nothing to
 * supervise".
 *
 * Counts first, then the few that need a person. Reading it should take
 * a glance; acting on it means opening a job.
 */
export function SupervisedProjectsPanel() {
  const { data } = useQuery({
    queryKey: ['work-orders', 'supervised'],
    queryFn: () => apiRequest<{ data: Supervised }>('/v1/work-orders/supervised'),
    staleTime: 60_000,
  })

  const supervised = data?.data

  if (!supervised?.applies || supervised.total === 0) return null

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          My supervised projects
          <span className="ml-2 font-normal text-slate-500">{supervised.total}</span>
        </h2>

        {/* Words as well as colour: this is the line somebody acts on. */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          {supervised.unassigned > 0 && (
            <span className="text-red-700">{supervised.unassigned} with nobody going</span>
          )}
          {supervised.overdue > 0 && (
            <span className="text-red-700">{supervised.overdue} past due</span>
          )}
          {supervised.unassigned === 0 && supervised.overdue === 0 && (
            <span className="text-slate-500">All covered</span>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Open work on your ground that you are not doing yourself.
      </p>

      <ul className="mt-3 divide-y divide-slate-100">
        {supervised.jobs.map((job) => (
          <li key={job.id}>
            <Link
              to={`/jobs/${job.id}`}
              className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-900">
                  {job.title ?? `Job ${job.wo_number}`}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {[job.customer, job.status].filter(Boolean).join(' · ')}
                </span>
              </span>

              {!job.lead_tech_account_id && (
                <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                  Nobody going
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
