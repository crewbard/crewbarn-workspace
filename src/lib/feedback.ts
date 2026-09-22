import { apiRequest } from './api'

/** Bugs & Ideas portal client. All endpoints require a signed-in member. */

export type FeedbackType = 'bug' | 'idea'
export type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'done' | 'declined'

export interface FeedbackPost {
  id: string
  type: FeedbackType
  title: string
  body: string | null
  status: FeedbackStatus
  author_display: string | null
  vote_count: number
  voted: boolean
  created_at: string | null
}

export interface FeedbackListResponse {
  data: FeedbackPost[]
  is_admin: boolean
}

export async function listFeedback(params: { type?: string; status?: string; sort?: string } = {}): Promise<FeedbackListResponse> {
  const qs = new URLSearchParams()
  if (params.type && params.type !== 'all') qs.set('type', params.type)
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  if (params.sort) qs.set('sort', params.sort)
  const s = qs.toString()
  return apiRequest<FeedbackListResponse>(`/v1/feedback${s ? `?${s}` : ''}`, { method: 'GET' })
}

export async function createFeedback(input: { type: FeedbackType; title: string; body?: string }): Promise<{ data: FeedbackPost }> {
  return apiRequest<{ data: FeedbackPost }>('/v1/feedback', { method: 'POST', body: input })
}

export async function voteFeedback(id: string): Promise<{ data: FeedbackPost }> {
  return apiRequest<{ data: FeedbackPost }>(`/v1/feedback/${id}/vote`, { method: 'POST' })
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<{ data: FeedbackPost }> {
  return apiRequest<{ data: FeedbackPost }>(`/v1/feedback/${id}`, { method: 'PATCH', body: { status } })
}
