import { apiRequest } from '@/lib/api'

/** Internal tech ↔ office messaging (separate from the customer comms inbox). */

export interface StaffThreadSummary {
  id: string
  kind: 'tech' | 'team'
  title: string | null
  tech: { id: string; name: string } | null
  last_message_at: string | null
  last_preview: string | null
  last_sender_kind: 'tech' | 'office' | null
  unread_count: number
}

export interface StaffMessageDto {
  id: string
  body: string
  sender_kind: 'tech' | 'office'
  sender_name: string | null
  mine: boolean
  channel: 'app' | 'sms'
  created_at: string | null
}

export interface StaffThreadDetail {
  thread: StaffThreadSummary
  messages: StaffMessageDto[]
}

export function listStaffThreads() {
  return apiRequest<{ data: StaffThreadSummary[]; unread_total: number; is_office: boolean }>(
    '/v1/staff-messages',
  )
}

export function getStaffThread(threadId: string) {
  return apiRequest<{ data: StaffThreadDetail }>(`/v1/staff-messages/${threadId}`)
}

export const portalThreadsKey = (as: string | null) => ['employee-message-threads', as ?? 'self'] as const

export function listPortalStaffThreads(as: string | null = null) {
  return apiRequest<{ data: StaffThreadSummary[]; unread_total: number }>(
    `/v1/me/messages${as ? `?as=${encodeURIComponent(as)}` : ''}`,
  )
}

/** Preview reads never advance the employee's read cursor. */
export function getPortalStaffThread(threadId: string, as: string | null = null) {
  return apiRequest<{ data: StaffThreadDetail }>(
    `/v1/me/messages/${encodeURIComponent(threadId)}${as ? `?as=${encodeURIComponent(as)}` : ''}`,
  )
}

/** Resolve-or-open a tech's 1:1 thread by their staff account id. */
export function getTechThread(accountId: string) {
  return apiRequest<{ data: StaffThreadDetail }>(`/v1/staff-messages/tech/${accountId}`)
}

export function sendStaffMessage(threadId: string, body: string) {
  return apiRequest<{ data: StaffMessageDto }>(`/v1/staff-messages/${threadId}`, {
    method: 'POST',
    body: { body },
  })
}

export function markStaffThreadRead(threadId: string) {
  return apiRequest(`/v1/staff-messages/${threadId}/read`, { method: 'POST' })
}
