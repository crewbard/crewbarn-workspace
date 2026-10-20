import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listTasks, type Task, type TaskFilters } from '@/lib/tasks'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskEditorModal } from '@/components/tasks/TaskEditorModal'
import { TaskAtHandOverlay } from '@/components/tasks/TaskAtHandOverlay'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyActionCards } from '@/components/easy/EasyActionCards'

type AnchorFilter = 'all' | 'standalone' | 'work_order' | 'customer' | 'duties'

const ANCHOR_TABS: { key: AnchorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'standalone', label: 'To-dos' },
  { key: 'work_order', label: 'Jobs' },
  { key: 'customer', label: 'Customers' },
  // What Responsibilities put on the list (Tool Shed → Responsibilities).
  { key: 'duties', label: 'Daily duties' },
]

const STATUS_TABS: { key: 'active' | 'history' | 'all'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'history', label: 'History' },
  { key: 'all', label: 'All' },
]

export function TasksPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const focus = theme === 'focus'
  const qc = useQueryClient()
  const { has } = usePermissions()
  const canCreateStandalone = has(PERM.TASKS_EDIT)

  const [editing, setEditing] = useState<Task | null | 'new'>(null)
  const [workingTask, setWorkingTask] = useState<Task | null>(null)
  const [mine, setMine] = useState(false)
  const [anchor, setAnchor] = useState<AnchorFilter>('all')
  const [statusView, setStatusView] = useState<'active' | 'history' | 'all'>('active')
  const [focusView, setFocusView] = useState<'board' | 'list'>('board')
  const [focusVisible, setFocusVisible] = useState<Record<string, number>>({})
  const [focusSearch, setFocusSearch] = useState('')
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

  // ?assignee=<account id>: one person's list, from the Responsibilities board.
  const assigneeParam = searchParams.get('assignee')
  const filters: TaskFilters = { view: statusView }
  if (mine) filters.assignee = 'me'
  else if (assigneeParam) filters.assignee_account_id = assigneeParam
  if (anchor === 'duties') filters.duties = 'only'
  else if (anchor !== 'all') filters.related_type = anchor

  const q = useQuery({
    queryKey: ['tasks', 'page', mine, anchor, statusView, assigneeParam],
    queryFn: () => listTasks(filters),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] })
  const searchTerm = focusSearch.trim().toLocaleLowerCase()
  const displayedTasks = focus && searchTerm
    ? (q.data ?? []).filter(task => [task.title, task.description, task.assignee_name, task.related_label, task.duty_area]
      .some(value => value?.toLocaleLowerCase().includes(searchTerm)))
    : q.data ?? []

  return (
    <div data-focus-page="tasks" className={`${easy || focus ? 'w-full' : 'max-w-3xl mx-auto'} p-6 space-y-5`}>
      <div data-tour="tasks-header">
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
      </div>

      <div data-easy-list-toolbar className="flex items-center justify-between gap-3 flex-wrap">
        <div data-tour="tasks-anchor" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
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
        <div data-tour="tasks-status" className="flex items-center gap-3 flex-wrap">
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
        {focus && <input type="search" aria-label="Search tasks" placeholder="Search tasks, people, jobs…" value={focusSearch} onChange={event => setFocusSearch(event.target.value)} className="min-w-[230px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none" />}
        {focus && <div data-focus-task-view role="group" aria-label="Task layout" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button type="button" aria-pressed={focusView === 'board'} onClick={() => setFocusView('board')} className="rounded-md px-3 py-1.5 text-sm font-semibold">Board</button>
          <button type="button" aria-pressed={focusView === 'list'} onClick={() => setFocusView('list')} className="rounded-md px-3 py-1.5 text-sm font-semibold">List</button>
        </div>}
      </div>

      {easy && <EasyActionCards label="Choose your focus" actions={[
        { key: 'mine', title: 'My outstanding work', description: 'Active tasks assigned to you.', active: mine && statusView === 'active', onClick: () => { setMine(true); setStatusView('active') } },
        { key: 'team', title: 'Team work', description: 'Active tasks you are allowed to see.', active: !mine && statusView === 'active', onClick: () => { setMine(false); setStatusView('active') } },
        { key: 'history', title: 'Completed work', description: 'Review task history.', active: statusView === 'history', onClick: () => setStatusView('history') },
        { key: 'all', title: 'All tasks', description: 'Include active tasks and history.', active: statusView === 'all', onClick: () => setStatusView('all') },
      ]} />}
      <div data-tour="tasks-list" data-focus-task-layout={focus ? focusView : undefined}>
      {q.isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">Tasks could not be loaded. <button type="button" className="underline" onClick={() => q.refetch()}>Try again</button></div> : focus && focusView === 'board' && !q.isLoading && displayedTasks.length > 0 ? <div data-focus-task-board className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {groupTasks(displayedTasks).filter(group => group.tasks.length > 0).map(group => {
          const visible = focusVisible[group.label] ?? 30
          return <section key={group.label} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label={`${group.label} tasks`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">{group.label}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{group.tasks.length}</span>
            </div>
            <div data-focus-task-scroll className="max-h-[min(65dvh,720px)] overflow-y-auto">
              <TaskList tasks={group.tasks.slice(0, visible)} onEdit={setEditing} onOpen={setWorkingTask} onChanged={refresh} showAnchor />
            </div>
            {group.tasks.length > visible && <button type="button" onClick={() => setFocusVisible(current => ({ ...current, [group.label]: visible + 30 }))} className="w-full border-t border-slate-200 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-slate-50">Show 30 more · {group.tasks.length - visible} remaining</button>}
          </section>
        })}
      </div> : easy && !q.isLoading && !!q.data?.length ? <div className="grid gap-5 xl:grid-cols-2">
        {groupTasks(q.data).filter(group => group.tasks.length > 0).map(group => <section key={group.label} className="min-w-0 space-y-2" aria-label={group.label}>
          <h2 className="font-semibold text-slate-800">{group.label} <span className="text-sm font-normal text-slate-500">({group.tasks.length})</span></h2>
          <TaskList tasks={group.tasks} onEdit={setEditing} onOpen={setWorkingTask} onChanged={refresh} showAnchor />
        </section>)}
      </div> : <TaskList
        tasks={displayedTasks}
        loading={q.isLoading}
        onEdit={(t) => setEditing(t)}
        onOpen={setWorkingTask}
        onChanged={refresh}
        showAnchor
        emptyText={
          focus && searchTerm ? 'No tasks match your search.' : statusView === 'history'
            ? 'No completed tasks yet.'
            : canCreateStandalone ? 'No tasks. Add one to get started.' : 'No tasks.'
        }
      />}
      </div>

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
      {workingTask && <TaskAtHandOverlay key={workingTask.id} task={workingTask} onClose={() => setWorkingTask(null)} onChanged={refresh} />}
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
