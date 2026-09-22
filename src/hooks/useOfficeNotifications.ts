import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Tenant-wide in-app office notifications (the bell). Backed by
 * /v1/notifications — disputes, external refunds, and other money events
 * the office needs to know about. Reads are RLS-scoped to the acting
 * tenant; marking read clears it for the whole office.
 */

export interface OfficeNotification {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string | null
  link: string | null
  meta: Record<string, unknown> | null
  read_at: string | null
  created_at: string | null
}

/** Lightweight unread badge — polled from the TopBar bell. */
export function useUnreadNotificationCount(enabled = true) {
  const q = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>('/v1/notifications/unread-count')
        .catch(() => ({ data: { count: 0 } })),
    refetchInterval: 60_000,
    enabled,
  })
  return q.data?.data.count ?? 0
}

/** The recent notification list — fetched when the bell dropdown opens. */
export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => apiRequest<{ data: OfficeNotification[] }>('/v1/notifications'),
    enabled,
  })
}

export function useNotificationActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    qc.invalidateQueries({ queryKey: ['notifications-list'] })
  }

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: () => apiRequest('/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: invalidate,
  })

  return { markRead, markAllRead }
}
