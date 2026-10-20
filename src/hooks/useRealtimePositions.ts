import { useEffect, useMemo, useState } from 'react'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, listenPrivate, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * Live tech GPS positions over Reverb — replaces the SSE poll
 * (`/v1/dispatch/positions/stream`) that held a long-lived php-fpm worker per
 * open dashboard tab. Returns a Map keyed by account_id, patched in place as
 * `position.updated` events arrive (latest fix per tech wins). On the one shared
 * connection (lib/realtimeEcho); it used to open its own websocket.
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

export function useRealtimePositions(account: Account | null): Map<string, Position> {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const [positions, setPositions] = useState<Map<string, Position>>(() => new Map())

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    // The dashboard's map widget listens on this channel too; the cleanup
    // removes only this listener.
    return listenPrivate(echo, `tenant.${tenantId}.positions`, '.position.updated', (p: Position) => {
      if (!p.account_id) return
      setPositions((prev) => {
        const next = new Map(prev)
        next.set(p.account_id as string, { ...p, received_at: Date.now() })
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  return positions
}
