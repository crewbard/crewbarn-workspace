import { lazy, Suspense, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { isDeleteCancelled } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import {
  completeTask,
  deleteTask,
  isOverdue,
  PRIORITY_LABELS,
  type Task,
} from '@/lib/tasks'

const PRIORITY_CLS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-sky-100 text-sky-800',
  high: 'bg-amber-100 text-amber-900',
  urgent: 'bg-rose-100 text-rose-800',
}

function formatDue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Loaded when a task is opened: it shows a job or estimate, whose pages list tasks too.
const TaskAtHandOverlay = lazy(() => import('./TaskAtHandOverlay').then((m) => ({ default: m.TaskAtHandOverlay })))

export function TaskList({
  tasks,
  onEdit,
  onOpen,
  onChanged,
  showAnchor = false,
  emptyText = 'No tasks.',
  loading = false,
}: {
  tasks: Task[]
  onEdit: (task: Task) => void
  onOpen?: (task: Task) => void
  onChanged: () => void
  /** Show the job/customer the task is anchored to (for the global list). */
  showAnchor?: boolean
  emptyText?: string
  loading?: boolean
}) {
  // A list with no overlay of its own (a job's or customer's tasks) opens
  // tasks in one here: working a task never leaves the page.
  const [working, setWorking] = useState<Task | null>(null)
  const open = onOpen ?? setWorking
  if (loading) {
    return <div className="text-sm text-slate-500 p-4">Loading…</div>
  }
  if (tasks.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onEdit={() => onEdit(t)} onOpen={() => open(t)} onChanged={onChanged} showAnchor={showAnchor} />
      ))}
      {working && (
        <Suspense fallback={null}>
          <TaskAtHandOverlay key={working.id} task={working} onClose={() => setWorking(null)} onChanged={onChanged} />
        </Suspense>
      )}
    </div>
  )
}

function TaskRow({
  task,
  onEdit,
  onOpen,
  onChanged,
  showAnchor,
}: {
  task: Task
  onEdit: () => void
  onOpen?: () => void
  onChanged: () => void
  showAnchor: boolean
}) {
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null)
  // Show the click now; the list refetch may take longer than the save itself.
  // Once the server's task matches, the real status takes over again.
  const savedDone = task.status === 'done'
  const done = optimisticDone !== null && optimisticDone !== savedDone ? optimisticDone : savedDone
  const cancelled = task.status === 'cancelled'

  const toggle = useMutation({
    mutationFn: () => completeTask(task.id, !done),
    onSuccess: onChanged,
    onError: () => setOptimisticDone(null),
  })

  const del = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: onChanged,
    onError: (e) => {
      if (!isDeleteCancelled(e)) alert(e instanceof Error ? e.message : 'Delete failed')
    },
  })

  const overdue = isOverdue({ due_at: task.due_at, status: done ? 'done' : task.status })
  const busy = toggle.isPending || del.isPending
  // Same keys the job and customer pages use for their task panels:
  // job tasks follow jobs.edit, customer tasks customers.edit, to-dos tasks.edit.
  const { has } = usePermissions()
  const canEdit = task.related_type === 'work_order'
    ? has('jobs.edit')
    : task.related_type === 'customer'
      ? has('customers.edit')
      : has('tasks.edit')

  return (
    <div className="flex items-start gap-3 p-3">
      <button
        type="button"
        onClick={() => {
          setOptimisticDone(!done)
          toggle.mutate()
        }}
        disabled={busy}
        aria-pressed={done}
        aria-busy={toggle.isPending}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition ${
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400 text-transparent'
        }`}
      >
        ✓
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium ${done || cancelled ? 'text-slate-400 line-through' : 'text-navy-900'}`}
          >
            {task.title}
          </span>
          {task.priority !== 'normal' && (
            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${PRIORITY_CLS[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {cancelled && (
            <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              Cancelled
            </span>
          )}
        </div>

        {task.description && (
          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</div>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-slate-500">
          {task.due_at && (
            <span className={overdue ? 'text-rose-600 font-medium' : ''}>
              {overdue ? 'Overdue · ' : 'Due '}{formatDue(task.due_at)}
            </span>
          )}
          {task.assignee_name && <span>· {task.assignee_name}</span>}
          {/* A daily duty: which area it's from, and straight to where it gets done. */}
          {task.duty_area && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">{DUTY_AREA_LABELS[task.duty_area] ?? task.duty_area}</span>
          )}
          {onOpen && <button type="button" onClick={onOpen} className="rounded bg-amber-500 px-1.5 py-0.5 font-semibold text-white hover:bg-amber-600">{done ? 'Review' : 'Open'} →</button>}
          {task.auto_closed_at && <span className="text-emerald-700">· Cleared on its own</span>}
          {showAnchor && task.related_label && task.related_id && (task.related_type === 'work_order' || task.related_type === 'customer') ? (
            <Link className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 underline hover:bg-slate-200" to={`${task.related_type === 'work_order' ? '/jobs' : '/customers'}/${encodeURIComponent(task.related_id)}`}>
              {task.related_label}
            </Link>
          ) : showAnchor && task.related_label && (
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {task.related_type === 'work_order' ? '🔧' : '👤'} {task.related_label}
            </span>
          )}
        </div>
        {toggle.isError && <p role="alert" className="mt-2 text-xs text-rose-700">
          {toggle.error instanceof Error ? toggle.error.message : 'Could not update this task.'} Your change was not confirmed. Try again.
        </p>}
      </div>

      {canEdit && <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          aria-label={`Edit task: ${task.title}`}
          className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete the task "${task.title}"? This can't be undone.`)) return
            del.mutate()
          }}
          disabled={busy}
          aria-label={`Delete task: ${task.title}`}
          className="text-xs px-2.5 py-1.5 rounded text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>}
    </div>
  )
}

export default TaskList

const DUTY_AREA_LABELS: Record<string, string> = {
  jobs: 'Jobs & dispatch',
  estimates: 'Estimates',
  billing: 'Billing',
  books: 'Books',
  parts: 'Parts',
  people: 'People',
}
