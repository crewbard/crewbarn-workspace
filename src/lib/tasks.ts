import { apiRequest } from '@/lib/api'

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskAnchor = 'work_order' | 'customer'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  related_type: TaskAnchor | null
  related_id: string | null
  related_label: string | null
  assignee_account_id: string | null
  assignee_name: string | null
  created_by_account_id: string | null
  completed_at: string | null
  completed_by_account_id: string | null
  sort_order: number
  created_at: string | null
  updated_at: string | null
}

export interface TaskInput {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  due_at?: string | null
  assignee_account_id?: string | null
  // Anchor — only honored on create; immutable afterward.
  related_type?: TaskAnchor | null
  related_id?: string | null
  sort_order?: number
}

export interface TaskFilters {
  status?: TaskStatus
  /** 'me' = only tasks assigned to the current user */
  assignee?: 'me'
  assignee_account_id?: string
  /** 'standalone' = unanchored to-dos */
  related_type?: 'standalone' | TaskAnchor
  related_id?: string
  include_done?: boolean
  /** Status bucket: active (default) | history (done/cancelled) | all. */
  view?: 'active' | 'history' | 'all'
  /** Due-date window (yyyy-MM-dd or ISO) — used by the calendar views. */
  due_from?: string
  due_to?: string
}

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

export async function listTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const p = new URLSearchParams()
  if (filters.status) p.set('status', filters.status)
  if (filters.assignee) p.set('assignee', filters.assignee)
  if (filters.assignee_account_id) p.set('assignee_account_id', filters.assignee_account_id)
  if (filters.related_type) p.set('related_type', filters.related_type)
  if (filters.related_id) p.set('related_id', filters.related_id)
  if (filters.include_done) p.set('include_done', '1')
  if (filters.view) p.set('view', filters.view)
  if (filters.due_from) p.set('due_from', filters.due_from)
  if (filters.due_to) p.set('due_to', filters.due_to)
  const qs = p.toString()
  const res = await apiRequest<{ data: Task[] }>(`/v1/tasks${qs ? `?${qs}` : ''}`)
  return res.data
}

export async function createTask(input: TaskInput): Promise<Task> {
  const res = await apiRequest<{ data: Task }>('/v1/tasks', { method: 'POST', body: input })
  return res.data
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  const res = await apiRequest<{ data: Task }>(`/v1/tasks/${id}`, { method: 'PATCH', body: input })
  return res.data
}

export async function completeTask(id: string, done: boolean): Promise<Task> {
  const res = await apiRequest<{ data: Task }>(`/v1/tasks/${id}/complete`, {
    method: 'POST',
    body: { done },
  })
  return res.data
}

export async function deleteTask(id: string): Promise<void> {
  await apiRequest<void>(`/v1/tasks/${id}`, { method: 'DELETE' })
}

export interface TaskAssignee {
  id: string
  name: string
  role_slug: string | null
}

/** Tenant staff roster for the assignee picker (account ids). */
export async function listTaskAssignees(): Promise<TaskAssignee[]> {
  const res = await apiRequest<{ data: { id: string; name: string; role_slug: string | null; status: string }[] }>(
    '/v1/staff?per_page=200',
  )
  return (res.data ?? [])
    .filter((s) => s.status !== 'disabled')
    .map((s) => ({ id: s.id, name: s.name, role_slug: s.role_slug }))
}

/** True when a task is past its due date and not finished. */
export function isOverdue(task: Pick<Task, 'due_at' | 'status'>): boolean {
  if (!task.due_at) return false
  if (task.status === 'done' || task.status === 'cancelled') return false
  return new Date(task.due_at).getTime() < Date.now()
}
