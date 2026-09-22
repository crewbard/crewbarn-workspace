import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Geotagged status-change timeline for the WO detail. Shows who moved the job
 * to which status, when, and — critically — WHERE: each captured geotag is
 * compared against the job's service location ("at the job site" vs "3.1 mi
 * from site"), and the tech's site visits (auto GPS check-ins or manual) are
 * merged in as Arrived/Left rows so the arrival time reads straight off the
 * timeline. A red "Location blocked" chip flags a tech who denied the prompt.
 */

interface StatusRef {
  id: string
  name: string
  color: string | null
}

interface StatusEvent {
  id: string
  created_at: string | null
  actor: string | null
  from_status: StatusRef | null
  to_status: StatusRef | null
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  location_status: 'captured' | 'denied' | 'unavailable' | 'not_supported' | 'none'
  location_error: string | null
  source: string
}

interface Visit {
  id: string
  check_in_at: string | null
  check_out_at: string | null
  auto_checked_in: boolean | null
  tech?: { name: string | null; email: string | null } | null
}

type Row =
  | { kind: 'event'; at: number; e: StatusEvent }
  | { kind: 'visit'; at: number; v: Visit }

function relTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** "9:02 AM" — the exact clock time (with date when not today). */
function clockTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const sameDay = new Date().toDateString() === d.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function StatusChip({ status }: { status: StatusRef | null }) {
  if (!status) return <span className="text-slate-400">—</span>
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ background: (status.color || '#94a3b8') + '22', color: status.color || '#475569' }}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: status.color || '#94a3b8' }} />
      {status.name}
    </span>
  )
}

function LocationCell({ e, siteLat, siteLng }: { e: StatusEvent; siteLat: number | null; siteLng: number | null }) {
  if (e.location_status === 'captured' && e.latitude != null && e.longitude != null) {
    // Where was this change made relative to the job? ~0.15 mi covers the
    // geofence + normal GPS scatter; beyond that we say how far away.
    const miles =
      siteLat != null && siteLng != null
        ? haversineMiles(e.latitude, e.longitude, siteLat, siteLng)
        : null
    const atSite = miles != null && miles <= 0.15
    return (
      <span className="inline-flex items-center gap-1.5">
        {miles != null && (
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              atSite ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {atSite ? '✓ At the job site' : `${miles.toFixed(1)} mi from site`}
          </span>
        )}
        <a
          href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline"
          title={`Accuracy ±${e.accuracy_m ?? '?'}m`}
        >
          📍 Map
        </a>
      </span>
    )
  }
  if (e.location_status === 'denied') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700"
        title={e.location_error || 'The tech blocked the location prompt'}
      >
        ⚠ Location blocked
      </span>
    )
  }
  if (e.location_status === 'unavailable') {
    return <span className="text-[11px] text-amber-700">Location unavailable</span>
  }
  if (e.location_status === 'not_supported') {
    return <span className="text-[11px] text-slate-400">No location on device</span>
  }
  return <span className="text-[11px] text-slate-400">no geotag</span>
}

export function WorkOrderStatusHistory({
  workOrderId,
  siteLat = null,
  siteLng = null,
}: {
  workOrderId: string
  siteLat?: number | null
  siteLng?: number | null
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['work-order', workOrderId, 'status-events'],
    queryFn: () =>
      apiRequest<{ data: StatusEvent[] }>(`/v1/work-orders/${workOrderId}/status-events`),
  })
  const visitsQ = useQuery({
    queryKey: ['work-order', workOrderId, 'visits'],
    queryFn: () => apiRequest<{ data: Visit[] }>(`/v1/work-orders/${workOrderId}/visits`),
  })

  const events = data?.data ?? []
  const visits = visitsQ.data?.data ?? []

  // One merged timeline, newest first: status changes + site visits.
  const rows: Row[] = [
    ...events.map((e): Row => ({ kind: 'event', at: e.created_at ? Date.parse(e.created_at) : 0, e })),
    ...visits
      .filter((v) => v.check_in_at)
      .map((v): Row => ({ kind: 'visit', at: Date.parse(v.check_in_at as string), v })),
  ].sort((a, b) => b.at - a.at)

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">
          Status history
        </h2>
        <span className="text-[11px] text-slate-400">geotagged</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400">No status changes recorded yet.</div>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) =>
            row.kind === 'visit' ? (
              <li key={`v-${row.v.id}`} className="flex items-start gap-3">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-emerald-800">
                    📍 Arrived on site · {clockTime(row.v.check_in_at)}
                    {row.v.check_out_at && (
                      <span className="text-slate-600 font-normal">
                        {' '}→ left {clockTime(row.v.check_out_at)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center flex-wrap gap-x-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">
                      {row.v.tech?.name ?? row.v.tech?.email ?? 'Tech'}
                    </span>
                    <span>·</span>
                    <span>{row.v.auto_checked_in ? 'auto GPS check-in' : 'manual check-in'}</span>
                  </div>
                </div>
              </li>
            ) : (
              <li key={row.e.id} className="flex items-start gap-3">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 text-sm">
                    <StatusChip status={row.e.from_status} />
                    <span className="text-slate-400">→</span>
                    <StatusChip status={row.e.to_status} />
                  </div>
                  <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{row.e.actor ?? 'System'}</span>
                    <span>·</span>
                    <span title={row.e.created_at ?? ''}>
                      {clockTime(row.e.created_at)} ({relTime(row.e.created_at)})
                    </span>
                    <span>·</span>
                    <LocationCell e={row.e} siteLat={siteLat} siteLng={siteLng} />
                  </div>
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  )
}
