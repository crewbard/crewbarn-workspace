import { useState } from 'react'
import { IconChevronDown, IconX } from '@tabler/icons-react'
import { Avatar } from '@/components/Avatar'
import { ClickToCallButton } from '@/components/comms/ClickToCallButton'

/**
 * Two or more calls at once (direction A's island, collapsed).
 *
 * The toast shows one call. Before this, a second ringing call pushed the
 * first into the Calls queue with nothing on screen to say so. The pill
 * keeps the others in sight in 56px: who, how many, and a way to bring one
 * forward or call it back. ✕ hides the pill until another call arrives;
 * the calls themselves stay in the queue either way.
 */

export interface WaitingCall {
  key: string
  name: string
  phone: string | null
  customerId: string | null
  avatar: { id?: string | null; imageUrl?: string | null; preset?: string | null } | null
  since: string | null
}

export function CallWaitingPill({
  calls,
  showingOne,
  onShow,
  onCalled,
  onDismiss,
}: {
  calls: WaitingCall[]
  /** True when a call card is already up, so the pill counts the "more". */
  showingOne: boolean
  onShow: (key: string) => void
  onCalled: (key: string) => void
  onDismiss: () => void
}) {
  const [open, setOpen] = useState(false)
  if (calls.length === 0) return null

  const first = calls[0]
  const headline = showingOne
    ? `${calls.length} more ${calls.length === 1 ? 'call' : 'calls'} waiting`
    : `${calls.length} calls waiting`
  const names = calls.slice(1, 3).map((c) => c.name).join(', ')

  return (
    <div
      className="cb-pill-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="cb-pill">
        <span className="cb-pill-avs" aria-hidden>
          {calls.slice(0, 3).map((c) => (
            <span key={c.key}>
              <Avatar name={c.name} colorKey={c.avatar?.id ?? c.key} imageUrl={c.avatar?.imageUrl} preset={c.avatar?.preset} size={36} />
            </span>
          ))}
        </span>
        <button
          type="button"
          className="cb-pill-tx"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ background: 'none', textAlign: 'left' }}
        >
          <b>{headline}</b>
          <span>
            <i>Newest</i> {first.name}
            {calls.length > 1 ? ` · ${names}` : ''}
          </span>
        </button>
        <IconChevronDown size={16} stroke={2} aria-hidden style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : undefined }} />
        <button type="button" className="cb-pill-x" onClick={onDismiss} aria-label="Hide. The calls stay in Calls.">
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="cb-pill-list" role="list" aria-label="Calls waiting">
          {calls.map((c) => (
            <div key={c.key} className="cb-pill-row" role="listitem">
              <span className="cb-pill-avs" aria-hidden>
                <span>
                  <Avatar name={c.name} colorKey={c.avatar?.id ?? c.key} imageUrl={c.avatar?.imageUrl} preset={c.avatar?.preset} size={36} />
                </span>
              </span>
              <span className="cb-pill-tx">
                <b>{c.name}</b>
                <span>{ago(c.since)}</span>
              </span>
              <button type="button" onClick={() => onShow(c.key)}>
                Show
              </button>
              {c.phone && (
                <ClickToCallButton
                  phone={c.phone}
                  customerId={c.customerId}
                  label="Call back"
                  onStarted={() => onCalled(c.key)}
                  wrapperClassName="inline-flex"
                  className="cb-pill-go"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ago(since: string | null): string {
  if (!since) return 'Waiting'
  const secs = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000))
  if (!Number.isFinite(secs)) return 'Waiting'
  if (secs < 60) return 'Just now'
  return `${Math.floor(secs / 60)} min ago`
}
