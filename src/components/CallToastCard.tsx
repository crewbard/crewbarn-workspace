import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  IconMoon,
  IconPhone,
  IconPhoneX,
  IconShieldX,
  IconSparkles,
  IconMicrophone,
  IconX,
} from '@tabler/icons-react'
import { Avatar } from '@/components/Avatar'
import { toastPaused, subscribeToastPause } from '@/components/NotificationStack'
import type { CallCardState } from '@/lib/callCard'

/**
 * The incoming-call card (direction C, docs/notes/call-toast-plan.md).
 *
 * Who is calling and why, in one glance: a state line, the caller once (the
 * old card printed an unmatched number as the title and again as the
 * subtitle), the open job they are most likely ringing about, and chips only
 * for what is actually known. It fits its content, so an unknown caller is a
 * short card instead of a tall square with a hole in it.
 *
 * Timing is the shared toast timing: 20 s for a call, 12 s for a voicemail,
 * frozen while the pointer or focus is anywhere in a toast layer, and the
 * caption says so. ✕, Esc and running out all HIDE the call, which keeps
 * it in the Calls queue; only acting on it marks it handled. Those two
 * callbacks belong to IncomingCallToasts and are unchanged.
 */


const STATE_LABEL: Record<CallCardState, string> = {
  ringing: 'Incoming call',
  missed: 'Missed call',
  voicemail: 'Voicemail',
  after_hours: 'After hours',
  spam: 'Likely spam',
}

const STATE_ICON: Record<CallCardState, typeof IconPhone> = {
  ringing: IconPhone,
  missed: IconPhoneX,
  voicemail: IconMicrophone,
  after_hours: IconMoon,
  spam: IconShieldX,
}

/** Same seconds as the old card's call and vm types. */
export const CALL_CARD_SECONDS: Record<CallCardState, number> = {
  ringing: 20,
  missed: 20,
  voicemail: 12,
  after_hours: 20,
  // A spam call gets the short timer and no ring.
  spam: 12,
}

export interface CallCardWhy {
  to: string
  title: string
  detail?: string | null
}

