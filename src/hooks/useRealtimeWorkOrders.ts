import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { Account } from '@/lib/auth'
import { API_URL, getActingTenant, getStoredToken } from '@/lib/api'

type WorkOrderChangedEvent = {
  tenant_id: string
  action: 'created' | 'updated' | 'deleted' | string
  changed?: string[]
  work_order?: {
    id?: string
  } | null
}

type WindowWithPusher = Window & {
  Pusher?: typeof Pusher
}

const LIVE_QUERY_ROOTS = new Set([
  'accounting',
  'dashboard',
  'dispatch',
  'estimates',
  'reports',
  'schedule',
  'tasks',
  'work-order-invoices',
  'work-order-payments',
  'work-order-reimbursements',
  'work-orders',
  'work-orders-incoming-requests',
])

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'https'].includes(value.toLowerCase())
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveTenantId(account: Account | null): string | null {
  if (account?.tenant?.id) return account.tenant.id
  if (account?.is_platform_admin) return getActingTenant()
  return null
}

export function useRealtimeWorkOrders(account: Account | null): void {
  const queryClient = useQueryClient()
  const tenantId = useMemo(() => resolveTenantId(account), [account])

  useEffect(() => {
    if (!tenantId || typeof window === 'undefined') return

    const token = getStoredToken()
    const appKey = import.meta.env.VITE_REVERB_APP_KEY
    if (!token || !appKey) return

    const scheme = import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '')
    const forceTLS = boolEnv(scheme, window.location.protocol === 'https:')
    const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname
    const port = numberEnv(
      import.meta.env.VITE_REVERB_PORT,
      forceTLS ? 443 : 80,
    )

    ;(window as WindowWithPusher).Pusher = Pusher

    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }
    const actingTenant = getActingTenant()
    const authTenant = actingTenant || (account?.is_platform_admin ? tenantId : null)
    if (authTenant) {
      authHeaders['X-Act-As-Tenant'] = authTenant
    }

    const echo = new Echo({
      broadcaster: 'reverb',
      key: appKey,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS,
      // pusher-js's WebSocket transport is named 'ws'; forceTLS upgrades it to
      // wss://. 'wss' is NOT a valid transport name — listing it alone produces
      // an empty strategy and the connection fails instantly (state: failed).
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${API_URL}/broadcasting/auth`,
      auth: {
        headers: authHeaders,
      },
    })

    const channelName = `tenant.${tenantId}.work-orders`
    const channel = echo.private(channelName)

    const invalidateLive = () => {
      queryClient.invalidateQueries({
        predicate: (query) => LIVE_QUERY_ROOTS.has(String(query.queryKey[0] ?? '')),
      })
    }

    channel.listen('.work-order.changed', (event: WorkOrderChangedEvent) => {
      const workOrderId = event.work_order?.id

      invalidateLive()

      if (workOrderId) {
        queryClient.invalidateQueries({ queryKey: ['work-orders', 'detail', workOrderId] })
        queryClient.invalidateQueries({ queryKey: ['work-order-invoices', workOrderId] })
        queryClient.invalidateQueries({ queryKey: ['work-order-payments', workOrderId] })
        queryClient.invalidateQueries({ queryKey: ['work-order-reimbursements', workOrderId] })
      }

      window.dispatchEvent(new CustomEvent('crewbarn:work-order-live', { detail: event }))
    })

    // Tasks + estimates ride the same channel — a change to either refreshes the
    // calendar / task + estimate lists (both are in LIVE_QUERY_ROOTS).
    channel.listen('.task.changed', () => invalidateLive())
    channel.listen('.estimate.changed', () => invalidateLive())

    return () => {
      echo.leave(channelName)
      echo.disconnect()
    }
  }, [queryClient, tenantId])
}
