import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatPhone, getCustomerMessageCards, type CommsConversation } from '@/lib/comms'
import type { Customer, CustomerContact } from '@/types/customer'
import { ConversationThread, messageStamp, fullStamp } from './ConversationThread'
import { EmailComposerModal } from './EmailComposerModal'
import { SmsComposerModal } from './SmsComposerModal'

/**
 * CustomerMessagesTab is a scoped view of the shared comms inbox. It can start
 * both SMS and email threads, then opens the same ConversationThread used by
 * the global inbox and job messages.
 */
export function CustomerMessagesTab({ customer, fill = false }: { customer: Customer; fill?: boolean }) {
  const queryClient = useQueryClient()
  const cardsKey = ['comms', 'message-cards', customer.id] as const
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)

  const cardsQuery = useQuery({
    queryKey: cardsKey,
    queryFn: () => getCustomerMessageCards(customer.id),
    refetchInterval: 15000,
  })

  const cards = cardsQuery.data ?? []
  const refreshCards = () => queryClient.invalidateQueries({ queryKey: cardsKey })
  const defaultPhone = useMemo(() => preferredPhone(customer.contacts), [customer.contacts])
  const firstConversationId = cards.flatMap((card) => card.conversations)[0]?.id ?? null

  useEffect(() => {
    if (!selectedId && firstConversationId) {
      setSelectedId(firstConversationId)
    }
  }, [firstConversationId, selectedId])

  return (
    <div className={fill ? 'flex h-full flex-col' : undefined}>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${fill ? 'shrink-0' : ''}`}>
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Messages</h2>
          <p className="text-xs text-slate-500">Texts, emails, calls, and voicemails tied to this customer.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800"
          >
            New text
          </button>
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
          >
            New email
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 lg:grid-cols-[24rem_1fr] ${fill ? 'min-h-0 flex-1 lg:[grid-template-rows:minmax(0,1fr)]' : ''}`}>
        <div className={`space-y-4 ${fill ? 'lg:h-full lg:min-h-0 lg:overflow-y-auto' : ''}`}>
          {cardsQuery.isLoading ? (
            <div className="text-sm text-slate-400">Loading messages...</div>
          ) : cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No messages with this customer yet. Start with a text or email, or inbound texts and calls will thread here automatically.
            </div>
          ) : (
            cards.map((card) => (
              <div
                key={card.work_order_id ?? '__general__'}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    {card.work_order ? (
                      <Link
                        to={`/jobs/${card.work_order.id}?tab=messages`}
                        className="truncate text-sm font-semibold text-navy-900 hover:text-amber-700"
                      >
                        {card.work_order.display_number} - {card.work_order.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-slate-600">General</span>
                    )}
                  </div>
                  {card.unread_count > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                      {card.unread_count}
                    </span>
                  )}
                </div>
                <div>
                  {card.conversations.map((c) => (
                    <ThreadRow
                      key={c.id}
                      conversation={c}
                      active={c.id === selectedId}
                      onClick={() => setSelectedId(c.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className={`min-h-[28rem] rounded-xl border border-slate-200 bg-white ${fill ? 'lg:h-full lg:min-h-0' : 'lg:h-[36rem]'}`}>
          {selectedId ? (
            <ConversationThread key={selectedId} conversationId={selectedId} onChanged={refreshCards} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
              Select a thread to view and reply.
            </div>
          )}
        </div>
      </div>

      <EmailComposerModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        customerId={customer.id}
        defaultEmail={customer.email ?? null}
        onSent={(id) => {
          setSelectedId(id)
          refreshCards()
        }}
      />
      <SmsComposerModal
        isOpen={smsOpen}
        onClose={() => setSmsOpen(false)}
        customerId={customer.id}
        defaultPhone={defaultPhone}
        onSent={(id) => {
          setSelectedId(id)
          refreshCards()
        }}
      />
    </div>
  )
}

function preferredPhone(contacts: CustomerContact[] | undefined): string {
  const ordered = [...(contacts ?? [])].sort((a, b) => Number(b.is_main_contact) - Number(a.is_main_contact))
  return ordered.find((contact) => contact.phone)?.phone
    ?? ordered.find((contact) => contact.phone_alt)?.phone_alt
    ?? ''
}

function ThreadRow({
  conversation,
  active,
  onClick,
}: {
  conversation: CommsConversation
  active: boolean
  onClick: () => void
}) {
  const unread = conversation.unread_count > 0
  const channelLabel = conversation.channel === 'email' ? 'Email' : conversation.channel === 'call' ? 'Call' : 'Text'
  const title = conversation.channel === 'email'
    ? (conversation.external_email ?? 'Email thread')
    : formatPhone(conversation.external_number)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 border-b border-slate-50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${
        active ? 'bg-amber-50' : ''
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${unread ? 'font-semibold text-navy-900' : 'text-slate-700'}`}>
            {title}
          </span>
          <span className="flex-shrink-0 text-[11px] text-slate-400" title={fullStamp(conversation.last_message_at)}>
            {messageStamp(conversation.last_message_at)}
          </span>
        </span>
        <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {channelLabel}
        </span>
        <span className={`mt-0.5 block truncate text-xs ${unread ? 'text-slate-700' : 'text-slate-400'}`}>
          {conversation.last_direction === 'outbound' ? 'You: ' : ''}
          {conversation.last_message_preview || '-'}
        </span>
      </span>
    </button>
  )
}

export default CustomerMessagesTab
