import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

/**
 * Drive history card on the WO Field Log tab — the GPS-derived drive TO
 * this job, per visit: where the tech came from, departed → arrived,
 * duration, and ≈miles (from the nightly route-log rollup, so drives
 * appear the morning after the day they happened).
 */

interface DriveFrom {
  type: 'stop' | 'day_start'
  lat: number
  lng: number
  work_order_id: string | null
}

interface Drive {
  date: string
  account_id: string | null
  tech: string | null
  from: DriveFrom | null
  departed_at: string | null
  arrived_at: string
  left_at: string | null
  drive_minutes: number | null
  drive_miles: number | null
  on_site_minutes: number | null
}

interface DrivesResponse {
  data: Drive[]
  work_orders: Record<string, { number: number | null; customer: string | null }>
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function fmtDur(mins: number | null): string {
  if (mins == null) return '—'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function WorkOrderDrivesPanel({ workOrderId }: { workOrderId: string }) {
  const q = useQuery({
    queryKey: ['wo-drives', workOrderId],
    queryFn: () => apiRequest<DrivesResponse>(`/v1/work-orders/${workOrderId}/drives`),
  })

  const drives = q.data?.data ?? []
  const fromJobs = q.data?.work_orders ?? {}

  const fromLabel = (d: Drive) => {
    if (!d.from) return '—'
    if (d.from.type === 'day_start') return 'start of day'
    const wo = d.from.work_order_id ? fromJobs[d.from.work_order_id] : undefined
    if (wo && d.from.work_order_id) {
      return (
        <Link to={`/jobs/${d.from.work_order_id}`} className="text-amber-700 hover:underline">
          Job #{wo.number ?? '—'}{wo.customer ? ` · ${wo.customer}` : ''}
        </Link>
      )
    }
    return (
      <a
        href={`https://www.google.com/maps?q=${d.from.lat},${d.from.lng}`}
        target="_blank"
        rel="noreferrer"
        className="text-amber-700 hover:underline"
      >
        a stop (map)
      </a>
    )
  }

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
        Drive history (GPS)
      </div>

      {q.isLoading && <div className="text-sm text-slate-400">Loading…</div>}

      {!q.isLoading && drives.length === 0 && (
        <div className="text-sm text-slate-500">
          No GPS drive history for this job yet. Drives are rolled up nightly —
          they appear the morning after the visit.
        </div>
      )}

      {drives.length > 0 && (
        <ul className="space-y-2">
          {drives.map((d, i) => (
            <li key={i} className="bg-white border border-slate-200 rounded-md px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-slate-900">{fmtDay(d.date)}</span>
                {d.tech && <span className="text-slate-500">· {d.tech}</span>}
                <span className="ml-auto text-slate-700 tabular-nums">
                  {fmtDur(d.drive_minutes)}
                  {d.drive_miles != null && <span className="text-slate-400"> · ≈{d.drive_miles} mi</span>}
                </span>
              </div>
              <div className="text-[13px] text-slate-600 mt-0.5">
                Departed {fmtTime(d.departed_at)} → arrived {fmtTime(d.arrived_at)}
                <span className="text-slate-300"> · </span>
                from {fromLabel(d)}
                {d.on_site_minutes != null && (
                  <>
                    <span className="text-slate-300"> · </span>
                    on site {fmtDur(d.on_site_minutes)}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
