import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IconArrowDown, IconArrowUp, IconCamera, IconPlus, IconX } from '@tabler/icons-react'
import { jobTaskKeys, listTaskGroups, withGroup, type JobTaskDraft } from '@/lib/jobTasks'

/**
 * The office's editor for a job's or an estimate's tasks: type a task, tick
 * "Photo or video" when the tech must show it was done, reorder, remove, or
 * pull in a whole task group. Controlled: the parent decides when to save.
 */
export function JobTasksEditor({
  value,
  onChange,
  disabled = false,
  showGroups = true,
}: {
  value: JobTaskDraft[]
  onChange: (next: JobTaskDraft[]) => void
  disabled?: boolean
  /** Off when editing a group itself. */
  showGroups?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [draftProof, setDraftProof] = useState(false)
  const groupsQuery = useQuery({ queryKey: jobTaskKeys.groups, queryFn: listTaskGroups, staleTime: 60_000, enabled: showGroups })
  const groups = groupsQuery.data ?? []

  const add = () => {
    const title = draft.trim()
    if (!title) return
    onChange([...value, { title, proof_required: draftProof }])
    setDraft('')
    setDraftProof(false)
  }
  const set = (i: number, patch: Partial<JobTaskDraft>) => onChange(value.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const move = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2" data-tour="job-tasks-editor">
      {value.length > 0 && (
        <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {value.map((task, i) => (
            <li key={task.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
              <input
                type="text"
                value={task.title}
                onChange={(e) => set(i, { title: e.target.value })}
                disabled={disabled}
                aria-label={`Task ${i + 1}`}
                className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm text-slate-900 hover:border-slate-200 focus:border-navy-300 focus:outline-none focus:ring-1 focus:ring-navy-300"
              />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={task.proof_required}
                  onChange={(e) => set(i, { proof_required: e.target.checked })}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <IconCamera size={14} aria-hidden className={task.proof_required ? 'text-navy-700' : 'text-slate-400'} />
                Photo or video
              </label>
              <div className="flex shrink-0 items-center">
                <button type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">
                  <IconArrowUp size={15} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={disabled || i === value.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">
                  <IconArrowDown size={15} />
                </button>
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={disabled} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${task.title || 'task'}`}>
                  <IconX size={15} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          disabled={disabled}
          placeholder="Add a task, like Test the lock three times"
          className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={draftProof} onChange={(e) => setDraftProof(e.target.checked)} disabled={disabled} className="h-4 w-4 rounded border-slate-300" />
          Photo or video
        </label>
        <button
          type="button"
          onClick={add}
          disabled={disabled || !draft.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50 disabled:opacity-40"
        >
          <IconPlus size={15} aria-hidden /> Add
        </button>
        {showGroups && groups.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const group = groups.find((g) => g.id === e.target.value)
              if (group) onChange(withGroup(value, group))
            }}
            disabled={disabled}
            aria-label="Add a task group"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Add task group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.items.length})
              </option>
            ))}
          </select>
        )}
      </div>
      {value.length === 0 && showGroups && (
        <p className="text-xs text-slate-500">
          No tasks yet. Every task on a job must be ticked off before the job can be completed.
        </p>
      )}
    </div>
  )
}
