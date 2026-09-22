import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { DashRange } from '@/lib/dashboardTime'

/**
 * One cached call powering all the money widgets — replaces ~10 per-widget
 * fetches (cashflow was pulled 3–4× and four widgets each pulled 500 invoices
 * just to sum them). The backend `GET /v1/dashboard/summary` bundles cashflow +
 * receivables + avg-job-revenue and caches them 60s per tenant+range.
 *
 * Widgets read their slice off this single query, so React Query dedupes it to
 * ONE request and serves it instantly from cache on re-render. This is the
 * template the portal / marketplace / asset surfaces copy: cache once, patch
 * via Reverb where data is live.
 */

export interface CashflowBucket {
  key: string
  label: string
  /** Accrual — invoiced (earned) in this period. */
  invoiced_cents: number
  /** Cash — collected (received) in this period. */
  in_cents: number
  out_cents: number
}

/**
 * A DISCRETE calendar reporting period. Tax periods are closed units — the tax
 * year is Jan 1→Dec 31, quarters are the fixed Q1–Q4 blocks — so every money
 * figure is scoped to one of these, never to a rolling window that straddles
 * two tax years. `closed` means the period has fully elapsed (numbers final).
 */
export interface ReportPeriod {
  type: string
  /** 2025 | 2026-Q1 | 2026-07 | 2026-07-14 */
  key: string
  label: string
  short_label: string
  start: string
  end: string
  /** Local calendar dates, INCLUSIVE — what the date-based ledger reports want. */
  start_date: string
  end_date: string
  closed: boolean
}

/** Money for one period, on BOTH bases (see IRS accounting methods). */
export interface PeriodMoney {
  label?: string
  /** Accrual basis — what you invoiced (earned), paid or not. */
  invoiced_cents: number
  /** Cash basis — what you actually collected. */
  in_cents: number
  out_cents: number
  /** Cash in minus cash out. */
  net_cents: number
}

export interface DashboardSummary {
  range: string
  cashflow: {
    range: string
    /** The period these headline figures cover. */
    period: ReportPeriod
    /** Recent periods, newest first — the closed-period picker. */
    periods: ReportPeriod[]
    buckets: CashflowBucket[]
    current: PeriodMoney
    previous: PeriodMoney
    /** Scoped to the SELECTED period — never a cross-year window sum. */
    totals: PeriodMoney
  }
  receivables: {
    total_open_cents: number
    open_count: number
    aging: { key: string; label: string; cents: number }[]
    by_term: { term: string; cents: number }[]
  }
  avg_job_revenue: {
    range: string
    period: ReportPeriod
    jobs: number
    total_cents: number
    avg_cents: number
  }
}

/**
 * The period the board is currently showing. Null = the CURRENT (open) period.
 * The board provides it so every widget reports the SAME period without having
 * to thread a prop through all of them.
 */
export const DashboardPeriodContext = createContext<string | null>(null)

export function useSelectedPeriod(): string | null {
  return useContext(DashboardPeriodContext)
}

/**
 * @param period  A period key (e.g. "2025", "2026-Q1"). Omit and it follows the
 *                board's selected period; absent = the CURRENT (open) period —
 *                which for `year` means year-to-date.
 */
export function useDashboardSummary(range: DashRange, period?: string) {
  const selected = useSelectedPeriod()
  const key = period ?? selected ?? undefined
  return useQuery({
    queryKey: ['dashboard-summary', range, key ?? 'current'],
    queryFn: () =>
      apiRequest<{ data: DashboardSummary }>(
        `/v1/dashboard/summary?range=${range}${key ? `&period=${encodeURIComponent(key)}` : ''}`,
      ),
    staleTime: 60_000, // serve from cache instantly; refetch in the background
  })
}
