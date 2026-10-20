import { apiRequest } from '@/lib/api'

/**
 * Location checks: a tech starting a new job or estimate in the phone app is
 * asked "Is this the address where the job is located?". Each check is a dot
 * on the dispatch map and a line in the tech's day
 * (GET /v1/dispatch/field-encounters, App\Services\Dispatch\FieldEncounters).
 */
export interface FieldEncounterRow {
  id: string
  kind: 'new_job' | 'new_estimate'
  at: string | null
  tech: { id: string; name: string } | null
  latitude: number
  longitude: number
  accuracy_m: number | null
  address: string | null
  match: { id: string; customer: string | null; label: string; distance_m: number | null } | null
  answer: 'yes' | 'no' | null
  answered_at: string | null
  chosen: { id: string; customer: string | null; label: string } | null
  job: { id: string; number: number | null; title: string | null } | null
  estimate: { id: string; number: string | null; title: string | null } | null
  job_address: string | null
  distance_from_job_m: number | null
}

export const FIELD_ENCOUNTERS_KEY = ['dispatch-field-encounters'] as const

export function fetchFieldEncounters(date?: string): Promise<FieldEncounterRow[]> {
  return apiRequest<{ data: FieldEncounterRow[] }>(`/v1/dispatch/field-encounters${date ? `?date=${encodeURIComponent(date)}` : ''}`).then((r) => r.data)
}

/** The dot's colour: yes green, no amber, not answered grey. */
export function encounterColor(e: FieldEncounterRow): string {
  return e.answer === 'yes' ? '#16a34a' : e.answer === 'no' ? '#d97706' : '#64748b'
}

export function encounterAnswerLabel(e: FieldEncounterRow): string {
  return e.answer === 'yes' ? 'Yes, the job is here' : e.answer === 'no' ? 'No, the job is somewhere else' : 'Not answered'
}

export function encounterTime(e: FieldEncounterRow): string {
  return e.at ? new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
}

/** 40 → "40 m", 1800 → "1.1 mi". */
export function metersLabel(m: number): string {
  return m < 400 ? `${m} m` : `${(m / 1609.34).toFixed(1)} mi`
}
