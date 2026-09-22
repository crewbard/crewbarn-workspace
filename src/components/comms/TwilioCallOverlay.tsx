import { useEffect, useRef, useState } from 'react'
import { Device } from '@twilio/voice-sdk'
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconPhoneOff,
  IconX,
} from '@tabler/icons-react'
import { formatPhone, getVoiceSdkToken } from '@/lib/comms'

type CallStatus = 'dialing' | 'ringing' | 'connected' | 'ended' | 'error'

export interface TwilioCallRequest {
  phone: string
  customerId?: string | null
  workOrderId?: string | null
  onStarted?: () => void
}

type StartCall = (request: TwilioCallRequest) => Promise<void>

let mountedStartCall: StartCall | null = null

export function startTwilioCall(request: TwilioCallRequest): Promise<void> {
  if (!mountedStartCall) {
    return Promise.reject(new Error('CrewBarn calling is still loading. Please try again.'))
  }

  return mountedStartCall(request)
}

export function TwilioCallOverlay() {
  const [request, setRequest] = useState<TwilioCallRequest | null>(null)
  const [status, setStatus] = useState<CallStatus>('ended')
  const [message, setMessage] = useState('')
  const [muted, setMuted] = useState(false)
  const deviceRef = useRef<Device | null>(null)
  const callRef = useRef<any>(null)
  const activeRequestRef = useRef<TwilioCallRequest | null>(null)

  useEffect(() => {
    mountedStartCall = async (nextRequest) => {
      if (callRef.current || activeRequestRef.current) {
        throw new Error('Finish the current call before starting another one.')
      }

      const phone = nextRequest.phone.trim()
      if (!phone) {
        throw new Error('This contact does not have a valid phone number.')
      }

      activeRequestRef.current = nextRequest
      setRequest(nextRequest)
      setMuted(false)
      setStatus('dialing')
      setMessage(`Calling ${formatPhone(phone) || phone}`)

      try {
        const token = await getVoiceSdkToken()
        let device = deviceRef.current

        if (!device) {
          device = new Device(token.token, {
            logLevel: 'warn',
            closeProtection: true,
          })
          device.on('error', (error: any) => {
            setStatus('error')
            setMessage(error?.message || 'Twilio could not complete the call.')
          })
          device.on('tokenWillExpire', async () => {
            try {
              const refreshed = await getVoiceSdkToken()
              deviceRef.current?.updateToken(refreshed.token)
            } catch {
              // An active call can finish with its existing token.
            }
          })
          deviceRef.current = device
        } else {
          device.updateToken(token.token)
        }

        const params: Record<string, string> = {
          To: phone,
          source: 'customer',
        }
        if (nextRequest.customerId) params.customer_id = nextRequest.customerId
        if (nextRequest.workOrderId) params.work_order_id = nextRequest.workOrderId

        const call = await device.connect({ params })
        callRef.current = call
        setStatus('ringing')
        setMessage(`Ringing ${formatPhone(phone) || phone}`)
        nextRequest.onStarted?.()

        call.on('accept', () => {
          setStatus('connected')
          setMessage(`Connected to ${formatPhone(phone) || phone}`)
        })
        call.on('disconnect', () => finishCall('Call ended'))
        call.on('cancel', () => finishCall('Call canceled'))
        call.on('reject', () => finishCall('Call was not answered'))
        call.on('error', (error: any) => finishCall(error?.message || 'Call failed', true))
      } catch (error) {
        activeRequestRef.current = null
        callRef.current = null
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Twilio could not start the call.')
        throw error
      }
    }

    return () => {
      mountedStartCall = null
      callRef.current?.disconnect?.()
      deviceRef.current?.destroy?.()
    }
  }, [])

  function finishCall(nextMessage: string, failed = false) {
    callRef.current = null
    activeRequestRef.current = null
    setMuted(false)
    setStatus(failed ? 'error' : 'ended')
    setMessage(nextMessage)
  }

  function hangUp() {
    callRef.current?.disconnect?.()
    finishCall('Call ended')
  }

  function toggleMute() {
    const next = !muted
    callRef.current?.mute?.(next)
    setMuted(next)
  }

  function close() {
    if (callRef.current) hangUp()
    setRequest(null)
    setMessage('')
  }

  if (!request) return null

  const active = status === 'dialing' || status === 'ringing' || status === 'connected'
  const formattedPhone = formatPhone(request.phone) || request.phone

  return (
    <section className="pointer-events-auto rounded-lg border border-slate-200 bg-white shadow-2xl" aria-live="polite">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">CrewBarn Twilio call</p>
          <p className="truncate text-sm font-semibold text-slate-900">{formattedPhone}</p>
          <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>{message}</p>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label={active ? 'End and close call' : 'Close call panel'}
          title={active ? 'End and close call' : 'Close'}
        >
          <IconX size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
          <IconPhone size={18} aria-hidden="true" />
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            disabled={status !== 'connected'}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={muted ? 'Unmute call' : 'Mute call'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <IconMicrophoneOff size={18} aria-hidden="true" /> : <IconMicrophone size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={hangUp}
            disabled={!active}
            className="grid h-9 w-9 place-items-center rounded-md bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="End call"
            title="End call"
          >
            <IconPhoneOff size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
