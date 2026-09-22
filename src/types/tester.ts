/**
 * Tester walkthrough types — mirrors TesterController + AdminTesterController
 * response shapes.
 */

export type TesterSentiment = 'broke' | 'confusing' | 'worked'

export interface TesterStep {
  index: number
  key: string
  category: string | null
  title: string
  detail: string
}

export interface TesterStepDef {
  key: string
  category?: string
  title: string
  detail: string
  expected: string | null
}

export interface TesterProgress {
  id: string
  account_id: string
  current_step: number
  total_steps: number
  started_at: string | null
  completed_at: string | null
  intro_acknowledged: boolean
  intro_acknowledged_at: string | null
  step: TesterStep | null
}

export interface TesterProgressResponse {
  data: TesterProgress
}

export interface AdvanceInput {
  body?: string
  sentiment?: TesterSentiment
}

export interface TesterListRow {
  account_id: string
  email: string
  tenant: { id: string; name: string; slug: string } | null
  created_at: string | null
  last_login_at: string | null
  progress: {
    current_step: number
    total_steps: number
    started_at: string | null
    completed_at: string | null
  } | null
  note_count: number
}

export interface TesterListResponse {
  data: TesterListRow[]
  meta: { total_steps: number }
  steps: TesterStepDef[]
}

export interface TesterDetailNote {
  id: string
  step_index: number
  step_key: string
  body: string | null
  sentiment: TesterSentiment | null
  created_at: string | null
}

export interface TesterDetail {
  account: {
    id: string
    email: string
    phone: string | null
    tenant: { id: string; name: string; slug: string } | null
    created_at: string | null
    last_login_at: string | null
  }
  progress: {
    current_step: number
    total_steps: number
    started_at: string | null
    completed_at: string | null
  } | null
  notes: TesterDetailNote[]
  steps: TesterStepDef[]
}

export interface TesterDetailResponse {
  data: TesterDetail
}

export interface TesterActivityRow {
  id: string
  method: string
  path: string
  request_keys: string[] | null
  response_status: number
  duration_ms: number | null
  created_at: string | null
}

export interface TesterActivityResponse {
  data: TesterActivityRow[]
}
