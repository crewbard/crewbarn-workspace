import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { listConversations, type CommsConversation } from '@/lib/comms'
import type { WorkOrder } from '@/types/workOrder'
import type { TodayStats, AttentionItem } from '@/types/dashboard'

/** Local YYYY-MM-DD (the work-orders filter matches on the tenant's day). */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** $ from cents, exact to the penny (money must never round). */
export function fmtUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100)
}

// ---------- Backend response shapes (existing endpoints) ----------

export interface StaleSnapshot {
  unbilled_completed: { count: number; total_dollars: number }
  past_scheduled_open: { count: number }
  dormant: { count: number }
  needs_parts: { count: number }
  parts_ordered: { count: number }
  missing_photos: { count: number }
  no_payment: { count: number; total_dollars: number }
}

export interface Receivables {
  total_open_cents: number
  open_count: number
  aging: Array<{ key: string; label: string; cents: number }>
}

export interface DashboardTimeOffRequest {
  id: string
  account_name: string | null
  type: string
  start_date: string | null
  end_date: string | null
  all_day: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
}

export interface DashboardSpotlightJob {
  id: string
  work_order_number: number | null
  title: string
  eta_at: string
  overdue_minutes: number
  status: {
    id: string
    name: string
    color: string | null
    category: string
  } | null
  customer_name: string | null
  service_location: {
    street_address: string | null
    city: string | null
    state: string | null
    postal_code: string | null
  } | null
}// ---------- Hooks ----------

/** Today's scheduled jobs (drives the Now strip, Next bar, schedule list). */
export function useTodayJobs() {
  return useQuery({
    queryKey: ['dashboard', 'today-jobs'],
    queryFn: () =>
      apiRequest<{ data: WorkOrder[] }>(`/v1/work-orders?scheduled_date=${todayIso()}&per_page=50&dashboard_ops=1`),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    select: (r) => (Array.isArray(r.data) ? r.data : []),
  })
}


/** Jobs more than one minute past ETA that remain in a non-terminal status. */
export function useDashboardSpotlight() {
  return useQuery({
    queryKey: ['dashboard', 'spotlight'],
    queryFn: () =>
      apiRequest<{ data: DashboardSpotlightJob[] }>('/v1/work-orders/dashboard/spotlight'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (response) => (Array.isArray(response.data) ? response.data : []),
  })
}
export function useClearDashboardJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workOrderId: string) =>
      apiRequest(`/v1/work-orders/${encodeURIComponent(workOrderId)}/dashboard-clear`, {
        method: 'PATCH',
        body: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'today-jobs'] }),
  })
}

export function useClearCompletedTodayJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiRequest<{ data: { updated_count: number } }>('/v1/work-orders/dashboard/clear-completed', {
        method: 'POST',
        body: { scheduled_date: todayIso() },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'today-jobs'] }),
  })
}
/** Count of jobs with no scheduled date (the calendar "to schedule" queue). */
export function useUnscheduledCount() {
  return useQuery({
    queryKey: ['dashboard', 'unscheduled-count'],
    queryFn: () =>
      apiRequest<{ data?: unknown[]; meta?: { total?: number } }>(
        '/v1/work-orders/unscheduled?per_page=200',
      ).catch(() => ({ data: [] as unknown[], meta: { total: 0 } })),
    staleTime: 60_000,
    select: (r) => r.meta?.total ?? (Array.isArray(r.data) ? r.data.length : 0),
  })
}

/** Stale-jobs rollup: ready-to-invoice (unbilled completed), past-due, dormant. */
export function useStaleSnapshot() {
  return useQuery({
    queryKey: ['dashboard', 'stale-snapshot'],
    queryFn: () =>
      apiRequest<{ data: StaleSnapshot }>('/v1/work-orders/stale-snapshot').catch(() => ({
        data: {
          unbilled_completed: { count: 0, total_dollars: 0 },
          past_scheduled_open: { count: 0 },
          dormant: { count: 0 },
          needs_parts: { count: 0 },
          parts_ordered: { count: 0 },
          missing_photos: { count: 0 },
          no_payment: { count: 0, total_dollars: 0 },
        },
      })),
    staleTime: 60_000,
    select: (r) => r.data,
  })
}

/** A/R snapshot — open balance, open count, aging buckets. */
export function useReceivables() {
  return useQuery({
    queryKey: ['dashboard', 'receivables'],
    queryFn: () =>
      apiRequest<{ data: Receivables }>('/v1/dashboard/receivables').catch(() => ({
        data: { total_open_cents: 0, open_count: 0, aging: [] },
      })),
    staleTime: 5 * 60_000,
    select: (r) => r.data,
  })
}

/** Pending time-off approvals for Today's Ops. */
export function usePendingTimeOffRequests(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'pending-time-off'],
    queryFn: () =>
      apiRequest<{ data: DashboardTimeOffRequest[] }>('/v1/time-off-requests?status=pending').catch(() => ({
        data: [] as DashboardTimeOffRequest[],
      })),
    enabled,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    select: (r) => (Array.isArray(r.data) ? r.data : []),
  })
}

/** Inbound calls where the customer spoke last = an unreturned call. */
export function useUnansweredCalls() {
  return useQuery({
    queryKey: ['dashboard', 'unanswered-calls'],
    queryFn: () => listConversations({ channel: 'call' }).catch(() => [] as CommsConversation[]),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    select: (rows) =>
      (Array.isArray(rows) ? rows : []).filter(
        (c) => c.last_direction === 'inbound' || c.unread_count > 0,
      ),
  })
}

