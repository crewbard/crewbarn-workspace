import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { catalogItemKeys } from '@/hooks/useCatalogItems'
import type { FlashStock } from '@/lib/flashWords'

/**
 * Fitment: what a company's parts fit (docs/notes/fitment-plan.md).
 *
 * The profile names the subjects a trade's parts fit (a vehicle, a lock, an
 * HVAC unit) and each one's fields. Every company starts on its trade's draft;
 * the first save makes its own copy. Rows are the fits of one product.
 */

export type FitmentFieldType = 'text' | 'number' | 'year_range' | 'choice' | 'code' | 'dimensions'

export interface FitmentField {
  key: string
  label: string
  type: FitmentFieldType
  required?: boolean
  filter?: boolean
  choices?: string[]
  unit?: string
  prefix?: boolean
  /** Added in the editor and not saved yet (its key still follows its name). Never stored. */
  isNew?: boolean
}

export interface FitmentSubject {
  key: string
  label: string
  title?: string
  fields: FitmentField[]
  detect?: Array<Record<string, unknown> & { kind: string }>
  categories?: string[]
  card?: { opens?: string; default_tab?: string; hide_keys?: boolean }
}

export interface FitmentProfile {
  version: number
  source?: 'builtin' | 'admin' | 'tenant'
  status?: FitmentStatus
  subjects: FitmentSubject[]
}

export type FitmentStatus = 'draft' | 'active' | 'off'

export interface EffectiveFitmentProfile {
  profile: FitmentProfile
  status: FitmentStatus
  /** The company saved its own copy. */
  own: boolean
  based_on: Array<{ pack: string; label: string; version: number }>
  update_available: boolean
  updated_at: string | null
  field_types: FitmentFieldType[]
}

export type YearRange = { from: number | null; to: number | null }
export type FitAttrs = Record<string, string | number | YearRange>

export interface CatalogItemFit {
  id: string
  subject: string
  attrs: FitAttrs
  note: string | null
  source: string
  year_from: number | null
  year_to: number | null
  created_at: string | null
}

export interface FitDraft {
  id?: string
  subject: string
  attrs: Record<string, unknown>
  note?: string | null
}

export const fitmentKeys = {
  profile: ['fitment', 'profile'] as const,
  item: (id: string) => ['fitment', 'item', id] as const,
  values: (subject: string, field: string, q: string, extra: string) => ['fitment', 'values', subject, field, q, extra] as const,
}

export function useFitmentProfile(enabled = true) {
  return useQuery({
    queryKey: fitmentKeys.profile,
    queryFn: async () => (await apiRequest<{ data: EffectiveFitmentProfile }>('/v1/fitment/profile')).data,
    staleTime: 5 * 60_000,
    enabled,
  })
}

function useProfileMutation<T>(fn: (arg: T) => Promise<{ data: EffectiveFitmentProfile }>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      qc.setQueryData(fitmentKeys.profile, res.data)
      qc.invalidateQueries({ queryKey: ['fitment', 'item'] })
    },
  })
}

export function useSaveFitmentProfile() {
  return useProfileMutation((body: { profile?: FitmentProfile; status?: FitmentStatus }) =>
    apiRequest<{ data: EffectiveFitmentProfile }>('/v1/fitment/profile', { method: 'PUT', body }))
}

export function useResetFitmentProfile() {
  return useProfileMutation<void>(() =>
    apiRequest<{ data: EffectiveFitmentProfile }>('/v1/fitment/profile/reset', { method: 'POST' }))
}

export function useTakeFitmentUpdate() {
  return useProfileMutation<void>(() =>
    apiRequest<{ data: EffectiveFitmentProfile }>('/v1/fitment/profile/take-update', { method: 'POST' }))
}

