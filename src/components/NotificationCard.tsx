import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { toastPaused, subscribeToastPause } from './NotificationStack'

/**
 * One square for every pop-up — docs/design/toasts.
 *
 * 288 × 288, whatever is in it. A coloured band says what kind of thing
 * happened before a word is read, the customer is up front with their avatar,
 * what happened is in the middle, and the next step plus Open thread sit at
 * the bottom. Long text clamps; nothing grows, so a stack of these never
 * shuffles under the pointer.
 *
 * The old card hid its detail behind "Keep details open", which meant the
 * thing you needed was one hover away and the card moved when you got it.
 * Everything is visible now.
 *
 * Timing: each card runs its own interval but reads one shared paused flag
 * from the stack, so hovering anywhere over the stack freezes every timer at
 * once. CSS animation timers were the obvious alternative and drift when
 * React reuses an element for a different toast.
 */

export type ToastType = 'call' | 'text' | 'vm' | 'email' | 'intake' | 'paid' | 'review' | 'error'

interface TypeToken {
  label: string
  /** 135° gradient for the band. */
  band: string
  /** The timer bar and the primary button's colour family. */
  accent: string
  seconds: number
  /** A ringing phone and a failure are interruptions; the rest are news. */
  urgent?: boolean
}

export const TOAST_TYPES: Record<ToastType, TypeToken> = {
  call: { label: 'Incoming call', band: 'linear-gradient(135deg,#0F1A2E,#1F2F4D)', accent: '#10B981', seconds: 20, urgent: true },
  text: { label: 'New text', band: 'linear-gradient(135deg,#E8902C,#F2AE55)', accent: '#E8902C', seconds: 8 },
  vm: { label: 'New voicemail', band: 'linear-gradient(135deg,#1F2F4D,#4D6588)', accent: '#4D6588', seconds: 12 },
  email: { label: 'New email', band: 'linear-gradient(135deg,#2D4368,#7588A8)', accent: '#2D4368', seconds: 8 },
  intake: { label: 'New intake', band: 'linear-gradient(135deg,#6D28D9,#A78BFA)', accent: '#6D28D9', seconds: 10 },
  paid: { label: 'Payment received', band: 'linear-gradient(135deg,#047857,#34D399)', accent: '#047857', seconds: 8 },
  review: { label: 'New 5-star review', band: 'linear-gradient(135deg,#D97706,#FBBF24)', accent: '#D97706', seconds: 8 },
  error: { label: 'Something went wrong', band: 'linear-gradient(135deg,#BE123C,#FB7185)', accent: '#BE123C', seconds: 12, urgent: true },
}

/** What the old callers passed. Kept so nothing has to change at once. */
const TONE_TO_TYPE: Record<string, ToastType> = { amber: 'text', violet: 'intake', rose: 'error' }

export function NotificationCard({
  kind,
  customer,
  avatar,
  customerId,
  subtitle,
  vip,
  description,
  body,
  actions,
  onDismiss,
  tone,
  type,
  urgent,
}: {
  kind: string
  customer: string
  avatar?: { id?: string | null; imageUrl?: string | null; preset?: string | null }
  /** Makes the customer row a link to their record. */
  customerId?: string | null
  subtitle?: string
  vip?: boolean
  /** Read out for urgent toasts, and used when there is no custom body. */
  description: string
  /** The middle of the card. Falls back to the description. */
  body?: ReactNode
  actions?: ReactNode
  onDismiss: () => void
  tone?: 'amber' | 'violet' | 'rose'
  type?: ToastType
  urgent?: boolean
}) {
  const kindType: ToastType = type ?? (tone ? TONE_TO_TYPE[tone] : 'text')
  const token = TOAST_TYPES[kindType]
  const isUrgent = urgent ?? token.urgent ?? false

  const [leaving, setLeaving] = useState(false)
  const [left, setLeft] = useState(token.seconds * 1000)
  const started = useRef(Date.now())

  // The flick-out has to finish before the toast is taken away, so dismissing
  // runs the animation first and calls back after it.
  const dismiss = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onDismiss, 320)
  }

  useEffect(() => {
    let last = Date.now()
    started.current = last

    const tick = window.setInterval(() => {
      const now = Date.now()
      const step = now - last
      last = now
      // Hovering the stack freezes every card at once, so the one you are
      // reading cannot vanish mid-sentence.
      if (toastPaused()) return
      setLeft((remaining) => {
        const next = remaining - step
        if (next <= 0) {
          window.clearInterval(tick)
          setLeaving(true)
          window.setTimeout(onDismiss, 320)
          return 0
        }
        return next
      })
    }, 200)

    const stopSub = subscribeToastPause(() => {
      last = Date.now()
    })

    return () => {
      window.clearInterval(tick)
      stopSub()
    }
    // One timer per mounted toast; the identity of onDismiss is stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remaining = Math.max(0, Math.min(1, left / (token.seconds * 1000)))

  const who = (
    <>
      <span className="cb-toast-av">
        <Avatar name={customer} colorKey={avatar?.id} imageUrl={avatar?.imageUrl} preset={avatar?.preset} size={60} />
        {kindType === 'call' && (
          <>
            <span className="cb-toast-ring" aria-hidden />
            <span className="cb-toast-ring cb-toast-ring-two" aria-hidden />
          </>
        )}
      </span>
      <span className="cb-toast-nm">
        <span className="cb-toast-name" title={customer}>
          {customer}
        </span>
        <span className="cb-toast-sub">
          {vip && <span className="cb-toast-vip">VIP</span>}
          <span className="truncate">{subtitle || ' '}</span>
        </span>
      </span>
    </>
  )

  return (
    <section
      className={`cb-toast${leaving ? ' cb-toast-out' : ''}`}
      data-type={kindType}
      aria-label={`${kind}: ${customer}`}
    >
      <div className="cb-toast-band" style={{ backgroundImage: token.band }}>
        <span className="cb-toast-kind">{kind || token.label}</span>
        <span className="cb-toast-when">now</span>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="cb-toast-close">
          ✕
        </button>
      </div>

      {customerId ? (
        <a href={`/customers/${customerId}`} className="cb-toast-who">
          {who}
        </a>
      ) : (
        <div className="cb-toast-who">{who}</div>
      )}

      <div role={isUrgent ? 'alert' : 'status'} className="cb-toast-body">
        {body ?? <p className="cb-toast-clamp3">{description}</p>}
        {isUrgent && !body && <span className="sr-only">{description}</span>}
      </div>

      {actions && <div className="cb-toast-acts">{actions}</div>}

      <div className="cb-toast-bar" aria-hidden>
        <b style={{ transform: `scaleX(${remaining})`, background: token.accent }} />
      </div>
    </section>
  )
}
