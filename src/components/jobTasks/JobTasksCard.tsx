import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconCamera, IconCircle, IconCircleCheckFilled, IconPlayerPlayFilled } from '@tabler/icons-react'
import {
  jobTaskKeys,
  listJobTasks,
  reopenJobTask,
  saveJobTasks,
  useCanEditJobTasks,
  type JobTask,
  type JobTaskDraft,
  type JobTaskParent,
} from '@/lib/jobTasks'
import { JobTasksEditor } from '@/components/jobTasks/JobTasksEditor'
import { workOrderKeys } from '@/hooks/useWorkOrders'

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * A job's or an estimate's tasks: what is done, by whom and when, with the
 * photos and videos that show it. The office edits the list here; the tech
 * ticks tasks off on the phone. On an estimate they are the plan, carried to
 * the job when it converts.
 */
export function JobTasksCard({ parent }: { parent: JobTaskParent }) {
  const qc = useQueryClient()
  const canEdit = useCanEditJobTasks()
  const [editing, setEditing] = useState<JobTaskDraft[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const query = useQuery({ queryKey: jobTaskKeys.list(parent), queryFn: () => listJobTasks(parent) })
  const tasks = query.data ?? []
  const isJob = parent.kind === 'job'
  const done = tasks.filter((t) => t.done).length

  const refresh = (next?: JobTask[]) => {
    if (next) qc.setQueryData(jobTaskKeys.list(parent), next)
    else qc.invalidateQueries({ queryKey: jobTaskKeys.list(parent) })
    // The job's close-out check counts open tasks.
    if (isJob) qc.invalidateQueries({ queryKey: workOrderKeys.detail(parent.id) })
  }
  const save = useMutation({
    mutationFn: (list: JobTaskDraft[]) => saveJobTasks(parent, list.filter((t) => t.title.trim())),
    onSuccess: (next) => {
      refresh(next)
      setEditing(null)
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })
  const reopen = useMutation({
    mutationFn: (id: string) => reopenJobTask(id),
    onSuccess: () => refresh(),
    onError: (e: Error) => setError(e.message),
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-white" data-tour={isJob ? 'job-tasks-card' : 'estimate-tasks-card'}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Job tasks</h2>
          <p className="text-xs text-slate-500">
            {isJob
              ? tasks.length > 0
                ? `${done} of ${tasks.length} done. Every task is ticked off before the job can be completed.`
                : 'The steps of this job. The tech ticks each one off on the phone.'
              : 'The steps of the work. They come along when this estimate becomes a job.'}
          </p>
        </div>
        {canEdit && editing === null && (
          <button
            type="button"
            onClick={() => setEditing(tasks.map((t) => ({ id: t.id, title: t.title, proof_required: t.proof_required })))}
            className="rounded-md border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            {tasks.length > 0 ? 'Edit tasks' : 'Add tasks'}
          </button>
        )}
      </header>

      <div className="px-4 py-3">
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {editing !== null ? (
          <div className="space-y-3">
            <JobTasksEditor value={editing} onChange={setEditing} disabled={save.isPending} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setEditing(null); setError(null) }} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => save.mutate(editing)}
                disabled={save.isPending}
                className="rounded-md bg-navy-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
              >
                {save.isPending ? 'Saving…' : 'Save tasks'}
              </button>
            </div>
          </div>
        ) : query.isLoading ? (
          <p className="text-sm text-slate-500">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-slate-500">No tasks on this {isJob ? 'job' : 'estimate'}.</p>
        ) : (
          <ol className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex gap-3 rounded-lg px-1 py-1.5">
                {isJob && task.done ? (
                  <IconCircleCheckFilled size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Done" />
                ) : (
                  <IconCircle size={20} className="mt-0.5 shrink-0 text-slate-300" aria-label="Not done" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${isJob && task.done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>{task.title}</span>
                    {task.proof_required && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                        <IconCamera size={12} aria-hidden /> Photo or video
                      </span>
                    )}
                  </div>
                  {isJob && task.done && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Done {when(task.completed_at)}{task.completed_by?.name ? ` by ${task.completed_by.name}` : ''}
                      {canEdit && (
                        <>
                          {' · '}
                          <button type="button" onClick={() => reopen.mutate(task.id)} disabled={reopen.isPending} className="text-navy-700 underline-offset-2 hover:underline">
                            Reopen
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  {task.proofs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.proofs.map((p) => (
                        <a
                          key={p.id}
                          href={p.url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="relative block h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                          title={p.kind === 'video' ? 'Open video' : 'Open photo'}
                        >
                          {p.kind === 'image' && p.url ? (
                            <img src={p.thumbnail_url ?? p.url} alt={`Proof for ${task.title}`} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-slate-500">
                              <IconPlayerPlayFilled size={22} aria-label="Video" />
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
