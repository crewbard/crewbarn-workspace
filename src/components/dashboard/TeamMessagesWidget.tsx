import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listStaffThreads, type StaffThreadSummary } from '@/lib/staffMessages'
import { messageStamp } from '@/components/comms/ConversationThread'
import { StaffMessagesPanel } from '@/components/staff/StaffMessagesPanel'

/**
 * Dashboard card: internal tech ↔ office messaging. Lists the team channel +
 * each tech's thread with unread counts; clicking opens the thread in a modal
 * to read/reply. Separate from the customer comms inbox.
 */
export function TeamMessagesWidget() {
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: ['staff-threads'],
    queryFn: listStaffThreads,
    refetchInterval: 15000,
  })
  const [openThread, setOpenThread] = useState<StaffThreadSummary | null>(null)

  const threads = q.data?.data ?? []
  const unreadTotal = q.data?.unread_total ?? 0

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-navy-900">Team messages</h2>
        {unreadTotal > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
            {unreadTotal}
          </span>
        )}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto">
        {q.isLoading ? (
          <div className="p-3 text-sm text-slate-400">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="p-3 text-sm text-slate-400">No team threads yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenThread(t)}
                  className="flex w-full items-start gap-2 px-1.5 py-2 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${t.unread_count > 0 ? 'font-semibold text-navy-900' : 'text-slate-700'}`}>
                        {t.kind === 'team' ? '👥 ' : ''}{t.title ?? 'Tech'}
                      </span>
                      <span className="flex-shrink-0 text-[11px] text-slate-400">{messageStamp(t.last_message_at)}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${t.unread_count > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                      {t.last_sender_kind === 'office' ? 'You: ' : ''}{t.last_preview || 'No messages yet'}
                    </span>
                  </span>
                  {t.unread_count > 0 && (
                    <span className="mt-0.5 inline-flex min-w-[1.1rem] flex-shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold leading-5 text-white">
                      {t.unread_count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {openThread && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => {
            setOpenThread(null)
            queryClient.invalidateQueries({ queryKey: ['staff-threads'] })
          }}
        >
          <div
            className="flex h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-navy-900">
                {openThread.kind === 'team' ? 'Team' : openThread.title}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenThread(null)
                  queryClient.invalidateQueries({ queryKey: ['staff-threads'] })
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <StaffMessagesPanel
              threadId={openThread.id}
              className="min-h-0 flex-1"
              onChanged={() => queryClient.invalidateQueries({ queryKey: ['staff-threads'] })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