// ---------- Pure derivations (no hooks / no API) ----------

const ACTIVE_NAMES = ['on site', 'en route', 'in progress', 'dispatched']
const DONE_NAMES = ['completed', 'complete', 'job closed', 'invoiced', 'paid']

function statusName(w: WorkOrder): string {
  return (w.status?.name ?? '').toLowerCase()
}
function startKey(w: WorkOrder): string {
  return w.schedule?.start_time ?? '99:99'
}
function isActive(w: WorkOrder): boolean {
  return ACTIVE_NAMES.includes(statusName(w))
}
function isDone(w: WorkOrder): boolean {
  return w.status?.category === 'complete' || DONE_NAMES.includes(statusName(w))
}
function isCancelled(w: WorkOrder): boolean {
  return statusName(w).includes('cancel')
}

/** Sort today's jobs by start time and split into active / next / counts. */
export function deriveTodayStats(jobs: WorkOrder[]): TodayStats {
  const sorted = [...jobs].sort((a, b) => {
    const t = startKey(a).localeCompare(startKey(b))
    return t !== 0 ? t : (a.title ?? '').localeCompare(b.title ?? '')
  })
  // Cancelled jobs drop to the end of the visible schedule.
  sorted.sort((a, b) => Number(isCancelled(a)) - Number(isCancelled(b)))

  const live = sorted.filter((w) => !isCancelled(w))
  const active = live.find(isActive) ?? null
  const done = live.filter(isDone).length
  const next =
    live.find((w) => !isDone(w) && w.id !== active?.id) ?? null
  const current = active ?? next ?? null

  return {
    total: live.length,
    done,
    remaining: Math.max(0, live.length - done),
    active,
    current,
    next,
    sorted,
  }
}

/** Build the Needs Attention queue from the rollup endpoints. */
export function deriveAttentionItems(input: {
  unscheduled: number
  stale: StaleSnapshot | undefined
  receivables: Receivables | undefined
  estimatesPending: number
}): AttentionItem[] {
  const items: AttentionItem[] = []
  const { unscheduled, stale, receivables, estimatesPending } = input

  if (unscheduled > 0) {
    items.push({
      key: 'unscheduled',
      label: 'Unscheduled jobs',
      hint: 'Waiting for a date on the calendar',
      value: String(unscheduled),
      severity: unscheduled >= 5 ? 'danger' : 'warning',
      href: '/schedule',
    })
  }

  const unbilled = stale?.unbilled_completed
  if (unbilled && unbilled.count > 0) {
    items.push({
      key: 'unbilled',
      label: 'Ready to invoice',
      hint: `$${(unbilled.total_dollars || 0).toLocaleString()} waiting to bill`,
      value: String(unbilled.count),
      severity: 'info',
      href: '/jobs?stale=unbilled_completed',
    })
  }

  const pastDue = stale?.past_scheduled_open?.count ?? 0
  if (pastDue > 0) {
    items.push({
      key: 'past_scheduled',
      label: 'Past their time',
      hint: 'Scheduled jobs not started yet',
      value: String(pastDue),
      severity: pastDue >= 3 ? 'danger' : 'warning',
      href: '/jobs?stale=past_scheduled_open',
    })
  }

  const needsParts = stale?.needs_parts?.count ?? 0
  if (needsParts > 0) {
    items.push({
      key: 'needs_parts',
      label: 'Needs parts',
      hint: 'Internal parts todo before ordering',
      value: String(needsParts),
      severity: 'warning',
      href: '/jobs?stale=needs_parts',
    })
  }

  const partsOrdered = stale?.parts_ordered?.count ?? 0
  if (partsOrdered > 0) {
    items.push({
      key: 'parts_ordered',
      label: 'Parts ordered',
      hint: 'Keep on dashboard until received and scheduled',
      value: String(partsOrdered),
      severity: 'info',
      href: '/jobs?stale=parts_ordered',
    })
  }

  // Company-rule violations on completed jobs (rules weren't followed).
  const noPayment = stale?.no_payment
  if (noPayment && noPayment.count > 0) {
    items.push({
      key: 'no_payment',
      label: 'Payment not collected',
      hint: `$${(noPayment.total_dollars || 0).toLocaleString()} COD completed but not collected on site`,
      value: String(noPayment.count),
      severity: 'danger',
      href: '/jobs?stale=no_payment',
    })
  }

  const missingPhotos = stale?.missing_photos?.count ?? 0
  if (missingPhotos > 0) {
    items.push({
      key: 'missing_photos',
      label: 'No photos uploaded',
      hint: 'Completed, customer requires photos — none attached',
      value: String(missingPhotos),
      severity: 'warning',
      href: '/jobs?stale=missing_photos',
    })
  }

  const overdueCents =
    (receivables?.aging ?? [])
      .filter((b) => b.key !== 'notdue')
      .reduce((s, b) => s + (b.cents || 0), 0) ?? 0
  if (overdueCents > 0) {
    items.push({
      key: 'overdue_ar',
      label: 'Overdue invoices',
      hint: `${receivables?.open_count ?? 0} open · A/R aging`,
      value: fmtUsd(overdueCents),
      severity: 'danger',
      href: '/accounting',
    })
  }

  if (estimatesPending > 0) {
    items.push({
      key: 'estimates_pending',
      label: 'Estimates pending reply',
      hint: 'Sent, awaiting the customer',
      value: String(estimatesPending),
      severity: 'info',
      href: '/estimates?status=sent',
    })
  }

  return items
}
