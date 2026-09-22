import type { WorkOrder } from '@/types/workOrder'

/**
 * Derived "today" rollup for the Ops dashboard tab. Pure-computed from the
 * day's work orders — no extra API. `sorted` is the day's jobs in start-time
 * order (the Today's Schedule list renders straight from it).
 */
export interface TodayStats {
  /** Live jobs today (cancelled excluded). total = done + remaining. */
  total: number
  done: number
  remaining: number
  /** The one job currently being worked (on site / en route / in progress / dispatched). */
  active: WorkOrder | null
  /** The job pinned to the Now strip: active first, then the next actionable job. */
  current: WorkOrder | null
  /** First upcoming non-done, non-active job after sorting. */
  next: WorkOrder | null
  /** Every today job, start-time sorted (cancelled last). */
  sorted: WorkOrder[]
}

/**
 * One row in the Needs Attention queue. `value` is the right-aligned display
 * (a count like "7" or a money string like "$680") so the same shape can carry
 * job counts and dollar figures.
 */
export interface AttentionItem {
  key: string
  label: string
  hint: string
  value: string
  severity: 'danger' | 'warning' | 'info'
  href: string
}
