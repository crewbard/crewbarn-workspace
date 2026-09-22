import { useEffect, useMemo, useState } from 'react'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { Account } from '@/lib/auth'
import { API_URL, getActingTenant, getStoredToken } from '@/lib/api'

/**
 * Live tech GPS positions over Reverb — replaces the SSE poll
 * (`/v1/dispatch/positions/stream`) that held a long-lived php-fpm worker per
 * open dashboard tab. Returns a Map keyed by account_id, patched in place as
 * `position.updated` events arrive (latest fix per tech wins). Mirrors the Echo
 * setup in useRealtimeWorkOrders.
 */

export interface Position {
  id: string
  account_id: string | null
  tracking_device_id: string | null
  work_order_id: string | null
  source: string
  latitude: number
  longitude: number
  heading: number | null
  speed_mph: number | null
  accuracy_m: number | null
  ignition: boolean | null
  battery_pct: number | null
  /** Phone fixes: was the app on screen ('open') or in the background / screen off ('closed')? */
  app_state?: 'open' | 'closed' | null
  recorded_at: string | null
  age_seconds: number | null
  /** Client-side receipt time (ms epoch) — age_seconds was true at this
   *  moment, so live age = age_seconds + elapsed since received_at. */
  received_at?: number
}

type WindowWithPusher = Window & { Pusher?: typeof Pusher }

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

export function useRealtimePositions(account: Account | null): Map<string, Position> {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const [positions, setPositions] = useState<Map<string, Position>>(() => new Map())

  useEffect(() => {
    if (!tenantId || typeof window === 'undefined') return

    const token = getStoredToken()
    const appKey = import.meta.env.VITE_REVERB_APP_KEY
    if (!token || !appKey) return

    const scheme = import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '')
    const forceTLS = boolEnv(scheme, window.location.protocol === 'https:')
    const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname
    const port = numberEnv(import.meta.env.VITE_REVERB_PORT, forceTLS ? 443 : 80)

    ;(window as WindowWithPusher).Pusher = Pusher

    const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}` }
    const actingTenant = getActingTenant()
    const authTenant = actingTenant || (account?.is_platform_admin ? tenantId : null)
    if (authTenant) authHeaders['X-Act-As-Tenant'] = authTenant

    const echo = new Echo({
      broadcaster: 'reverb',
      key: appKey,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS,
      // pusher-js's WebSocket transport is named 'ws'; 'wss' alone is invalid.
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${API_URL}/broadcasting/auth`,
      auth: { headers: authHeaders },
    })

    const channelName = `tenant.${tenantId}.positions`
    echo.private(channelName).listen('.position.updated', (p: Position) => {
      if (!p.account_id) return
      setPositions((prev) => {
        const next = new Map(prev)
        next.set(p.account_id as string, { ...p, received_at: Date.now() })
        return next
      })
    })

    return () => {
      echo.leave(channelName)
      echo.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  return positions
}
