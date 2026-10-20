import { apiRequest } from '@/lib/api'
import type { AdvanceInput, TesterProgressResponse } from '@/types/tester'

// The platform admin's views of testers live in src/admin/lib/testers.ts,
// which the open-source work dashboard does not ship.

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
