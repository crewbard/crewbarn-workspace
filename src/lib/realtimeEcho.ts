import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { Account } from '@/lib/auth'
import { API_URL, getActingTenant, getStoredToken } from '@/lib/api'

/**
 * ONE shared Reverb/Echo connection for the whole app. Every realtime hook
 * subscribes its channels onto this single websocket instead of each opening
 * its own — multiple Echo instances were churning the socket ("WebSocket is
 * already in CLOSING or CLOSED state" floods) and killing the live feeds
 * (notably the comms/inbound-text feed).
 *
 * Usage in a hook:
 *   const echo = getRealtimeEcho(account)
 *   if (!echo) return
 *   echo.private(name).listen('.event', cb)
 *   return () => { try { echo.leave(name) } catch {} }   // leave, do NOT disconnect
 *
 * The connection persists for the session; hooks only add/remove channels.
 */

type WindowWithPusher = Window & { Pusher?: typeof Pusher }

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'https'].includes(value.toLowerCase())
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function resolveTenantId(account: Account | null): string | null {
  if (account?.tenant?.id) return account.tenant.id
  if (account?.is_platform_admin) return getActingTenant()
  return null
}

let shared: Echo<'reverb'> | null = null
let sharedTenant: string | null = null

export function getRealtimeEcho(account: Account | null): Echo<'reverb'> | null {
  const tenantId = resolveTenantId(account)
  // A platform admin with no acting tenant still needs the socket for the
  // platform channels (Security). Everyone else needs a tenant.
  const platformOnly = !tenantId && !!account?.is_platform_admin
  if ((!tenantId && !platformOnly) || typeof window === 'undefined') return null

  const token = getStoredToken()
  const appKey = import.meta.env.VITE_REVERB_APP_KEY
  if (!token || !appKey) return null

  const key = tenantId ?? 'platform'
  if (shared && sharedTenant === key) return shared

  // Tenant changed (platform admin switching) — tear the old one down first.
  if (shared) {
    try {
      shared.disconnect()
    } catch {
      /* ignore */
    }
    shared = null
    sharedTenant = null
  }

  const scheme = import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '')
  const forceTLS = boolEnv(scheme, window.location.protocol === 'https:')
  const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname
  const port = numberEnv(import.meta.env.VITE_REVERB_PORT, forceTLS ? 443 : 80)

  ;(window as WindowWithPusher).Pusher = Pusher

  const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}` }
  const actingTenant = getActingTenant()
  const authTenant = actingTenant || (account?.is_platform_admin ? tenantId : null)
  if (authTenant) authHeaders['X-Act-As-Tenant'] = authTenant

  shared = new Echo({
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
  sharedTenant = key
  return shared
}
