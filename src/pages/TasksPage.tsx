import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listTasks, type Task, type TaskFilters } from '@/lib/tasks'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskEditorModal } from '@/components/tasks/TaskEditorModal'

type AnchorFilter = 'all' | 'standalone' | 'work_order' | 'customer'

const ANCHOR_TABS: { key: AnchorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'standalone', label: 'To-dos' },
  { key: 'work_order', label: 'Jobs' },
  { key: 'customer', label: 'Customers' },
]

const STATUS_TABS: { key: 'active' | 'history' | 'all'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'history', label: 'History' },
  { key: 'all', label: 'All' },
]

export function TasksPage() {
  const qc = useQueryClient()
  const { has } = usePermissions()
  const canCreateStandalone = has(PERM.TASKS_EDIT)

  const [editing, setEditing] = useState<Task | null | 'new'>(null)
  const [mine, setMine] = useState(false)
  const [anchor, setAnchor] = useState<AnchorFilter>('all')
  const [statusView, setStatusView] = useState<'active' | 'history' | 'all'>('active')
  const [searchParams, setSearchParams] = useSearchParams()

  // Arriving via the global "+" → New Task opens the create modal directly.
  useEffect(() => {
    if (searchParams.get('new') && canCreateStandalone) {
      setEditing('new')
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, canCreateStandalone, setSearchParams])

  const filters: TaskFilters = { view: statusView }
  if (mine) filters.assignee = 'me'
  if (anchor !== 'all') filters.related_type = anchor

  const q = useQuery({
    queryKey: ['tasks', 'page', mine, anchor, statusView],
    queryFn: () => listTasks(filters),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy-900">Tasks</h1>
          <p className="text-sm text-slate-600 mt-1">
            To-dos and follow-ups — standalone, or tied to a job or customer.
          </p>
        </div>
        {canCreateStandalone && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="shrink-0 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
          >
            + Add task
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {ANCHOR_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setAnchor(t.key)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                anchor === t.key ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusView(t.key)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                  statusView === t.key ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="text-xs text-slate-600 inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Assigned to me
          </label>
        </div>
      </div>

      <TaskList
        tasks={q.data ?? []}
        loading={q.isLoading}
        onEdit={(t) => setEditing(t)}
        onChanged={refresh}
        showAnchor
        emptyText={
          statusView === 'history'
            ? 'No completed tasks yet.'
            : 'No tasks. Add one to get started.'
        }
      />

      {editing && (
        <TaskEditorModal
          task={editing === 'new' ? null : editing}
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

export default TasksPage
