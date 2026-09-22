import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  createTask,
  listTaskAssignees,
  updateTask,
  TASK_PRIORITIES,
  PRIORITY_LABELS,
  type Task,
  type TaskAnchor,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/tasks'

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

/** ISO string → value for <input type="datetime-local"> (local time, no tz). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TaskEditorModal({
  task,
  defaultAnchor,
  onClose,
  onSaved,
}: {
  task: Task | null
  defaultAnchor?: { type: TaskAnchor; id: string; label?: string }
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = task !== null
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal')
  const [dueLocal, setDueLocal] = useState(toLocalInput(task?.due_at ?? null))
  const [assignee, setAssignee] = useState(task?.assignee_account_id ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'open')
  const [error, setError] = useState<string | null>(null)

  const roster = useQuery({ queryKey: ['task-assignees'], queryFn: listTaskAssignees })

  const save = useMutation({
    mutationFn: () => {
      const base: Partial<TaskInput> = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
        assignee_account_id: assignee || null,
      }
      if (isEdit) {
        return updateTask(task!.id, { ...base, status })
      }
      const input: TaskInput = { ...(base as TaskInput) }
      if (defaultAnchor) {
        input.related_type = defaultAnchor.type
        input.related_id = defaultAnchor.id
      }
      return createTask(input)
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  })

  const canSave = title.trim() !== '' && !save.isPending

  const anchorLabel = isEdit
    ? task?.related_label
    : defaultAnchor?.label

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-navy-900 mb-1">
          {isEdit ? 'Edit task' : 'New task'}
        </h2>
        {anchorLabel && (
          <p className="text-xs text-slate-500 mb-4">
            On{' '}
            {(isEdit ? task?.related_type : defaultAnchor?.type) === 'work_order' ? 'job' : 'customer'}{' '}
            <span className="font-medium text-slate-700">{anchorLabel}</span>
          </p>
        )}

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            className={inputCls}
            placeholder="e.g. Call customer to confirm gate code"
            autoFocus
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Details (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={3}
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputCls}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Due (optional)</span>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Assign to (optional)</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
            <option value="">Unassigned</option>
            {(roster.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {isEdit && (
          <label className="block mb-3">
            <span className="block text-xs font-medium text-slate-600 mb-1">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputCls}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        )}

        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskEditorModal
