import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useRealtimeComms, type CommsMessageEvent } from '@/hooks/useRealtimeComms'
import { useToastPref } from '@/hooks/useToastPrefs'
import { NotificationCard } from '@/components/NotificationCard'

/**
 * "New message" toast, hanging off the Messages nav item.
 *
 * Calls and voicemail are deliberately excluded — IncomingCallToasts already
 * pops for those, and it knows things this one does not (ringing state,
 * recording, transcription). Two toasts for one event is worse than none.
 *
 * Outbound is excluded too. The provider echoes back everything the office
 * sends, so without this filter every reply a dispatcher typed would toast
 * itself straight back at them.
 */
const seenMessageIds = new Set<string>()

function isTextLike(channel: string): boolean {
  return channel === 'sms' || channel === 'mms' || channel === 'email'
}

export function MessageToasts() {
  const { account } = useAuth()
  const queryClient = useQueryClient()
  const { has, isLoading } = usePermissions()
  const [enabled] = useToastPref('messages')
  const canSee = !isLoading && has(PERM.CUSTOMERS_VIEW)
  const [msg, setMsg] = useState<CommsMessageEvent | null>(null)

  useRealtimeComms(canSee ? account : null, 'comms', (m) => {
    // Cache refresh happens whether or not a toast is wanted — silencing the
    // pop-up should quieten the alert, not stop the inbox updating.
    queryClient.invalidateQueries({ queryKey: ['comms-conversations'] })

    if (!enabled) return
    if (m.direction !== 'inbound') return
    if (!isTextLike(m.channel)) return
    if (seenMessageIds.has(m.id)) return
    seenMessageIds.add(m.id)
    setMsg(m)
  })

  if (!canSee || !enabled || !msg) return null

  const who =
    msg.customer?.display_name ||
    msg.caller_id_name ||
    msg.external_number ||
    msg.from_number ||
    'New message'
  const preview = (msg.body ?? '').trim()
  const isEmail = msg.channel === 'email'
  const subject = ((msg as { subject?: string | null }).subject ?? '').trim()

  return (
    <NotificationCard key={msg.id}
      type={isEmail ? 'email' : 'text'}
      kind={isEmail ? 'New email' : 'New text'}
      customer={who}
      customerId={msg.customer?.id}
      vip={Boolean(msg.customer?.vip)}
      avatar={{ id: msg.customer?.id, imageUrl: msg.customer?.avatar_url, preset: msg.customer?.avatar_preset }}
      subtitle={msg.external_number || msg.from_number || ''}
      description={preview || 'Open the conversation to view this message.'}
      body={isEmail ? (
        <>
          {subject && <p className="cb-toast-clamp1 text-[13px] font-bold text-[#0F1A2E]">{subject}</p>}
          <p className="cb-toast-clamp4 text-[12px] text-slate-500">{preview || 'No preview.'}</p>
        </>
      ) : (
        <p className="cb-toast-bubble">
          <span className="cb-toast-clamp7">{preview || 'Open the conversation to view this message.'}</span>
        </p>
      )}
      onDismiss={() => setMsg(null)}
      actions={<>
        <Link
          to={msg.conversation_id ? `/communications?conversation=${encodeURIComponent(msg.conversation_id)}` : '/communications'}
          onClick={() => setMsg(null)}
          className="cb-toast-act flex-1"
        >
          Reply
        </Link>
        <Link
          to={msg.conversation_id ? `/communications?conversation=${encodeURIComponent(msg.conversation_id)}` : '/communications'}
          onClick={() => setMsg(null)}
          className="cb-toast-act-quiet"
        >
          Open thread →
        </Link>
      </>}
    />
  )
}
