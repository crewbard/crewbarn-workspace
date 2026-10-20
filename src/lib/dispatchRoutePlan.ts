/** Shared schedule ordering and map planning. No API calls or live GPS state. */
interface ScheduledVisit {
  id: string
  kind?: string
  lead_tech_account_id: string | null
  scheduled_start_at: string | null
  status: { category: string } | null
  location: { latitude: number | null; longitude: number | null } | null
}

export interface RoutePoint { lat: number; lng: number }

export function hasRouteCoordinates(location: ScheduledVisit['location']): boolean {
  return location != null && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && Math.abs(location.latitude!) <= 90 && Math.abs(location.longitude!) <= 180
}

export function recentRouteOrigin(position: ScheduledVisit['location'], ageSeconds: number | null, maxAgeSeconds: number): RoutePoint | null {
  return hasRouteCoordinates(position) && ageSeconds != null && Number.isFinite(ageSeconds) && ageSeconds >= 0 && ageSeconds <= maxAgeSeconds
    ? { lat: position!.latitude!, lng: position!.longitude! }
    : null
}

function visitTime(value: string | null): number {
  const time = value ? Date.parse(value) : NaN
  return Number.isFinite(time) ? time : Infinity
}

export function assignedVisits<T extends ScheduledVisit>(jobs: readonly T[], techId: string): T[] {
  return jobs.filter((job) => job.lead_tech_account_id === techId).sort((a, b) => {
    const aTime = visitTime(a.scheduled_start_at), bTime = visitTime(b.scheduled_start_at)
    return (aTime === bTime ? 0 : aTime - bTime)
      || `${a.kind ?? 'job'}:${a.id}`.localeCompare(`${b.kind ?? 'job'}:${b.id}`)
  })
}

export function routePlanForTech<T extends ScheduledVisit>(jobs: readonly T[], techId: string) {
  const remaining = assignedVisits(jobs, techId).filter((job) =>
    job.status?.category !== 'complete' && job.status?.category !== 'cancelled')
  const mapped = remaining.filter((job) => hasRouteCoordinates(job.location))
  return {
    remaining,
    stops: mapped.map((job) => ({ lat: job.location!.latitude!, lng: job.location!.longitude! })),
    missingCoordinates: remaining.length - mapped.length,
  }
}

/** Directions supports 23 intermediate waypoints. Adjacent chunks share an endpoint. */
export function routeSegments(points: readonly RoutePoint[]): RoutePoint[][] {
  const segments: RoutePoint[][] = []
  for (let start = 0; start < points.length - 1; start += 24) {
    segments.push(points.slice(start, start + 25))
  }
  return segments
}
