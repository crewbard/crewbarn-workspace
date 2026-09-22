import { apiRequest } from '@/lib/api'

/** One ranked technician from the dispatch suggestion engine. Lower score =
 *  better; the list arrives best-first. */
export interface TechSuggestion {
  account_id: string
  name: string
  distance_miles: number | null
  has_gps: boolean
  lat: number | null
  lng: number | null
  available_now: boolean
  next_free_at: string | null
  jobs_today: number
  score: number
  reason: string
}

/**
 * Rank the assignable roster for a target lat/lng — the same deterministic
 * scoring the dispatch board uses (nearest available first), but for a job
 * that doesn't exist yet (call-intake quick create). Pass null coords to rank
 * by availability only.
 */
export async function suggestTechsForLocation(
  lat: number | null,
  lng: number | null,
): Promise<TechSuggestion[]> {
  const qs = new URLSearchParams()
  if (lat !== null && Number.isFinite(lat)) qs.set('lat', String(lat))
  if (lng !== null && Number.isFinite(lng)) qs.set('lng', String(lng))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await apiRequest<{ data: { has_location: boolean; suggestions: TechSuggestion[] } }>(
    `/v1/dispatch/suggest-for-location${suffix}`,
  )
  return res.data.suggestions
}
