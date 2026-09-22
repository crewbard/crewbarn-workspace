import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import {
  completeTask,
  isOverdue,
  listTaskAssignees,
  PRIORITY_LABELS,
  updateTask,
  type Task,
} from '@/lib/tasks'
import { TaskEditorModal } from '@/components/tasks/TaskEditorModal'

/**
 * A calendar task card — richer than a bare chip (title, due time, assignee,
 * priority, anchor context) and styled distinctly from job blocks. Left-click
 * opens the editor; right-click opens a quick-action menu (complete / assign /
 * edit), gated by what the viewer may do to that task's anchor.
 */
export function CalendarTaskCard({ task }: { task: Task }) {
  const qc = useQueryClient()
  const { has, accountId } = usePermissions()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)

  const done = task.status === 'done' || task.status === 'cancelled'
  const overdue = !done && isOverdue(task)

  // What can this viewer do to THIS task (by anchor)? Mirrors the backend.
  const canManage =
    task.related_type === 'work_order'
      ? has(PERM.JOBS_EDIT)
      : task.related_type === 'customer'
        ? has(PERM.CUSTOMERS_EDIT)
        : has(PERM.TASKS_EDIT)
  const canComplete = canManage || (!!accountId && task.assignee_account_id === accountId)

  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  const toggleDone = useMutation({
    mutationFn: () => completeTask(task.id, !done),
    onSuccess: refresh,
  })
  const assign = useMutation({
    mutationFn: (accountIdToSet: string | null) =>
      updateTask(task.id, { assignee_account_id: accountIdToSet }),
    onSuccess: refresh,
  })

  // Accent + tint by state: done → slate, overdue → red, high/urgent → amber,
  // else violet (so tasks never read as status-colored job blocks).
  const accent = done
    ? '#94a3b8'
    : overdue
      ? '#e11d48'
      : task.priority === 'urgent' || task.priority === 'high'
        ? '#d97706'
        : '#7c3aed'
  const tint = done
    ? 'bg-slate-50'
    : overdue
      ? 'bg-rose-50'
      : task.priority === 'urgent' || task.priority === 'high'
        ? 'bg-amber-50'
        : 'bg-violet-50'

  const due = task.due_at
    ? new Date(task.due_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
    : null

  function openMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          // Native drag — calendar day cells / tech lanes already handle a
          // text/plain drop (for unscheduled jobs); we tag tasks so those
          // handlers can reschedule (by day) or reassign (by lane).
          e.dataTransfer.setData('text/plain', `task:${task.id}`)
          e.dataTransfer.effectAllowed = 'move'
          // The default native drag image is faint/translucent. Render a crisp,
          // opaque clone of the card so it keeps its shape while dragging.
          const el = e.currentTarget
          const rect = el.getBoundingClientRect()
          const ghost = el.cloneNode(true) as HTMLElement
          ghost.style.position = 'fixed'
          ghost.style.top = '-9999px'
          ghost.style.left = '0'
          ghost.style.width = `${rect.width}px`
          ghost.style.opacity = '1'
          ghost.style.pointerEvents = 'none'
          ghost.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)'
          document.body.appendChild(ghost)
          e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top)
          // Remove once the browser has snapshotted it for the drag image.
          setTimeout(() => ghost.remove(), 0)
        }}
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        onContextMenu={openMenu}
        title={task.title}
        className={`block w-full cursor-grab rounded border border-slate-200 ${tint} px-1.5 py-1 text-left leading-tight active:cursor-grabbing`}
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className={`flex items-center gap-1 text-[11px] font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          <span className="shrink-0" style={{ color: accent }}>✓</span>
          <span className="truncate">{task.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
          {due && <span className={overdue ? 'font-semibold text-rose-600' : ''}>{overdue ? 'overdue · ' : ''}{due}</span>}
          {task.priority !== 'normal' && <span className="uppercase font-semibold">{PRIORITY_LABELS[task.priority]}</span>}
        </div>
        {task.assignee_name && (
          <div className="text-[10px] text-slate-500 truncate">👤 {task.assignee_name}</div>
        )}
        {task.related_label && (
          <div className="text-[10px] text-slate-500 truncate">
            {task.related_type === 'work_order' ? '🔧' : '👤'} {task.related_label}
          </div>
        )}
      </button>

      {menu && (
        <TaskMenu
          x={menu.x}
          y={menu.y}
          done={done}
          canManage={canManage}
          canComplete={canComplete}
          currentAssignee={task.assignee_account_id}
          onClose={() => setMenu(null)}
          onToggleDone={() => {
            toggleDone.mutate()
            setMenu(null)
          }}
          onAssign={(id) => {
            assign.mutate(id)
            setMenu(null)
          }}
          onEdit={() => {
            setEditing(true)
            setMenu(null)
          }}
        />
      )}

      {editing && (
        <TaskEditorModal
          task={task}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            refresh()
          }}
        />
      )}
    </>
  )
}

function TaskMenu({
  x,
  y,
  done,
  canManage,
  canComplete,
  currentAssignee,
  onClose,
  onToggleDone,
  onAssign,
  onEdit,
}: {
  x: number
  y: number
  done: boolean
  canManage: boolean
  canComplete: boolean
  currentAssignee: string | null
  onClose: () => void
  onToggleDone: () => void
  onAssign: (accountId: string | null) => void
  onEdit: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const roster = useQuery({ queryKey: ['task-assignees'], queryFn: listTaskAssignees, enabled: assignOpen })

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Clamp into the viewport.
  const left = Math.min(x, window.innerWidth - 230)
  const top = Math.min(y, window.innerHeight - 320)

  return (
    <div
      ref={ref}
      className="fixed z-50 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      {canComplete && (
        <button
          type="button"
          onClick={onToggleDone}
          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
        >
          {done ? 'Reopen task' : 'Mark complete'}
        </button>
      )}

      {canManage && (
        <>
          <button
            type="button"
            onClick={() => setAssignOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
          >
            <span>Assign to…</span>
            <span className="text-slate-400">{assignOpen ? '▾' : '▸'}</span>
          </button>
          {assignOpen && (
            <div className="max-h-48 overflow-auto border-y border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => onAssign(null)}
                className={`block w-full px-5 py-1.5 text-left text-xs hover:bg-white ${!currentAssignee ? 'font-semibold text-amber-700' : 'text-slate-600'}`}
              >
                Unassigned
              </button>
              {roster.isLoading && <div className="px-5 py-1.5 text-xs text-slate-400">Loading…</div>}
              {(roster.data ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onAssign(s.id)}
                  className={`block w-full px-5 py-1.5 text-left text-xs hover:bg-white ${currentAssignee === s.id ? 'font-semibold text-amber-700' : 'text-slate-600'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
          >
            Edit…
          </button>
        </>
      )}

      {!canManage && !canComplete && (
        <div className="px-3 py-2 text-xs text-slate-400">No actions available</div>
      )}
    </div>
  )
}

export default CalendarTaskCard
