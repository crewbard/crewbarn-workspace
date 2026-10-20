import { apiRequest } from '@/lib/api'
import type { AgreementBuilderState } from '@/components/estimates/AgreementBuilderModal'
import type { Rhythm } from './coverageTable'

/**
 * The agreement builder's AI help. It runs on the shop's own AI account
 * (Tool Shed → CBI AI); without one, status says so and links to setup.
 */
export interface AgreementAiStatus { ready: boolean; reason: string | null; message: string | null; setup_url: string | null }
export interface AiMissing { key: string; message: string }
export interface AiDraft { sections: Record<string, string>; missing: AiMissing[]; summary: string }
export type RewriteStyle = 'rewrite' | 'shorter' | 'stricter' | 'friendlier'
export const REWRITE_STYLES: { style: RewriteStyle; label: string }[] = [
  { style: 'rewrite', label: 'Rewrite' },
  { style: 'shorter', label: 'Shorter' },
  { style: 'stricter', label: 'Stricter' },
  { style: 'friendlier', label: 'Friendlier' },
]

/** The company's usual coverage for one type of equipment. */
export interface CoveragePattern { tasks: string; rhythm: Rhythm | null; included: { parts: boolean; after_hours: boolean; emergency: boolean } }

export const NO_AI: AgreementAiStatus = { ready: false, reason: 'no_key', message: 'Set up CBI AI to draft for you.', setup_url: '/tool-shed/ai/key' }

export async function agreementAiStatus(): Promise<AgreementAiStatus> {
  try {
    return (await apiRequest<{ data: AgreementAiStatus }>('/v1/agreement-builder/ai/status')).data
  } catch {
    return NO_AI
  }
}

export async function draftAgreement(state: AgreementBuilderState, notes: string): Promise<AiDraft> {
  return (await apiRequest<{ data: AiDraft }>('/v1/agreement-builder/ai/draft', { method: 'POST', body: { state, notes: notes.trim() || null } })).data
}

export async function rewriteSection(state: AgreementBuilderState, sectionKey: string, text: string, style: RewriteStyle, notes: string): Promise<string> {
  const result = await apiRequest<{ data: { text: string } }>('/v1/agreement-builder/ai/rewrite', {
    method: 'POST', body: { state, section_key: sectionKey, text, style, notes: notes.trim() || null },
  })
  return result.data.text
}

export async function summarizeAgreement(state: AgreementBuilderState): Promise<string> {
  return (await apiRequest<{ data: { summary: string } }>('/v1/agreement-builder/ai/summary', { method: 'POST', body: { state } })).data.summary
}

export async function saveCoveragePatterns(patterns: ({ asset_type_id: string } & CoveragePattern)[]): Promise<number> {
  return (await apiRequest<{ data: { saved: number } }>('/v1/agreement-builder/coverage-patterns', { method: 'POST', body: { patterns } })).data.saved
}
