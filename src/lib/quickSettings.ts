import { apiRequest } from '@/lib/api'

/**
 * Quick settings: the automations a company wants, as yes/no questions
 * (GET/PUT /v1/quick-settings, App\Services\QuickSettings\QuickSettings).
 */

export type QuickAnswer = 'yes' | 'no'

export interface QuickNeed {
  key: string
  label: string
  /** Where it gets set up. */
  to: string
  ready?: boolean
}

export interface QuickQuestion {
  key: string
  group: string
  question: string
  /** What a yes does, in one line. */
  yes: string
  /** What the card shows: the real state, a waiting yes, or a suggestion. */
  value: QuickAnswer | null
  source: 'answer' | 'current' | 'suggested' | null
  answered: boolean
  on: boolean
  /** A yes that is waiting on these before it switches on. */
  waiting_on: QuickNeed[]
  needs: QuickNeed[]
}

export interface QuickSettingsData {
  groups: { key: string; label: string }[]
  questions: QuickQuestion[]
  answered: number
  total: number
}

export const QUICK_SETTINGS_KEY = ['quick-settings'] as const

export function fetchQuickSettings(): Promise<QuickSettingsData> {
  return apiRequest<{ data: QuickSettingsData }>('/v1/quick-settings').then((r) => r.data)
}

export function saveQuickSettings(answers: Record<string, QuickAnswer>): Promise<QuickSettingsData> {
  return apiRequest<{ data: QuickSettingsData }>('/v1/quick-settings', { method: 'PUT', body: { answers } }).then((r) => r.data)
}
