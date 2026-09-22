/**
 * Schedule calendar types — mirrors WorkOrderCalendarController.
 *
 * Lightweight payload: only what the calendar UI needs. Heavy relations
 * (line items, photos, etc.) are loaded on demand when the user clicks
 * an event.
 */

export type ScheduleCardDensity = 'compact' | 'standard' | 'detailed'

export interface ScheduleStatus {
  id: string
  name: string
  color: string | null
  color_secondary?: string | null
}

export interface ScheduleTech {
  id: string
  name: string | null
  email: string | null
}

export interface ScheduleCustomer {
  id: string
  name: string
  /** 'residential' | 'commercial' | 'government' — the card avatar only shows for residential. */
  type?: string | null
}

export interface ScheduleServiceLocation {
  id: string
  nickname: string | null
  street_address: string | null
  formatted_address: string | null
  latitude: number | null
  longitude: number | null
}

export interface ScheduleWorkOrder {
  /**
   * Calendar payload covers both Jobs and Estimates. `kind` discriminates
   * for visual treatment + routing drag-reschedule to the right endpoint.
   * Defaults to 'job' for backward compatibility on older payloads.
   */
  kind?: 'job' | 'estimate'
  /**
   * Estimate-only: approval lifecycle (draft → sent → approved → ...).
   * Distinct from `status` which is the field/job status (Scheduled,
   * On-site, Completed).
   */
  approval_status?: string | null
  id: string
  work_order_number: string | null
  title: string | null
  priority?: string | null
  job_type?: { id: string; name: string; color: string | null; icon?: string | null } | null
  status: ScheduleStatus | null
  /**
   * Job-local wall-clock (no offset) in the service-location timezone — the
   * calendar parses these as-if-local so every event sits at its OWN zone's
   * hour regardless of the viewer's device. `timezone`/`tz_abbrev` label it.
   */
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  timezone?: string | null
  tz_abbrev?: string | null
  estimated_duration_minutes: number | null
  lead_tech: ScheduleTech | null
  crew: { id: string; name: string; color: string | null } | null
  customer: ScheduleCustomer | null
  service_location: ScheduleServiceLocation | null
  first_status_change_at: string | null
  /** First-arrival timestamp (sticky — set once, never cleared). */
  on_site_at: string | null
  /**
   * Live "tech is on site right now" — true while a visit is open
   * (checked in, not checked out) and the job isn't completed. Clears on
   * check-out AND on completion. Prefer this over on_site_at for the pulse.
   */
  on_site?: boolean
  completed_at: string | null
  /**
   * Open-visit field status for the dispatch-board badge. Null when no open
   * visit. state ∈ on_site | left_site_checkout_needed | gps_issue | …
   */
  field_visit?: {
    state: string
    auto_checked_in: boolean
    left_site: boolean
  } | null
  /** Bill-to (dealer) when the invoice routes to someone other than the service
   *  customer — drives the round "belongs to" stamp. */
  bill_to?: { name: string; initials: string } | null
  /** At-a-glance dispatch flags → small badges on the card. */
  flags?: ScheduleFlags
}

export interface ScheduleFlags {
  signature: boolean
  photos: boolean
  cod: boolean
  geofence: boolean
  nte: boolean
  subbed: boolean
  dormant: boolean
  /** Invoice(s) on this job are fully paid → 💰 badge. */
  paid?: boolean
  /** Invoice(s) still owe a balance → 💵 badge. */
  due?: boolean
}


export interface ScheduleTimeOffBlock {
  id: string
  account_id: string
  account_name: string | null
  type: string
  start_date: string | null
  end_date: string | null
  all_day: boolean
  start_time: string | null
  end_time: string | null
  status?: 'approved'
  reason: string | null
}

export interface ScheduleCalendarResponse {
  data: ScheduleWorkOrder[]
}

export interface ScheduleCalendarFilters {
  start: string  // ISO date
  end: string    // ISO date
  tech_id?: string
  crew_id?: string
  status_ids?: string[]
  customer_q?: string
}
