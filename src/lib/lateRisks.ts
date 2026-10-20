import { apiRequest } from '@/lib/api'

/**
 * Jobs a tech may be late for: what flashes the Schedule button. Found every
 * minute on the server (App\Services\Dispatch\LateRiskDetector); the office
 * acknowledges each one to stop the flash, and one nobody has seen by
 * `toast_at` becomes a toast.
 */
/** lead_call: a lead not called by its call-by time (CrewBarn called the tech). */
export type LateReason = 'late' | 'eta' | 'still_on_job' | 'call_eta' | 'lead_call'

export interface LateRisk {
  id: string
  work_order_id: string
  work_order_number: number | null
  customer_name: string | null
  scheduled_start_at: string | null
  tech_account_id: string | null
  tech_name: string | null
  reason: LateReason
  minutes_late: number
  eta_at: string | null
  detected_at: string | null
  acknowledged_at: string | null
  acknowledged_by_name: string | null
  /** Somebody called the customer about it; it then counts as seen. */
  customer_called_at: string | null
  /** The tech heard first: the app's red pop-up and an automated call. */
  tech_alerted_at: string | null
  /** The tech opened the pop-up. */
  tech_seen_at: string | null
  /** The automated call to the tech, as Twilio reported it. */
  tech_call: { status: string; outcome: string; error: string | null; pressed: string | null; at: string | null } | null
  /** Calling the customer: why the office can't (null when it can), and the last call. */
  customer_call: {
    why_not: string | null
    last: { status: string; outcome: string; error: string | null; pressed: string | null; at: string | null } | null
  }
  /** Nobody has seen it by then: show a toast. Null once seen. */
  toast_at: string | null
}

export interface LateRisks {
  /** Off for the company, or for somebody who only sees their own jobs. */
  enabled: boolean
  toast_after_minutes: number
  items: LateRisk[]
}

export async function getLateRisks(): Promise<LateRisks> {
  return (await apiRequest<{ data: LateRisks }>('/v1/dispatch/late-risks')).data
}

export async function callCustomerAboutLate(id: string): Promise<{ ok: boolean; message: string }> {
  return (await apiRequest<{ data: { ok: boolean; message: string } }>(`/v1/dispatch/late-risks/${id}/call-customer`, { method: 'POST', body: {} })).data
}

export async function acknowledgeLateRisk(id: string): Promise<LateRisk> {
  return (await apiRequest<{ data: LateRisk }>(`/v1/dispatch/late-risks/${id}/ack`, { method: 'POST', body: {} })).data
}

/** One line on why, in the words a dispatcher would use. */
export function lateRiskLine(r: LateRisk): string {
  const tech = r.tech_name ?? 'The tech'
  const mins = Math.max(0, r.minutes_late)
  switch (r.reason) {
    case 'late':
      return `${tech} isn’t there yet: ${mins} min past the start.`
    case 'call_eta':
      return `${tech} said on a call they’ll be about ${mins} min late.`
    case 'lead_call':
      return `${tech} hasn’t called this lead: ${mins} min past the call-by time. CrewBarn called them.`
    case 'still_on_job':
      return `${tech} is still on another job.${mins > 0 ? ` About ${mins} min late by drive time.` : ''}`
    case 'eta':
    default:
      return `${tech} looks about ${mins} min out past the start.`
  }
}
