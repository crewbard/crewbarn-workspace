import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useTheme } from '@/hooks/useTheme'
import { addTaskNote, completeTask, listTaskNotes, type Task } from '@/lib/tasks'
import { WorkOrderDetailPage } from '@/pages/WorkOrderDetailPage'
import { EstimateDetailPage } from '@/pages/EstimateDetailPage'
import { ConversationThread } from '@/components/comms/ConversationThread'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'
import { TaskWorkArea } from '@/components/tasks/TaskWorkArea'

type Action =
  | { kind: 'conversation' | 'invoice' | 'job' | 'estimate'; id: string; path: string }
  | { kind: 'other'; path: string }
  | { kind: 'none' }

function taskAction(path: string | null | undefined): Action {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return { kind: 'none' }
  const url = new URL(path, window.location.origin)
  if (url.origin !== window.location.origin) return { kind: 'none' }
  // Opened from the page it points to (a job's own tasks): that page is right behind.
  if (url.pathname === window.location.pathname && !url.search) return { kind: 'none' }
  const conversation = url.pathname === '/communications' ? url.searchParams.get('conversation') : null
  if (conversation) return { kind: 'conversation', id: conversation, path }
  for (const [kind, pattern] of [
    ['invoice', /^\/invoices\/([^/]+)$/],
    ['job', /^\/jobs\/([^/]+)$/],
    ['estimate', /^\/estimates\/([^/]+)$/],
  ] as const) {
    const match = url.pathname.match(pattern)
    if (match) return { kind, id: match[1], path }
  }
  return { kind: 'other', path }
}

function stamp(value: string | null): string {
  if (!value) return 'No due date'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleString()
}

export function TaskAtHandOverlay({ task, onClose, onChanged }: { task: Task; onClose: () => void; onChanged: () => void }) {
  const { account } = useAuth()
  const { has } = usePermissions()
  const { theme } = useTheme()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [done, setDone] = useState(task.status === 'done')
  const action = taskAction(task.link_path)
  const canManage = task.related_type === 'work_order' ? has('jobs.edit')
    : task.related_type === 'customer' ? has('customers.edit') : has('tasks.edit')
  const canWork = canManage || (!!account && account.id === task.assignee_account_id)
  const notesKey = ['tasks', task.id, 'notes'] as const
  const notes = useQuery({ queryKey: notesKey, queryFn: () => listTaskNotes(task.id) })
  const add = useMutation({
    mutationFn: () => addTaskNote(task.id, body.trim()),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: notesKey }) },
  })
  const complete = useMutation({
    mutationFn: (next: boolean) => completeTask(task.id, next),
    onSuccess: onChanged,
    onError: () => setDone((current) => !current),
  })
  const toggleComplete = () => {
    const next = !done
    setDone(next)
    complete.mutate(next)
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Task at hand: ${task.title}`} data-task-at-hand className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 p-0 sm:p-4" onClick={onClose} onKeyDown={(event) => {
      if (event.key === 'Escape' && event.currentTarget.contains(event.target as Node)) onClose()
    }}>
      <div className="flex h-full w-full max-w-[1600px] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[min(96vh,1100px)] sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-800">Task at hand</div>
            <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} autoFocus aria-label="Close task at hand" className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close ✕</button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
          <aside className="max-h-[42vh] min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-4 lg:max-h-none lg:border-b-0 lg:border-r sm:p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs font-semibold uppercase text-slate-500">Status</div><div className="mt-1 font-semibold text-slate-900">{done ? 'Done' : task.status === 'in_progress' ? 'In progress' : 'Open'}</div></div>
              <div><div className="text-xs font-semibold uppercase text-slate-500">Due</div><div className="mt-1 font-semibold text-slate-900">{stamp(task.due_at)}</div></div>
              {task.assignee_name && <div className="col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Assigned to</div><div className="mt-1 text-slate-900">{task.assignee_name}</div></div>}
              {task.related_label && <div className="col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Related record</div><div className="mt-1 text-slate-900">{task.related_label}</div></div>}
            </div>
            {task.description && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">{task.description}</div>}
            {canWork && task.status !== 'cancelled' && <button type="button" onClick={toggleComplete} disabled={complete.isPending} className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-bold ${done ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'bg-amber-700 text-white hover:bg-amber-800'} disabled:opacity-60`}>{done ? 'Reopen task' : 'Mark task complete'}</button>}
            {complete.isError && <p role="alert" className="mt-2 text-sm text-red-700">Could not update the task. Please try again.</p>}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold text-slate-950">Work notes</h3>
              <p className="mt-1 text-xs text-slate-500">Private to staff with access to this task.</p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto" aria-label="Task notes">
                {notes.isLoading && <p className="text-sm text-slate-500">Loading notes…</p>}
                {notes.isError && <p role="alert" className="text-sm text-red-700">Could not load notes. <button type="button" onClick={() => notes.refetch()} className="underline">Try again</button></p>}
                {notes.isSuccess && notes.data.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
                {notes.data?.map((note) => <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
                  <div className="mt-1 text-xs text-slate-500">{note.author_name} · {stamp(note.created_at)}</div>
                </div>)}
              </div>
              {canWork && <form className="mt-3" onSubmit={(event) => { event.preventDefault(); if (body.trim()) add.mutate() }}>
                <label htmlFor="task-at-hand-note" className="sr-only">Add a work note</label>
                <textarea id="task-at-hand-note" value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={5000} placeholder="Add a note about what you did or what happens next…" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-amber-700 focus:outline-none" />
                <button type="submit" disabled={!body.trim() || add.isPending} className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{add.isPending ? 'Saving…' : 'Add note'}</button>
                {add.isError && <p role="alert" className="mt-2 text-sm text-red-700">{add.error instanceof Error ? add.error.message : 'Could not save note.'}</p>}
              </form>}
            </div>
          </aside>
          <div role="region" className="min-h-0 overflow-y-auto p-3 sm:p-5" aria-label="Task work area">
              {action.kind === 'conversation' && <ConversationThread conversationId={action.id} />}
              {action.kind === 'invoice' && <InvoiceDetail invoiceId={action.id} embedded presentation={theme === 'focus' ? 'focus' : 'standard'} onChanged={onChanged} />}
              {action.kind === 'job' && <WorkOrderDetailPage recordId={action.id} />}
              {action.kind === 'estimate' && <EstimateDetailPage recordId={action.id} />}
              {action.kind === 'other' && <TaskWorkArea path={action.path} onLeave={onClose} />}
              {action.kind === 'none' && <div className="rounded-xl border border-slate-200 bg-white p-6"><h3 className="font-bold text-slate-900">Work through this task</h3><p className="mt-2 text-sm text-slate-600">Record what happened in the notes, then mark it complete when the work is done.</p></div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