export function useItemFitments(itemId: string | undefined) {
  return useQuery({
    queryKey: fitmentKeys.item(itemId ?? ''),
    queryFn: () => apiRequest<{ data: CatalogItemFit[]; default_subject: string | null }>(`/v1/catalog-items/${itemId}/fitments`),
    enabled: !!itemId,
    staleTime: 60_000,
  })
}

export function useSaveItemFitments(itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fitments: FitDraft[]) =>
      apiRequest<{ data: CatalogItemFit[]; default_subject: string | null }>(`/v1/catalog-items/${itemId}/fitments`, {
        method: 'PUT',
        body: { fitments },
      }),
    onSuccess: (res) => {
      qc.setQueryData(fitmentKeys.item(itemId), res)
      // A Fits filter on the list may now match differently.
      qc.invalidateQueries({ queryKey: catalogItemKeys.lists() })
      qc.invalidateQueries({ queryKey: ['fitment', 'values'] })
    },
  })
}

export function useFitmentValues(subject: string, field: string, q: string, extra: Record<string, string> = {}, enabled = true) {
  const extraKey = new URLSearchParams(extra).toString()
  return useQuery({
    queryKey: fitmentKeys.values(subject, field, q, extraKey),
    queryFn: async () => {
      const params = new URLSearchParams({ subject, field, q, ...extra })
      return (await apiRequest<{ data: Array<{ value: string; from: string }> }>(`/v1/fitment/values?${params}`)).data
    },
    enabled: enabled && !!subject && !!field,
    staleTime: 60_000,
  })
}

/** "2015–2020", "2015 on", "up to 2020", "2016". */
export function formatYears(v: unknown): string {
  if (v == null || typeof v !== 'object') return v == null ? '' : String(v)
  const { from, to } = v as YearRange
  if (from != null && to != null) return from === to ? String(from) : `${from}–${to}`
  if (from != null) return `${from} on`
  if (to != null) return `up to ${to}`
  return ''
}

export function formatValue(field: FitmentField | undefined, v: unknown): string {
  if (v == null || v === '') return ''
  if (field?.type === 'year_range') return formatYears(v)
  if (field?.type === 'number' && field.unit) return `${v} ${field.unit}`
  return String(v)
}

/** A fit as one line, from the subject's title ("{years} {make} {model}"), then the other fields. */
export function fitTitle(subject: FitmentSubject | undefined, attrs: Record<string, unknown>): string {
  if (!subject) return Object.values(attrs).map((v) => formatYears(v)).filter(Boolean).join(' ')
  const byKey = new Map(subject.fields.map((f) => [f.key, f]))
  const used = new Set<string>()
  const title = (subject.title ?? '')
    .replace(/\{(\w+)\}/g, (_, k: string) => {
      used.add(k)
      return formatValue(byKey.get(k), attrs[k])
    })
    .replace(/\s+/g, ' ')
    .trim()
  return title || subject.fields.map((f) => formatValue(f, attrs[f.key])).filter(Boolean).join(' ')
}

