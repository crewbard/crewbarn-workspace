import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

export type ExtractedDocSourceType = 'customer_document' | 'asset_document'

export interface ExtractedDoc {
  id: string
  source_type: ExtractedDocSourceType
  source_id: string
  title: string
  content_format: 'markdown'
  content_text: string
  status: 'extracting' | 'extracted' | 'failed'
  extraction_error: string | null
  extracted_at: string | null
  last_edited_at: string | null
  last_edited_by_account_id: string | null
  revision_count: number | null
  current_pdf_url: string | null
  current_pdf_rendered_at: string | null
}

export interface ExtractedDocRevision {
  id: string
  editor: string
  note: string | null
  created_at: string | null
  preview: string
}

const keys = {
  forSource: (t: ExtractedDocSourceType, id: string) => ['extracted-doc', 'for-source', t, id] as const,
  one: (id: string) => ['extracted-doc', id] as const,
  revisions: (id: string) => ['extracted-doc', id, 'revisions'] as const,
}

/**
 * Bulk lookup — given an array of source ids, returns a map of
 * source_id → { id, title, status, current_pdf_url } for each that has
 * an extraction. Used by doc list views to render Edit-vs-Extract
 * buttons without N+1 queries.
 */
export function useExtractedDocsForSources(sourceType: ExtractedDocSourceType, sourceIds: string[]) {
  const sorted = [...sourceIds].sort()
  return useQuery({
    queryKey: ['extracted-doc', 'for-sources', sourceType, sorted.join(',')],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('source_type', sourceType)
      for (const id of sorted) params.append('ids[]', id)
      return apiRequest<{ data: Record<string, { id: string; title: string; status: string; current_pdf_url: string | null }> }>(
        `/v1/extracted-documents/for-sources?${params.toString()}`,
      )
    },
    enabled: sortedHasItems(sorted),
    staleTime: 30_000,
  })
}

function sortedHasItems<T>(arr: T[]): boolean {
  return arr.length > 0
}

/** Look up the existing extracted doc for a given source upload, if any. */
export function useExtractedDocForSource(sourceType: ExtractedDocSourceType, sourceId: string, enabled = true) {
  return useQuery({
    queryKey: keys.forSource(sourceType, sourceId),
    queryFn: () => apiRequest<{ data: ExtractedDoc | null }>(
      `/v1/extracted-documents/for-source?source_type=${sourceType}&source_id=${sourceId}`,
    ),
    enabled: !!sourceId && enabled,
    staleTime: 30_000,
  })
}

export function useExtractedDoc(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    queryFn: () => apiRequest<{ data: ExtractedDoc }>(`/v1/extracted-documents/${id}`),
    enabled: !!id,
  })
}

export function useExtractedDocRevisions(id: string | null) {
  return useQuery({
    queryKey: keys.revisions(id ?? ''),
    queryFn: () => apiRequest<{ data: ExtractedDocRevision[] }>(`/v1/extracted-documents/${id}/revisions`),
    enabled: !!id,
  })
}

export function useTriggerExtraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { source_type: ExtractedDocSourceType; source_id: string; title?: string }) =>
      apiRequest<{ data: ExtractedDoc }>('/v1/extracted-documents/extract', { method: 'POST', body }),
    onSuccess: (resp, vars) => {
      qc.invalidateQueries({ queryKey: keys.forSource(vars.source_type, vars.source_id) })
      qc.invalidateQueries({ queryKey: keys.one(resp.data.id) })
    },
  })
}

export function useSaveExtractedDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { content_text: string; title?: string; note?: string | null } }) =>
      apiRequest<{ data: ExtractedDoc }>(`/v1/extracted-documents/${id}`, { method: 'PATCH', body }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: keys.one(resp.data.id) })
      qc.invalidateQueries({ queryKey: keys.revisions(resp.data.id) })
      qc.invalidateQueries({ queryKey: keys.forSource(resp.data.source_type, resp.data.source_id) })
    },
  })
}
