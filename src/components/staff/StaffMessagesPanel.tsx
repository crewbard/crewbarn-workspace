import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getStaffThread,
  getTechThread,
  sendStaffMessage,
  type StaffMessageDto,
} from '@/lib/staffMessages'
import { messageStamp, fullStamp } from '@/components/comms/ConversationThread'

/**
 * Reusable internal tech↔office thread view + composer. Pass a threadId, or a
 * techAccountId to resolve-or-open that tech's 1:1 thread (used by the Staff
 * page tab). Reuses the comms message stamp for consistency.
 */
export function StaffMessagesPanel({
  threadId,
  techAccountId,
  onChanged,
  className,
}: {
  threadId?: string
  techAccountId?: string
  onChanged?: () => void
  className?: string
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const key = ['staff-thread', threadId ?? `tech:${techAccountId}`] as const
  const q = useQuery({
    queryKey: key,
    queryFn: () => (threadId ? getStaffThread(threadId) : getTechThread(techAccountId!)),
    enabled: Boolean(threadId || techAccountId),
    refetchInterval: 10000,
  })

  const detail = q.data?.data
  const resolvedThreadId = detail?.thread.id ?? threadId
  const messages = detail?.messages ?? []

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const send = useMutation({
    mutationFn: (body: string) => sendStaffMessage(resolvedThreadId!, body),
    onSuccess: () => {
      setDraft('')
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: ['staff-threads'] })
      onChanged?.()
    },
  })

  const submit = () => {
    const body = draft.trim()
    if (!body || !resolvedThreadId || send.isPending) return
    send.mutate(body)
  }

  return (
    <div className={`flex min-h-0 flex-col ${className ?? ''}`}>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3">
        {q.isLoading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No messages yet. Say hello.</div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder="Message… (Enter to send)"
            className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={draft.trim() === '' || send.isPending || !resolvedThreadId}
            className="flex-shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ m }: { m: StaffMessageDto }) {
  return (
    <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        {!m.mine && m.sender_name && (
          <div className="mb-0.5 text-[11px] font-medium text-slate-500">{m.sender_name}</div>
        )}
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
            m.mine ? 'rounded-br-sm bg-amber-500 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
          }`}
        >
          {m.body}
        </div>
        <div className={`mt-0.5 text-[11px] text-slate-400 ${m.mine ? 'text-right' : 'text-left'}`} title={fullStamp(m.created_at)}>
          {m.channel === 'sms' ? 'SMS · ' : ''}
          {messageStamp(m.created_at)}
        </div>
      </div>
    </div>
  )
}
