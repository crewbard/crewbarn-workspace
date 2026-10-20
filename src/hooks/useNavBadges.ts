import { useQuery } from '@tanstack/react-query'
import { ApiError, apiRequest } from '@/lib/api'

/**
 * useNavBadges — the queue counts surfaced as nav badges.
 *
 * The Sidebar, the CategoryRail and the TopBar all call this hook, so they
 * share one set of query keys and react-query runs one poll for all of them.
 * Other pages invalidate these keys after an action (accepting a job, a sub
 * invoice, …), so keep them as they are.
 *
 *   - dispatchPendingCount     portal WO requests + RFQ invitations
 *   - subReviewPendingCount    NTE extensions + submitted sub invoices
 *   - inboundMirrorPendingCount cross-tenant sub jobs awaiting accept
 *   - pendingPaymentsCount     tech-collected money awaiting turnover
 */
export interface NavBadges {
  dispatchPendingCount: number
  subReviewPendingCount: number
  inboundMirrorPendingCount: number
  pendingPaymentsCount: number
  /** Open tasks this person can see: the count on the Tasks link. */
  taskCount: number
  taskOverdueCount: number
}

/**
 * For a badge's queryFn: `.catch(emptyIfNotForYou(empty))`.
 *
 * A 403 (this person doesn't have the permission behind the count) or a 402
 * (the company's plan doesn't include it, e.g. a free-plan sub account) is a
 * real answer: there is nothing here for them, so the badge gets the empty
 * result and stays off.
 *
 * Every other failure (a dropped connection, a 500, a timeout) is thrown on.
 * React Query then keeps the last count it had (it holds on to `data` when a
 * fetch fails) and tries again, so a blip never turns "3 pending payments"
 * into none. If there never was a count, the badge just doesn't show. These
 * hooks only hand back numbers, so a failed poll never shows an error.
 */
export function emptyIfNotForYou<T>(empty: T): (err: unknown) => T {
  return (err: unknown) => {
    if (err instanceof ApiError && (err.status === 403 || err.status === 402)) return empty
    throw err
  }
}

/**
 * The count on the Tasks link: open tasks this person can see (what the
 * Tasks page lists first), and how many are overdue. Under the 'tasks' key,
 * so finishing or adding a task anywhere refreshes it.
 */
export function useTaskCount(): { open: number; mine: number; overdue: number } {
  const q = useQuery({
    queryKey: ['tasks', 'nav-count'],
    queryFn: () =>
      apiRequest<{ data: { open: number; mine: number; overdue: number } }>('/v1/tasks/count').catch(
        emptyIfNotForYou({ data: { open: 0, mine: 0, overdue: 0 } }),
      ),
    refetchInterval: 60000,
  })

  return q.data?.data ?? { open: 0, mine: 0, overdue: 0 }
}

export function useNavBadges(): NavBadges {
  // Portal work-order requests + RFQ invitations: the Dispatch badge.
  const incomingReqs = useQuery({
    queryKey: ['topbar-incoming-work-requests'],
    queryFn: () =>
      apiRequest<{ data: unknown[] }>('/v1/work-orders/incoming-requests').catch(
        emptyIfNotForYou({ data: [] }),
      ),
    refetchInterval: 60000,
  })
  const incomingRfqs = useQuery({
    queryKey: ['topbar-incoming-rfqs'],
    queryFn: () =>
      apiRequest<{ data: Array<{ status: string }> }>(
        '/v1/estimate-requests/incoming',
      ).catch(emptyIfNotForYou({ data: [] })),
    refetchInterval: 60000,
  })
  const dispatchPendingCount =
    (incomingReqs.data?.data.length ?? 0) +
    (incomingRfqs.data?.data.filter((r) =>
      ['pending', 'viewed'].includes(r.status),
    ).length ?? 0)

  // NTE extension requests + submitted sub invoices awaiting this company.
  const subReviews = useQuery({
    queryKey: ['topbar-sub-reviews-pending'],
    queryFn: () =>
      apiRequest<{ data: { nte_extensions: unknown[]; invoices: unknown[] } }>(
        '/v1/sub-reviews/pending',
      ).catch(emptyIfNotForYou({ data: { nte_extensions: [], invoices: [] } })),
    refetchInterval: 60000,
  })
  const subReviewPendingCount =
    (subReviews.data?.data.nte_extensions.length ?? 0) +
    (subReviews.data?.data.invoices.length ?? 0)

  // Sub jobs from partner companies waiting for this company to accept.
  const inboundMirror = useQuery({
    queryKey: ['topbar-inbound-sub-jobs-pending'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>(
        '/v1/inbound-sub-jobs/pending-count',
      ).catch(emptyIfNotForYou({ data: { count: 0 } })),
    refetchInterval: 60000,
  })
  const inboundMirrorPendingCount = inboundMirror.data?.data.count ?? 0

  // Money a tech collected that a cash-flow manager still has to confirm.
  const pendingPayments = useQuery({
    queryKey: ['topbar-pending-payments'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>('/v1/payments/pending-count').catch(
        emptyIfNotForYou({ data: { count: 0 } }),
      ),
    refetchInterval: 60000,
  })
  const pendingPaymentsCount = pendingPayments.data?.data.count ?? 0
  const tasks = useTaskCount()

  return {
    dispatchPendingCount,
    subReviewPendingCount,
    inboundMirrorPendingCount,
    pendingPaymentsCount,
    taskCount: tasks.open,
    taskOverdueCount: tasks.overdue,
  }
}
