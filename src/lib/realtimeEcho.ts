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
 *   return listenPrivate(echo, name, '.event', cb)   // the cleanup it returns
 *
 * Always go through listenPrivate, never echo.private(name).listen() plus
 * echo.leave(name). Several screens listen on the same channel (the app-wide
 * message toasts, the Messages page and the dashboard all use the comms
 * channel), and echo.leave() drops the channel with every listener on it, so
 * one screen closing would silently stop the others until a reload.
 *
 * The connection persists for the sign-in; hooks only add/remove listeners.
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
// The sign-in the shared connection was authorised with. Joining a private
// channel sends this token, and signing out is an in-app navigation (no
// reload), so without it a sign-in in the same tab would keep using the dead
// token and every channel would quietly fail to join.
let sharedToken: string | null = null

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
  if (shared && sharedTenant === key && sharedToken === token) return shared

  // Different company (a platform admin switching) or a different sign-in
  // (signed out and back in without a reload): tear the old one down first.
  // Listener counts live with each connection (see listenPrivate), so the
  // new one starts from zero.
  if (shared) {
    try {
      shared.disconnect()
    } catch {
      /* ignore */
    }
    shared = null
    sharedTenant = null
    sharedToken = null
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
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId, callback) => {
        void fetch(`${API_URL}/broadcasting/auth`, {
          method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
        }).then(async (response) => {
          if (!response.ok) throw new Error('Realtime authorization failed')
          callback(null, await response.json())
        }).catch((error: Error) => callback(error, null))
      },
    }),
  })
  sharedTenant = key
  sharedToken = token
  return shared
}

/**
 * How many listeners each channel has, per connection. Kept per connection
 * (not one global count) so a rebuilt connection starts from zero, and a late
 * cleanup from a screen that subscribed on the old connection can't knock the
 * count on the new one.
 */
const listenerCounts = new WeakMap<Echo<'reverb'>, Map<string, number>>()

/**
 * Listen for one event on a private channel, and get back the cleanup.
 *
 * The cleanup removes only this callback. It leaves the channel (stops the
 * server sending it) only when no one else on this connection is still
 * listening to it; leaving straight away would cut off every other screen on
 * the same channel.
 *
 * `event` is passed to listen and stopListening exactly as given, so a custom
 * `broadcastAs` name keeps its leading dot (e.g. '.comms.message') for both.
 * The cleanup is safe to call twice; the second call does nothing.
 */
export function listenPrivate<T = unknown>(
  echo: Echo<'reverb'>,
  channelName: string,
  event: string,
  callback: (payload: T) => void,
): () => void {
  let counts = listenerCounts.get(echo)
  if (!counts) {
    counts = new Map()
    listenerCounts.set(echo, counts)
  }

  // Keep this exact channel object: while anyone is listening it is never
  // left, so it is the one the callback is bound to at cleanup time.
  const channel = echo.private(channelName)
  channel.listen(event, callback)
  counts.set(channelName, (counts.get(channelName) ?? 0) + 1)

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    try {
      channel.stopListening(event, callback)
    } catch {
      /* already gone */
    }
    const remaining = (counts.get(channelName) ?? 1) - 1
    if (remaining > 0) {
      counts.set(channelName, remaining)
      return
    }
    counts.delete(channelName)
    try {
      echo.leave(channelName)
    } catch {
      /* already gone */
    }
  }
}
