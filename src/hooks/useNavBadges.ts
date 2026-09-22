import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * useNavBadges — the four queue counts surfaced as nav badges.
 *
 * Uses the SAME query keys as the TopBar's inline queries, so react-query
 * dedupes: mounting both the classic TopBar and the pro Sidebar does not
 * double the network requests. Every count silently degrades to 0 if the
 * account lacks the relevant permission (the endpoints 403 → caught).
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
}

export function useNavBadges(): NavBadges {
  const incomingReqs = useQuery({
    queryKey: ['topbar-incoming-work-requests'],
    queryFn: () =>
      apiRequest<{ data: unknown[] }>('/v1/work-orders/incoming-requests').catch(
        () => ({ data: [] }),
      ),
    refetchInterval: 60000,
  })
  const incomingRfqs = useQuery({
    queryKey: ['topbar-incoming-rfqs'],
    queryFn: () =>
      apiRequest<{ data: Array<{ status: string }> }>(
        '/v1/estimate-requests/incoming',
      ).catch(() => ({ data: [] })),
    refetchInterval: 60000,
  })
  const dispatchPendingCount =
    (incomingReqs.data?.data.length ?? 0) +
    (incomingRfqs.data?.data.filter((r) =>
      ['pending', 'viewed'].includes(r.status),
    ).length ?? 0)

  const subReviews = useQuery({
    queryKey: ['topbar-sub-reviews-pending'],
    queryFn: () =>
      apiRequest<{ data: { nte_extensions: unknown[]; invoices: unknown[] } }>(
        '/v1/sub-reviews/pending',
      ).catch(() => ({ data: { nte_extensions: [], invoices: [] } })),
    refetchInterval: 60000,
  })
  const subReviewPendingCount =
    (subReviews.data?.data.nte_extensions.length ?? 0) +
    (subReviews.data?.data.invoices.length ?? 0)

  const inboundMirror = useQuery({
    queryKey: ['topbar-inbound-sub-jobs-pending'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>(
        '/v1/inbound-sub-jobs/pending-count',
      ).catch(() => ({ data: { count: 0 } })),
    refetchInterval: 60000,
  })
  const inboundMirrorPendingCount = inboundMirror.data?.data.count ?? 0

  const pendingPayments = useQuery({
    queryKey: ['topbar-pending-payments'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>('/v1/payments/pending-count').catch(
        () => ({ data: { count: 0 } }),
      ),
    refetchInterval: 60000,
  })
  const pendingPaymentsCount = pendingPayments.data?.data.count ?? 0

  return {
    dispatchPendingCount,
    subReviewPendingCount,
    inboundMirrorPendingCount,
    pendingPaymentsCount,
  }
}
