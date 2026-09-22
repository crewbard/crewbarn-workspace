import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listTasks, type Task, type TaskAnchor } from '@/lib/tasks'
import { TaskList } from './TaskList'
import { TaskEditorModal } from './TaskEditorModal'

/**
 * Anchored task list — embedded on a work-order or customer detail page.
 * Shows the tasks tied to that record + an inline "add task" pre-anchored to it.
 */
export function TasksPanel({
  anchorType,
  anchorId,
  anchorLabel,
  canEdit = true,
}: {
  anchorType: TaskAnchor
  anchorId: string
  anchorLabel?: string
  canEdit?: boolean
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Task | null | 'new'>(null)
  const [includeDone, setIncludeDone] = useState(false)

  const q = useQuery({
    queryKey: ['tasks', anchorType, anchorId, includeDone],
    queryFn: () => listTasks({ related_type: anchorType, related_id: anchorId, include_done: includeDone }),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-500 inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          Show completed
        </label>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="text-sm px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            + Add task
          </button>
        )}
      </div>

      <TaskList
        tasks={q.data ?? []}
        loading={q.isLoading}
        onEdit={(t) => setEditing(t)}
        onChanged={refresh}
        emptyText="No tasks yet."
      />

      {editing && (
        <TaskEditorModal
          task={editing === 'new' ? null : editing}
          defaultAnchor={editing === 'new' ? { type: anchorType, id: anchorId, label: anchorLabel } : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default TasksPanel
