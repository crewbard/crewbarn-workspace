import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiRequest,
  API_URL,
  getStoredToken,
  getActingTenant,
  type ApiError,
} from '@/lib/api'
import { AttachmentOverlay } from '@/components/ui/AttachmentOverlay'

/**
 * Shared attachments panel for any parent that exposes the standard
 * `/{basePath}/attachments` endpoints (work orders + estimates today).
 * Replaces the per-parent copies — the only differences were the base URL
 * and the cache key, now props. See docs/CREWBARN-REFACTOR-LOG.md.
 *
 *   mode='images'    → thumbnail grid + photo upload (photos[] field)
 *   mode='documents' → doc rows (PDF/DOCX) + doc upload (document field)
 *
 * The server distinguishes kind by the multipart field name; this panel
 * filters the shared attachment list to the requested mode.
 */

export interface AttachmentRow {
  id: string
  kind: 'image' | 'video' | 'document'
  original_filename: string
  mime_type: string | null
  size_bytes: number
  share_with_customer: boolean
  website_visibility?: 'private' | 'customer_shared' | 'website_candidate' | 'website_published' | 'rejected_for_website'
  website_caption?: string | null
  website_alt_text?: string | null
  website_service_tags?: string[]
  website_area_tags?: string[]
  website_approved_by_account_id?: string | null
  website_approved_at?: string | null
  url: string | null
  uploaded_by_account_id: string | null
  uploaded_by_platform_customer_id: string | null
  created_at: string | null
}

export function AttachmentsPanel({
  basePath,
  cacheKey,
  mode,
}: {
  /** e.g. `/v1/work-orders/wo_123` or `/v1/estimates/est_123` (no trailing slash). */
  basePath: string
  /** React Query key for this parent's attachment list. */
  cacheKey: readonly unknown[]
  mode: 'images' | 'documents'
}) {
  const qc = useQueryClient()
  const [overlay, setOverlay] = useState<
    | { url: string; filename: string; kind: 'image' | 'document' }
    | null
  >(null)

  const q = useQuery({
    queryKey: cacheKey,
    queryFn: () => apiRequest<{ data: AttachmentRow[] }>(`${basePath}/attachments`),
  })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData()
      files.forEach((f) => {
        // PDFs / office docs → document field; everything else → photos[].
        if (f.type === 'application/pdf' || f.type.startsWith('application/')) {
          fd.append('document', f)
        } else {
          fd.append('photos[]', f)
        }
      })
      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const res = await fetch(`${API_URL}${basePath}/attachments`, {
        method: 'POST',
        headers,
        body: fd,
      })
      const text = await res.text()
      let payload: any = null
      try { payload = text ? JSON.parse(text) : null } catch { /* ignore */ }
      if (!res.ok) {
        const err = new Error(payload?.message ?? `Upload failed (${res.status})`) as ApiError
        err.status = res.status
        throw err
      }
      return payload
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cacheKey }),
  })

  const updateAttachment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AttachmentRow> }) =>
      apiRequest(`${basePath}/attachments/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cacheKey }),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`${basePath}/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cacheKey }),
  })

  const items = q.data?.data ?? []
  const filtered = items.filter((a) => a.kind === (mode === 'images' ? 'image' : 'document'))
  const acceptAttr = mode === 'images' ? 'image/*' : 'application/pdf,.doc,.docx'

  return (
    <div className="space-y-4">
      {/* Uploader */}
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">
              {mode === 'images' ? 'Photos' : 'Documents'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filtered.length === 0
                ? mode === 'images'
                  ? 'No photos attached yet.'
                  : 'No documents attached yet.'
                : `${filtered.length} ${mode === 'images' ? 'photo' : 'doc'}${filtered.length === 1 ? '' : 's'}.`}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold">
            <input
              type="file"
              accept={acceptAttr}
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 0) upload.mutate(files)
                e.target.value = ''
              }}
              className="hidden"
              disabled={upload.isPending}
            />
            <span aria-hidden="true">{mode === 'images' ? '📷' : '📎'}</span>
            <span>
              {upload.isPending
                ? 'Uploading…'
                : mode === 'images'
                  ? 'Add photos'
                  : 'Add documents'}
            </span>
          </label>
        </div>
        {upload.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mt-3">
            {(upload.error as ApiError).message ?? 'Upload failed.'}
          </div>
        )}
        {mode === 'documents' && (
          <p className="text-[11px] text-slate-400 mt-2">PDF, DOC, or DOCX up to 30 MB each.</p>
        )}
      </section>

      {/* Image grid */}
      {mode === 'images' && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((a) => {
            const websiteState = a.website_visibility ?? 'private'
            const isWebsiteCandidate = websiteState === 'website_candidate' || websiteState === 'website_published'
            return (
              <div
                key={a.id}
                className="relative group bg-slate-100 rounded-lg overflow-hidden aspect-square"
              >
                <button
                  type="button"
                  onClick={() =>
                    a.url && setOverlay({ url: a.url, filename: a.original_filename, kind: 'image' })
                  }
                  className="block w-full h-full"
                >
                  {a.url ? (
                    <img
                      src={a.url}
                      alt={a.website_alt_text || a.original_filename}
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl">
                      🖼️
                    </div>
                  )}
                </button>
                {isWebsiteCandidate && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    Website
                  </span>
                )}
                <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => updateAttachment.mutate({
                      id: a.id,
                      body: { website_visibility: isWebsiteCandidate ? 'private' : 'website_candidate' },
                    })}
                    disabled={updateAttachment.isPending}
                    className={`flex-1 rounded bg-white/95 px-2 py-1 text-[10px] font-semibold shadow-sm ${isWebsiteCandidate ? 'text-slate-700 hover:bg-white' : 'text-emerald-700 hover:bg-white'}`}
                    title={isWebsiteCandidate ? 'Remove from website candidates' : 'Mark as a website candidate'}
                  >
                    {isWebsiteCandidate ? 'Hide site' : 'Show site'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(a.id)}
                  disabled={remove.isPending}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label="Delete"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Document list */}
      {mode === 'documents' && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300"
            >
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {a.original_filename}
                </div>
                <div className="text-[11px] text-slate-500">
                  {Math.round(a.size_bytes / 1024)} KB
                  {a.created_at && ` · uploaded ${new Date(a.created_at).toLocaleString()}`}
                </div>
              </div>
              {a.url && (
                <button
                  type="button"
                  onClick={() =>
                    setOverlay({ url: a.url!, filename: a.original_filename, kind: 'document' })
                  }
                  className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Open
                </button>
              )}
              <button
                type="button"
                onClick={() => remove.mutate(a.id)}
                disabled={remove.isPending}
                className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded disabled:opacity-50"
                aria-label="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {q.isSuccess && filtered.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
          {mode === 'images'
            ? 'No photos yet. Use Add photos above.'
            : 'No documents yet. Use Add documents above.'}
        </div>
      )}

      {overlay && (
        <AttachmentOverlay
          url={overlay.url}
          filename={overlay.filename}
          kind={overlay.kind}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
