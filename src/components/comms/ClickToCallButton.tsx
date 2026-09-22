import { useState } from 'react'
import { IconPhone } from '@tabler/icons-react'
import { startTwilioCall } from './TwilioCallOverlay'
import { PERM, usePermissions } from '@/hooks/usePermissions'

interface ClickToCallButtonProps {
  phone: string
  customerId?: string | null
  workOrderId?: string | null
  className?: string
  label?: string
  onStarted?: () => void
}

export function ClickToCallButton({
  phone,
  customerId,
  workOrderId,
  className = '',
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
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={startCall}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 ${className}`}
        title="Call with Twilio through CrewBarn"
      >
        <IconPhone size={14} aria-hidden="true" />
        {pending ? 'Calling...' : label || 'Call'}
      </button>
      {message && <span className="text-xs text-red-600">{message}</span>}
    </span>
  )
}
