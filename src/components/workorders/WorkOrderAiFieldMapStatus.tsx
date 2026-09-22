import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import type { AiFieldMap } from '@/types/workOrder'

/**
 * Surfaces the AI Vision detection status for the customer-uploaded
 * PM/PO PDF. Three states:
 *
 *   - PDF on file, but no map yet → analysis in flight
 *   - Map present with fields[]   → ready; show the count
 *   - Map present with error      → friendly message + raw excerpt
 *
 * In-place writes use the map at completion time (next session). For
 * now this just confirms the foundation is working and gives the
 * vendor a window into what the AI detected.
 */
export function WorkOrderAiFieldMapStatus({
  workOrderId,
  hasTemplatePdf,
  map,
  detectedAt,
}: {
  workOrderId: string
  hasTemplatePdf: boolean
  map: AiFieldMap | null
  detectedAt: string | null
}) {
  const qc = useQueryClient()
  const analyze = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/template/analyze`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  if (!hasTemplatePdf) return null

  // No map yet — analysis hasn't run or is in flight
  if (!map) {
    return (
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <strong>
                {analyze.isPending ? 'Running AI analysis now…' : 'AI is analyzing your form…'}
              </strong>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Claude is reading the PDF to find the date / scope / signature
              blanks. Takes 10-30s. If it's been stuck for a while, click
              "Run analysis now" to force it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending}
            className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold disabled:opacity-50 shrink-0"
          >
            {analyze.isPending ? 'Running…' : 'Run analysis now'}
          </button>
        </div>
        {analyze.isError && (
          <div className="text-xs text-red-700 mt-2">
            {(analyze.error as ApiError).message ?? 'Failed to start analysis.'}
          </div>
        )}
      </section>
    )
  }

  if (map.error) {
    const label =
      map.error === 'ai_not_configured'
        ? 'AI is not configured for this provider yet — the completion summary will fall back to appending a page.'
        : map.error === 'pdf_fetch_failed'
        ? 'Could not read the uploaded PDF from storage.'
        : map.error === 'ai_call_failed'
        ? 'The AI service rejected the request.'
        : map.error === 'unparseable_response'
        ? 'AI returned a response we could not parse as JSON.'
        : `AI detection error: ${map.error}`
    return (
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-amber-900">
              AI form detection skipped
            </div>
            <p className="text-xs text-amber-800 mt-1">{label}</p>
            {map.detail && (
              <p className="text-[11px] text-amber-700 mt-2 font-mono">{map.detail}</p>
            )}
            <p className="text-[11px] text-amber-700 mt-2">
              The signed PDF will still be stamped — we'll just append
              a summary page instead of writing into form blanks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending}
            className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold disabled:opacity-50 shrink-0"
          >
            {analyze.isPending ? 'Running…' : 'Retry analysis'}
          </button>
        </div>
        {analyze.isError && (
          <div className="text-xs text-red-700 mt-2">
            {(analyze.error as ApiError).message ?? 'Failed to start analysis.'}
          </div>
        )}
      </section>
    )
  }

  const count = map.fields?.length ?? 0
  return (
    <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-emerald-900">
          ✓ AI detected {count} fillable field{count === 1 ? '' : 's'}
        </div>
        {map.model && (
          <span className="text-[11px] text-emerald-700">{map.model}</span>
        )}
      </div>
      {count > 0 && (
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {(map.fields ?? []).map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-xs text-emerald-900 bg-white/60 border border-emerald-100 rounded px-2 py-1"
            >
              <span className="font-mono text-[10px] text-emerald-700 shrink-0">
                p{f.page}
              </span>
              <span className="font-medium truncate">{f.label ?? f.name}</span>
              <span className="text-[10px] text-emerald-600 ml-auto shrink-0">
                {f.field_type}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-emerald-700 mt-3">
        At job completion the platform writes date / scope / signature
        directly into these positions on the PDF.
        {detectedAt && (
          <>
            {' '}
            Detected {new Date(detectedAt).toLocaleString()}.
          </>
        )}
      </p>
    </section>
  )
}
