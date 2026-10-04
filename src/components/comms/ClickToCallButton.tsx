import { useState } from 'react'
import { IconPhone } from '@tabler/icons-react'
import { startTwilioCall } from './TwilioCallOverlay'
import { PERM, usePermissions } from '@/hooks/usePermissions'

/*
 * The green pill this button wears when nobody says otherwise.
 *
 * `className` REPLACES it rather than appending to it. Appending looked
 * like the friendly choice and was not: `bg-navy-900` and `bg-emerald-50`
 * both end up in the list, and which one wins is decided by the order
 * Tailwind happened to emit them, not by the caller. The incoming-call
 * toast asked for a navy button for months and got a green one — a
 * restyle you cannot see is worse than one that is refused.
 */
const DEFAULT_LOOK = 'inline-flex items-center gap-1.5 rounded-md border border-emerald-200 '
  + 'bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 '
  + 'disabled:cursor-wait disabled:opacity-60'

interface ClickToCallButtonProps {
  phone: string
  customerId?: string | null
  workOrderId?: string | null
  className?: string
  /**
   * Wraps the button and any error under it. Inside a flex row the
   * wrapper is the flex child, not the button, so sizing has to land
   * here or the button comes out a different height from its
   * neighbours.
   */
  wrapperClassName?: string
  label?: string
  onStarted?: () => void
}

export function ClickToCallButton({
  phone,
  customerId,
  workOrderId,
  className = '',
  wrapperClassName = 'inline-flex flex-col items-start gap-1',
  label,
  onStarted,
}: ClickToCallButtonProps) {
  const { has, isLoading } = usePermissions()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canCall = !isLoading && has(PERM.CUSTOMERS_EDIT)

  if (!phone || !canCall) {
    return null
  }

  async function startCall() {
    setPending(true)
    setMessage(null)
    try {
      await startTwilioCall({ phone, customerId, workOrderId, onStarted })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Call could not be started.')
    } finally {
      setPending(false)
    }
  }

  return (
    <span className={wrapperClassName}>
      <button
        type="button"
        onClick={startCall}
        disabled={pending}
        className={className || DEFAULT_LOOK}
        title="Call with Twilio through CrewBarn"
      >
        <IconPhone size={14} aria-hidden="true" />
        {pending ? 'Calling...' : label || 'Call'}
      </button>
      {message && <span className="text-xs text-red-600">{message}</span>}
    </span>
  )
}