export function CallToastCard({
  state,
  title,
  titleTo,
  avatar,
  vip,
  sub,
  sub2,
  since,
  why,
  text,
  voicemail,
  chips,
  actions,
  note,
  onHide,
  onLink,
}: {
  state: CallCardState
  title: string
  /** The name links to the customer when there is one to open. */
  titleTo?: string | null
  /** null: no person to show, so the state icon stands in. */
  avatar: { id?: string | null; imageUrl?: string | null; preset?: string | null } | null
  vip?: boolean
  sub?: string | null
  sub2?: string | null
  /** When the call came in, for "0:07" while ringing and "2 min ago" after. */
  since?: string | null
  why?: CallCardWhy | null
  text?: string | null
  voicemail?: { url: string | null; transcript: string | null } | null
  chips?: ReactNode
  actions?: ReactNode
  /** After hours: what CBI made of the call (lib/callCard afterHoursNote). */
  note?: { label: string; summary: string | null; urgent: boolean } | null
  onHide: () => void
  /** Following a link on the card counts as acting on the call. */
  onLink: () => void
}) {
  const seconds = CALL_CARD_SECONDS[state]
  const [leaving, setLeaving] = useState(false)
  const [left, setLeft] = useState(seconds * 1000)
  const [paused, setPausedView] = useState(toastPaused())
  const [now, setNow] = useState(() => Date.now())

  const hide = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onHide, 160)
  }

  useEffect(() => {
    let last = Date.now()
    const tick = window.setInterval(() => {
      const at = Date.now()
      const step = at - last
      last = at
      setNow(at)
      if (toastPaused()) return
      setLeft((remaining) => {
        const next = remaining - step
        if (next <= 0) {
          window.clearInterval(tick)
          setLeaving(true)
          window.setTimeout(onHide, 160)
          return 0
        }
        return next
      })
    }, 200)
    const stop = subscribeToastPause(() => {
      last = Date.now()
      setPausedView(toastPaused())
    })
    return () => {
      window.clearInterval(tick)
      stop()
    }
    // One timer per mounted card, as NotificationCard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc hides the call (to the queue), unless the person is typing or a
  // dialog is open: their Esc belongs to that.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target && target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return
      hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  const Icon = STATE_ICON[state]
  const ringing = state === 'ringing'
  const when = whenText(state, since, now)
  const remaining = Math.max(0, Math.min(1, left / (seconds * 1000)))
  const secondsLeft = Math.ceil(left / 1000)

  return (
    <section
      className={`cb-call${leaving ? ' cb-call-out' : ''}`}
      data-state={state}
      aria-label={`${STATE_LABEL[state]}: ${title}`}
    >
      <div className="cb-call-hd">
        <span className="cb-call-st">
          <span className="cb-call-dot" aria-hidden />
          {STATE_LABEL[state]}
        </span>
        {when && <span className="cb-call-when">· {when}</span>}
        <button
          type="button"
          onClick={hide}
          className="cb-call-x"
          aria-label="Hide. The call stays in Calls."
          title="Hide (Esc). The call stays in Calls."
        >
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </div>

      <div className="cb-call-bd" role={ringing ? 'alert' : 'status'}>
        <span className="cb-call-av">
          {avatar ? (
            <Avatar name={title} colorKey={avatar.id} imageUrl={avatar.imageUrl} preset={avatar.preset} size={44} />
          ) : (
            <span className="cb-call-av-icon">
              <Icon size={20} stroke={1.75} aria-hidden />
            </span>
          )}
          {ringing && (
            <>
              <span className="cb-call-ring" aria-hidden />
              <span className="cb-call-ring" aria-hidden />
            </>
          )}
        </span>
        <div className="cb-call-who">
          <div className="cb-call-name">
            {titleTo ? (
              <Link to={titleTo} onClick={onLink} title={title}>
                {title}
              </Link>
            ) : (
              <span title={title}>{title}</span>
            )}
            {vip && <span className="cb-call-vip">VIP</span>}
          </div>
          {sub && <div className="cb-call-sub">{sub}</div>}
          {sub2 && <div className="cb-call-sub2">{sub2}</div>}
        </div>
      </div>

      {why && (
        <div className="cb-call-why">
          <IconSparkles size={16} stroke={1.75} aria-hidden />
          <div style={{ minWidth: 0 }}>
            <Link to={why.to} onClick={onLink}>
              {why.title}
            </Link>
            {why.detail && <small>{why.detail}</small>}
          </div>
        </div>
      )}

      {note && (
        <div className="cb-call-note">
          <Icon size={16} stroke={1.75} aria-hidden />
          <div style={{ minWidth: 0 }}>
            <b>
              {note.label}
              {note.urgent && <span className="cb-call-urgent">Urgent</span>}
            </b>
            {note.summary && <small>{note.summary}</small>}
          </div>
        </div>
      )}

      {voicemail ? (
        <div className="cb-call-vm">
          {voicemail.url && <audio controls preload="none" src={voicemail.url} aria-label="Play the voicemail" />}
          {voicemail.transcript && <p>“{voicemail.transcript}”</p>}
        </div>
      ) : (
        text && <p className="cb-call-text">{text}</p>
      )}

      {chips && <div className="cb-call-chips">{chips}</div>}

      {actions && <div className="cb-call-acts">{actions}</div>}

      <div className="cb-call-cap" aria-live="off">
        <span>{paused ? 'Paused while you’re here' : `Hides in ${secondsLeft}s`}</span>
        <span>✕ or Esc keeps it in Calls</span>
      </div>
      <div className="cb-call-timer" aria-hidden>
        <b style={{ transform: `scaleX(${remaining})` }} />
      </div>
    </section>
  )
}

function whenText(state: CallCardState, since: string | null | undefined, now: number): string | null {
  if (!since) return state === 'ringing' ? 'now' : null
  const at = new Date(since).getTime()
  if (!Number.isFinite(at)) return null
  const secs = Math.max(0, Math.floor((now - at) / 1000))
  if (state === 'ringing' && secs < 600) {
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  }
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
