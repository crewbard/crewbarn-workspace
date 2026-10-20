import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * Job tasks: the trackable steps of a job, in order. The office sets them on
 * a job or an estimate (by hand or from a task group); the tech ticks them
 * off on the phone, with a photo or video when the task asks for one; every
 * one is done before the job can be completed.
 *
 * Not the Revisits tab (lib/tasks): those are to-dos that can hang off a job
 * long after it closed.
 */

/** A task as the office edits it: no id yet when it is new. */
export interface JobTaskDraft {
  id?: string
  title: string
  proof_required: boolean
}

export interface JobTaskProof {
  id: string
  kind: 'image' | 'video' | 'document'
  mime_type: string | null
  url: string | null
  thumbnail_url: string | null
  share_with_customer: boolean
  captured_at: string | null
  created_at: string | null
}

export interface JobTask {
  id: string
  title: string
  proof_required: boolean
  sort_order: number
  job_task_group_id: string | null
  done: boolean
  completed_at: string | null
  completed_by: { id: string; name: string | null } | null
  proofs: JobTaskProof[]
}

export interface JobTaskGroup {
  id: string
  name: string
  /** New jobs of this type start with the group's tasks. */
  job_type_id: string | null
  items: Array<{ id: string; title: string; proof_required: boolean }>
}

export type JobTaskParent = { kind: 'job' | 'estimate'; id: string }

function base(parent: JobTaskParent): string {
  return parent.kind === 'job'
    ? `/v1/work-orders/${encodeURIComponent(parent.id)}/job-tasks`
    : `/v1/estimates/${encodeURIComponent(parent.id)}/job-tasks`
}

export const jobTaskKeys = {
  list: (parent: JobTaskParent) => ['job-tasks', parent.kind, parent.id] as const,
  groups: ['job-task-groups'] as const,
}

export async function listJobTasks(parent: JobTaskParent): Promise<JobTask[]> {
  return (await apiRequest<{ data: JobTask[] }>(base(parent))).data
}

/** Save the list as given, in that order. A task sent back with its id keeps its completion. */
export async function saveJobTasks(parent: JobTaskParent, tasks: JobTaskDraft[]): Promise<JobTask[]> {
  return (await apiRequest<{ data: JobTask[] }>(base(parent), {
    method: 'PUT',
    body: { tasks: tasks.map((t) => ({ id: t.id, title: t.title.trim(), proof_required: t.proof_required })) },
  })).data
}

export async function reopenJobTask(id: string): Promise<JobTask> {
  return (await apiRequest<{ data: JobTask }>(`/v1/job-tasks/${encodeURIComponent(id)}/reopen`, { method: 'POST' })).data
}

export async function listTaskGroups(): Promise<JobTaskGroup[]> {
  return (await apiRequest<{ data: JobTaskGroup[] }>('/v1/job-task-groups')).data
}

export type TaskGroupInput = Pick<JobTaskGroup, 'name' | 'job_type_id'> & { items: Array<{ title: string; proof_required: boolean }> }

export async function createTaskGroup(input: TaskGroupInput): Promise<JobTaskGroup> {
  return (await apiRequest<{ data: JobTaskGroup }>('/v1/job-task-groups', { method: 'POST', body: input })).data
}

export async function updateTaskGroup(id: string, input: TaskGroupInput): Promise<JobTaskGroup> {
  return (await apiRequest<{ data: JobTaskGroup }>(`/v1/job-task-groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })).data
}

export async function deleteTaskGroup(id: string): Promise<void> {
  await apiRequest(`/v1/job-task-groups/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * A group's tasks after the ones already in the list, skipping any title
 * the list already has, so pulling a group in twice only fills in what is
 * missing (the server's apply-group does the same).
 */
export function withGroup(current: JobTaskDraft[], group: JobTaskGroup): JobTaskDraft[] {
  const have = new Set(current.map((t) => t.title.trim().toLowerCase()))
  const added = group.items
    .filter((i) => !have.has(i.title.trim().toLowerCase()))
    .map((i) => ({ title: i.title, proof_required: i.proof_required }))
  return [...current, ...added]
}

/**
 * Setting a job's tasks is the office's: jobs.edit and a view of every job
 * (or a territory's, for a dispatcher). A tech, who sees only their own
 * jobs, ticks tasks off on the phone. The server applies the same rule.
 */
export function useCanEditJobTasks(): boolean {
  const { has, scope } = usePermissions()
  const s = scope('jobs')
  return has('jobs.edit') && (s === 'all' || s === 'territory')
}
