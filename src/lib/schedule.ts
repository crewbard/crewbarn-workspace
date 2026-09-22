import { apiRequest } from '@/lib/api'
import type {
  ScheduleCalendarFilters,
  ScheduleCalendarResponse,
  ScheduleWorkOrder,
} from '@/types/schedule'

export async function fetchCalendarEvents(
  filters: ScheduleCalendarFilters,
): Promise<ScheduleCalendarResponse> {
  const q = new URLSearchParams()
  q.set('start', filters.start)
  q.set('end', filters.end)
  if (filters.tech_id) q.set('tech_id', filters.tech_id)
  if (filters.crew_id) q.set('crew_id', filters.crew_id)
  if (filters.customer_q) q.set('customer_q', filters.customer_q)
  if (filters.status_ids && filters.status_ids.length > 0) {
    for (const s of filters.status_ids) q.append('status_ids[]', s)
  }
  return apiRequest<ScheduleCalendarResponse>(`/v1/work-orders/calendar?${q.toString()}`)
}

export async function fetchUnscheduledJobs(q?: string): Promise<{ data: ScheduleWorkOrder[] }> {
  const qs = new URLSearchParams()
  if (q) qs.set('q', q)
  const tail = qs.toString()
  return apiRequest<{ data: ScheduleWorkOrder[] }>(
    `/v1/work-orders/unscheduled${tail ? '?' + tail : ''}`,
  )
}

/**
 * Drop a UTC instant to a NAIVE wall-clock string ("YYYY-MM-DDTHH:mm:ss", no
 * offset). The calendar renders every event in its JOB's location zone (the
 * API sends naive job-local times), so a dragged Date's local wall-clock IS
 * the job's intended local time — we send that and let the backend re-anchor
 * it to the job's location timezone, not the dispatcher's browser zone.
 */
function toNaiveLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Reschedule a WO by patching scheduled_start_at / scheduled_end_at —
 * the unified TIMESTAMPTZ columns. Backend auto-syncs the legacy
 * date+time split columns via a saving() hook (back-compat).
 *
 * Pass leadTechAccountId === null to explicitly unassign;
 * undefined leaves the existing tech in place.
 */
export async function rescheduleWorkOrder(
  id: string,
  startIso: string,
  endIso: string,
  leadTechAccountId?: string | null,
  kind: 'job' | 'estimate' = 'job',
  statusId?: string | null,
): Promise<{ data: unknown }> {
  // Jobs vs estimates use different `is_scheduled` semantics — work orders
  // toggle an explicit flag, estimates infer "scheduled" from a non-null
  // scheduled_start_at. So we only send is_scheduled for jobs.
  const body: Record<string, unknown> = {
    scheduled_start_at: toNaiveLocal(startIso),
    scheduled_end_at: toNaiveLocal(endIso),
  }
  if (kind === 'job') body.is_scheduled = true
  if (leadTechAccountId !== undefined) {
    body.lead_tech_account_id = leadTechAccountId
  }
  // Flip status (e.g. → Scheduled) when scheduling a job off the queue.
  if (statusId) body.status_id = statusId
  const url = kind === 'estimate'
    ? `/v1/estimates/${id}`
    : `/v1/work-orders/${id}`
  return apiRequest<{ data: unknown }>(url, { method: 'PATCH', body })
}