/** The fields a title leaves out, as "Ignition: Regular · FCC ID: M3N-A2C93142300". */
export function fitDetails(subject: FitmentSubject | undefined, attrs: Record<string, unknown>): string {
  if (!subject) return ''
  const inTitle = new Set([...(subject.title ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
  return subject.fields
    .filter((f) => !inTitle.has(f.key) && attrs[f.key] != null && attrs[f.key] !== '')
    .map((f) => `${f.label}: ${formatValue(f, attrs[f.key])}`)
    .join(' · ')
}

/** Year range input text → value the API takes ("2015-2020", "2016", "2015-"). */
export function yearsToText(v: unknown): string {
  if (v == null || typeof v !== 'object') return v == null ? '' : String(v)
  const { from, to } = v as YearRange
  if (from != null && to != null) return from === to ? String(from) : `${from}-${to}`
  if (from != null) return `${from}-`
  if (to != null) return `-${to}`
  return ''
}

// ---------------------------------------------------------------- the card

/** One product in "Parts that fit": the fits that matched and the flash card's stock line. */
export interface FitsCardItem {
  item_id: string
  name: string
  sku: string | null
  image: string | null
  unit_label: string | null
  sell_cents: number | null
  stock: FlashStock | null
  fits: Array<{ id: string; attrs: FitAttrs; note: string | null; year_from: number | null; year_to: number | null }>
}

/** GET /v1/fitment/card, and the vehicle card's `fits`. */
export interface FitsCardData {
  status: FitmentStatus
  subject: FitmentSubject
  asked: Record<string, string | number>
  /** "model_prefix": found through the model without its trim words, and said so. */
  matched_on: 'asked' | 'model_prefix'
  total: number
  items: FitsCardItem[]
  truncated: boolean
}

export function useFitsCard(subject: string | null, asked: Record<string, string>, enabled = true) {
  const params = new URLSearchParams({ ...asked, subject: subject ?? '' })
  return useQuery({
    queryKey: ['fitment', 'card', params.toString()] as const,
    queryFn: async () => (await apiRequest<{ data: FitsCardData }>(`/v1/fitment/card?${params}`)).data,
    enabled: enabled && !!subject,
    staleTime: 30_000,
    retry: false,
  })
}

/**
 * What a fit asks the fits card: its text, code, choice and number fields as
 * typed. A year range is a span of years, not one year, so it is left out;
 * a stored prefix ("4TTR4036*") is asked without its star.
 */
export function askedFromFit(subject: FitmentSubject | undefined, attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of subject?.fields ?? []) {
    const v = attrs[f.key]
    if (v == null || v === '' || typeof v === 'object' || f.type === 'year_range') continue
    out[f.key] = String(v).replace(/\*+$/, '')
  }
  return out
}

/* ---- Fitment P4: fits CBI learned, waiting for review (API 34.278) ---- */

export type FitStatus = 'confirmed' | 'draft' | 'rejected'

export interface LearnedFit {
  id: string
  catalog_item_id: string
  subject: string
  attrs: FitAttrs
  label: string
  note: string | null
  status: FitStatus
  source: string | null
  learned_from_type: string | null
  learned_from_id: string | null
  memory_id: string | null
  created_by: string | null
  created_by_name?: string | null
  created_at: string | null
  item: { id: string; name: string; sku: string | null } | null
}

export interface FitScanResult {
  scanned: number
  drafted: number
  skipped: number
  subject: string | null
  reason: 'fitment_off' | 'no_vehicle_subject' | null
}

const draftsKey = ['fitment', 'drafts'] as const

export function useFitDrafts(enabled = true) {
  return useQuery({
    queryKey: draftsKey,
    queryFn: async () => (await apiRequest<{ data: LearnedFit[] }>('/v1/fitment/drafts')).data,
    enabled,
    staleTime: 30_000,
  })
}

function useAfterReview() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: draftsKey })
    qc.invalidateQueries({ queryKey: ['fitment', 'item'] })
    qc.invalidateQueries({ queryKey: ['fitment', 'card'] })
    qc.invalidateQueries({ queryKey: catalogItemKeys.lists() })
  }
}

export function useReviewFitDraft() {
  const done = useAfterReview()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'reject' }) =>
      apiRequest<{ data: { id: string; status: FitStatus } }>(`/v1/fitment/drafts/${id}/${action}`, { method: 'POST' }),
    onSuccess: done,
  })
}

export function useScanFitHistory() {
  const done = useAfterReview()
  return useMutation({
    mutationFn: async () => (await apiRequest<{ data: FitScanResult }>('/v1/fitment/suggestions/scan', { method: 'POST' })).data,
    onSuccess: done,
  })
}

export const LEARNED_FROM_LABELS: Record<string, string> = {
  comms_message: 'a message',
  work_order: 'a job',
  work_order_note: 'a job note',
  ai_chat: 'CBI chat',
  job_history: 'job history',
  manual: 'by hand',
}