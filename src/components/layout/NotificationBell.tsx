import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocationSharedOverlay } from './LocationSharedOverlay'
import {
  useUnreadNotificationCount,
  useNotificationList,
  useNotificationActions,
  type OfficeNotification,
} from '@/hooks/useOfficeNotifications'

/**
 * The office notification bell for the TopBar. Unread count polls in the
 * background; opening the dropdown fetches the recent list. Clicking a
 * notification marks it read and navigates to its link. Tenant-wide — the
 * whole office shares one bell.
 */
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const unread = useUnreadNotificationCount()
  const listQ = useNotificationList(open)
  const { markRead, markAllRead } = useNotificationActions()

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const notifications = listQ.data?.data ?? []

  const [mapFor, setMapFor] = useState<OfficeNotification | null>(null)

  function onClickNotification(n: OfficeNotification) {
    if (!n.read_at) markRead.mutate(n.id)
    setOpen(false)
    // A shared location opens on a map here, with the job/customer a tap away.
    if (n.type === 'customer.location_shared' && n.meta && (n.meta as { latitude?: unknown }).latitude != null) {
      setMapFor(n)
      return
    }
    if (n.link) navigate(n.link)
  }

  const size = compact ? 'w-8 h-8' : 'w-9 h-9'

  return (
    <div ref={wrapRef} className={`relative ${compact ? 'ml-1' : 'ml-2'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${size} relative flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 transition-colors`}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path
            d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1 4.8-1.6 5.5-.3.3-.1.9.3.9h11.6c.4 0 .6-.6.3-.9-.6-.7-1.6-2-1.6-5.5A4.5 4.5 0 0 0 10 2.5ZM8.3 16a1.8 1.8 0 0 0 3.4 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full bg-rose-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[90vw] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="text-sm font-semibold text-slate-900">Notifications</div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {listQ.isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                You're all caught up.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onClickNotification(n)}
                  className={`flex w-full gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 ${
                    n.read_at ? 'opacity-60' : ''
                  }`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot(n.severity)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{n.title}</span>
                    {n.body && (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">{n.type === 'customer.location_shared' ? n.body.replace(/\s*·\s*Map:\s*https?:\/\/\S+$/i, '') : n.body}</span>
                    )}
                    {n.type === 'customer.location_shared' && (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">📍 View on map</span>
                    )}
                    <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {mapFor && <LocationSharedOverlay n={mapFor} onClose={() => setMapFor(null)} />}
    </div>
  )
}

function severityDot(severity: OfficeNotification['severity']): string {
  if (severity === 'critical') return 'bg-rose-500'
  if (severity === 'warning') return 'bg-amber-500'
  return 'bg-sky-500'
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
