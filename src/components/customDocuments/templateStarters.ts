/**
 * Starter library access — shared THEMES palette, types, and the fetch hook
 * for the backend-owned starter library.
 *
 * The starter DEFINITIONS now live on the backend (TemplateSeeder::library())
 * and are served by GET /v1/templates/starters. That's the single source of
 * truth: the same definitions seed a new tenant AND populate the "Start from
 * template" picker, so the two can no longer drift. This module keeps only the
 * pieces the UI needs locally: the THEMES palette, the Starter/DesignTokens
 * types, and the useStarters() fetch hook.
 */
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

// Re-export from the canonical definition in extractedDocumentPdf so
// starters + the editor share one shape.
export type { DesignTokens, FontFamilyName } from '@/lib/extractedDocumentPdf'
import type { DesignTokens } from '@/lib/extractedDocumentPdf'

export const THEMES: Record<
  'classic' | 'modern' | 'bold' | 'minimal' | 'emerald',
  DesignTokens
> = {
  classic: { theme: 'classic', primary_color: '#f59e0b', accent_color: '#0f172a' },
  modern:  { theme: 'modern',  primary_color: '#3b82f6', accent_color: '#1e293b' },
  bold:    { theme: 'bold',    primary_color: '#dc2626', accent_color: '#0a0a0a' },
  minimal: { theme: 'minimal', primary_color: '#94a3b8', accent_color: '#334155' },
  emerald: { theme: 'emerald', primary_color: '#10b981', accent_color: '#064e3b' },
}

export interface Starter {
  id: string
  name: string
  category: string     // email category OR doc type
  titleOrSubject: string
  body: string
  starter_signature?: string
  design_tokens: DesignTokens
  blurb: string        // short description shown in the starter picker
  /**
   * Merge tags this starter typically references — used by the Starter
   * detail picker to pre-check tags the user is likely to want.
   */
  suggested_tags?: string[]
  /** email | document | sms — which channel this starter belongs to. */
  kind?: 'email' | 'document' | 'sms'
  /** Trade slug or 'generic'. */
  vertical?: string
}

/**
 * Fetch the starter library for a kind from the backend (5-min cache).
 * Replaces the old hardcoded EMAIL_STARTERS / DOC_STARTERS arrays — the
 * picker and the seeder now read the same backend source.
 *
 * `vertical` is accepted for forward-compatibility with trade packs; the
 * backend always includes generic starters regardless.
 */
export function useStarters(kind: 'email' | 'document' | 'sms', vertical?: string) {
  return useQuery({
    queryKey: ['template-starters', kind, vertical ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ kind })
      if (vertical) params.set('vertical', vertical)
      return apiRequest<{ data: Starter[] }>(`/v1/templates/starters?${params}`)
    },
    staleTime: 5 * 60_000,
    select: (r) => r.data,
  })
}
