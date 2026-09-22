import { apiRequest } from '@/lib/api'
import type {
  AdvanceInput,
  TesterActivityResponse,
  TesterDetailResponse,
  TesterListResponse,
  TesterProgressResponse,
} from '@/types/tester'

// ---------- Tester self-service ----------

export async function getTesterProgress(): Promise<TesterProgressResponse> {
  return apiRequest<TesterProgressResponse>('/v1/tester/progress')
}

export async function advanceTesterProgress(
  input: AdvanceInput
): Promise<TesterProgressResponse> {
  return apiRequest<TesterProgressResponse>('/v1/tester/progress/advance', {
    method: 'POST',
    body: input,
  })
}

export async function skipTesterStep(): Promise<TesterProgressResponse> {
  return apiRequest<TesterProgressResponse>('/v1/tester/progress/skip', {
    method: 'POST',
  })
}

export async function backTesterStep(): Promise<TesterProgressResponse> {
  return apiRequest<TesterProgressResponse>('/v1/tester/progress/back', {
    method: 'POST',
  })
}

export async function restartTesterProgress(): Promise<TesterProgressResponse> {
  return apiRequest<TesterProgressResponse>('/v1/tester/progress/restart', {
    method: 'POST',
  })
}

export async function acknowledgeTesterIntro(): Promise<TesterProgressResponse> {
  return apiRequest<TesterProgressResponse>('/v1/tester/progress/acknowledge-intro', {
    method: 'POST',
  })
}

// ---------- Admin views ----------

export async function listAdminTesters(): Promise<TesterListResponse> {
  return apiRequest<TesterListResponse>('/v1/admin/testers')
}

export async function getAdminTester(id: string): Promise<TesterDetailResponse> {
  return apiRequest<TesterDetailResponse>(`/v1/admin/testers/${id}`)
}

export async function getAdminTesterActivity(id: string): Promise<TesterActivityResponse> {
  return apiRequest<TesterActivityResponse>(`/v1/admin/testers/${id}/activity`)
}
