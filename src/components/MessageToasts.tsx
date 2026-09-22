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

  return (
    <NotificationCard key={msg.id} kind="New message" customer={who}
      avatar={{ id: msg.customer?.id, imageUrl: msg.customer?.avatar_url, preset: msg.customer?.avatar_preset }}
      subtitle={[msg.external_number || msg.from_number, msg.customer?.vip ? 'VIP' : ''].filter(Boolean).join(' · ')}
      description={preview || 'Open the conversation to view this message.'}
      onDismiss={() => setMsg(null)}
      actions={<Link to={msg.conversation_id ? `/communications?conversation=${encodeURIComponent(msg.conversation_id)}` : '/communications'} onClick={() => setMsg(null)} className="rounded border px-3 py-1.5 text-xs font-semibold">Open messages</Link>}
    />
  )
}
