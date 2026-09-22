import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPhone, linkConversation, listConversations, type CommsConversation } from '@/lib/comms'
import { ConversationThread, messageStamp, fullStamp } from './ConversationThread'
import { EmailComposerModal } from './EmailComposerModal'
import { SmsComposerModal } from './SmsComposerModal'

/**
 * WorkOrderMessagesTab is the job-scoped view of the shared comms inbox.
 * It starts SMS/email threads, shows linked job threads, and lets dispatch
 * attach other customer conversations to this job.
 */
export function WorkOrderMessagesTab({
  workOrderId,
  customerId,
  fill = false,
}: {
  workOrderId: string
  customerId: string | null
  fill?: boolean
}) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)

  const linkedKey = ['comms', 'wo-threads', workOrderId] as const
  const linkedQuery = useQuery({
    queryKey: linkedKey,
    queryFn: () => listConversations({ workOrderId }),
    refetchInterval: 15000,
  })

  const custKey = ['comms', 'cust-threads', customerId] as const
  const custQuery = useQuery({
    queryKey: custKey,
    queryFn: () => (customerId ? listConversations({ customerId }) : Promise.resolve([])),
    enabled: !!customerId,
  })

  const linked = linkedQuery.data ?? []
  const linkable = (custQuery.data ?? []).filter((c) => c.work_order_id !== workOrderId)
  const firstConversationId = linked[0]?.id ?? null
  const defaultPhone = linkable.find((c) => c.channel !== 'email')?.external_number
    ?? linked.find((c) => c.channel !== 'email')?.external_number
    ?? ''

  useEffect(() => {
    if (!selectedId && firstConversationId) {
      setSelectedId(firstConversationId)
    }
  }, [firstConversationId, selectedId])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: linkedKey })
    queryClient.invalidateQueries({ queryKey: custKey })
  }

  const linkMutation = useMutation({
    mutationFn: (conversationId: string) => linkConversation(conversationId, workOrderId),
    onSuccess: (conv) => {
      setSelectedId(conv.id)
      refresh()
    },
  })

  return (
    <div className={fill ? 'flex h-full flex-col' : undefined}>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${fill ? 'shrink-0' : ''}`}>
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Messages</h2>
          <p className="text-xs text-slate-500">Texts, emails, calls, and voicemails tied to this job.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            disabled={!customerId}
            className="rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Text customer
          </button>
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            disabled={!customerId}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Email customer
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 lg:grid-cols-[24rem_1fr] ${fill ? 'min-h-0 flex-1 lg:[grid-template-rows:minmax(0,1fr)]' : ''}`}>
        <div className={`space-y-4 ${fill ? 'lg:h-full lg:min-h-0 lg:overflow-y-auto' : ''}`}>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-navy-900">
              This job's messages
            </div>
            {linkedQuery.isLoading ? (
              <div className="px-3 py-3 text-sm text-slate-400">Loading...</div>
            ) : linked.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400">
                No threads linked to this job yet. Start a text/email or link one of the customer's conversations below.
              </div>
            ) : (
              linked.map((c) => (
                <ThreadRow
                  key={c.id}
                  conversation={c}
                  active={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                />
              ))
            )}
          </div>

          {linkable.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                Other customer threads
              </div>
              {linkable.map((c) => (
                <div key={c.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700">{conversationTitle(c)}</span>
                    <span className="block truncate text-xs text-slate-400">{c.last_message_preview || '-'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => linkMutation.mutate(c.id)}
                    disabled={linkMutation.isPending}
                    className="flex-shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Link to job
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`min-h-[28rem] rounded-xl border border-slate-200 bg-white ${fill ? 'lg:h-full lg:min-h-0' : 'lg:h-[36rem]'}`}>
          {selectedId ? (
            <ConversationThread key={selectedId} conversationId={selectedId} onChanged={refresh} />
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
        customerId={customerId}
        workOrderId={workOrderId}
        onSent={(id) => {
          setSelectedId(id)
          refresh()
        }}
      />
      <SmsComposerModal
        isOpen={smsOpen}
        onClose={() => setSmsOpen(false)}
        customerId={customerId}
        workOrderId={workOrderId}
        defaultPhone={defaultPhone}
        onSent={(id) => {
          setSelectedId(id)
          refresh()
        }}
      />
    </div>
  )
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
            {conversationTitle(conversation)}
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

function conversationTitle(conversation: CommsConversation): string {
  return conversation.channel === 'email'
    ? (conversation.external_email ?? 'Email thread')
    : formatPhone(conversation.external_number)
}

export default WorkOrderMessagesTab
