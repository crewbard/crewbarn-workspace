/**
 * Generic API response wrappers shared across all entity types.
 * Match Laravel's resource collection format (Spatie/JSON:API style).
 */

export interface PaginatedResponse<T> {
  data: T[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
  /**
   * Optional live per-tab counts, keyed by tab key. List endpoints that
   * support workflow tabs add this via ->additional(['tab_counts' => …]).
   * Reflects the current search/filters but NOT the active tab.
   */
  tab_counts?: Record<string, number>

  /**
   * Optional complete-directory counts for "#" and A-Z filing folders.
   * Counts reflect active search/facets but not the selected filing folder.
   */
  filing_counts?: Record<string, number>

  /** Complete filtered work-order counts used by the Year > Month file view. */
  job_filing_counts?: {
    years: Record<string, JobFilingSummary>
    months: Record<string, Record<string, JobFilingSummary>>
  }

  /** Per-status billing-state roll-up for the Status folder view, keyed by
   *  status_id. Covers every status (computed before the status tab filter). */
  status_money?: Record<string, StatusMoneySummary>

  /** Complete filtered estimate summaries used by the Year > Month file view. */
  estimate_filing_counts?: {
    years: Record<string, EstimateFilingSummary>
    months: Record<string, Record<string, EstimateFilingSummary>>
  }
}

export interface EstimateFilingSummary {
  count: number
  approved_count: number
  denied_count: number
  /** Everything quoted in the folder, cents. */
  total_cents: number
  /** Approved. */
  won_count: number
  won_cents: number
  /** Rejected or expired. */
  lost_count: number
  lost_cents: number
  /** Draft or sent — still in play. */
  open_count: number
  open_cents: number
  /** Sent, unanswered, untouched for 14+ days. */
  dormant_count: number
  dormant_cents: number
}

/** Per year/month billing-state buckets (same shape as StatusMoneySummary), so
 *  a month folder drives the 4-box in-folder payment filter. */
export interface JobFilingSummary {
  count: number
  collected_count: number
  collected_cents: number
  unpaid_count: number
  unpaid_cents: number
  not_invoiced_count: number
  not_invoiced_cents: number
  /** Status category = complete. */
  complete_count?: number
  /** Not complete and not cancelled. */
  open_count?: number
  cancelled_count?: number
}

/** A status's jobs split into three disjoint billing states (collected /
 *  invoiced-with-balance / not-yet-invoiced), each with a count + money. */
export interface StatusMoneySummary {
  count: number
  collected_count: number
  collected_cents: number
  unpaid_count: number
  unpaid_cents: number
  not_invoiced_count: number
  not_invoiced_cents: number
  /** Present on year/month folders only (a status folder is one status). */
  complete_count?: number
  open_count?: number
  cancelled_count?: number
}

export interface ResourceResponse<T> {
  data: T
}
