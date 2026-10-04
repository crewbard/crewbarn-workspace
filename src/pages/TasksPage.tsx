import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listTasks, type Task, type TaskFilters } from '@/lib/tasks'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskEditorModal } from '@/components/tasks/TaskEditorModal'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyActionCards } from '@/components/easy/EasyActionCards'

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
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
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
    <div className={`${easy ? 'w-full' : 'max-w-3xl mx-auto'} p-6 space-y-5`}>
      {easy ? <EasyPageHeading title="Tasks" description="Keep the next step in sight. Review your follow-ups or switch to the team's work below." actions={canCreateStandalone ? <button type="button" onClick={() => setEditing('new')} className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300">+ Add task</button> : undefined} /> : <div className="flex items-start justify-between gap-4">
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
      </div>}

      <div data-easy-list-toolbar className="flex items-center justify-between gap-3 flex-wrap">
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

      {easy && <EasyActionCards label="Choose your focus" actions={[
        { key: 'mine', title: 'My outstanding work', description: 'Active tasks assigned to you.', active: mine && statusView === 'active', onClick: () => { setMine(true); setStatusView('active') } },
        { key: 'team', title: 'Team work', description: 'Active tasks you are allowed to see.', active: !mine && statusView === 'active', onClick: () => { setMine(false); setStatusView('active') } },
        { key: 'history', title: 'Completed work', description: 'Review task history.', active: statusView === 'history', onClick: () => setStatusView('history') },
        { key: 'all', title: 'All tasks', description: 'Include active tasks and history.', active: statusView === 'all', onClick: () => setStatusView('all') },
      ]} />}
      {q.isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">Tasks could not be loaded. <button type="button" className="underline" onClick={() => q.refetch()}>Try again</button></div> : easy && !q.isLoading && !!q.data?.length ? <div className="grid gap-5 xl:grid-cols-2">
        {groupTasks(q.data).filter(group => group.tasks.length > 0).map(group => <section key={group.label} className="min-w-0 space-y-2" aria-label={group.label}>
          <h2 className="font-semibold text-slate-800">{group.label} <span className="text-sm font-normal text-slate-500">({group.tasks.length})</span></h2>
          <TaskList tasks={group.tasks} onEdit={setEditing} onChanged={refresh} showAnchor />
        </section>)}
      </div> : <TaskList
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
      />}

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

// Match TaskList's local date/time display; retain missing or invalid dates.
export function groupTasks(tasks: Task[], now = new Date()) {
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  const nextWeek = new Date(tomorrow)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const groups = ['Late', 'Today', 'Next 7 days', 'Later', 'No due date', 'Done', 'Cancelled'].map(label => ({ label, tasks: [] as Task[] }))
  for (const task of tasks) {
    const due = task.due_at ? new Date(task.due_at).getTime() : NaN
    const index = task.status === 'done' ? 5 : task.status === 'cancelled' ? 6 : !Number.isFinite(due) ? 4 : due < now.getTime() ? 0 : due < tomorrow.getTime() ? 1 : due < nextWeek.getTime() ? 2 : 3
    groups[index].tasks.push(task)
  }
  return groups
}
