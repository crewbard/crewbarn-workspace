import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import type { AiFieldMap, FilledFormReport } from '@/types/workOrder'

/**
 * The customer's own work-order form: the blanks the AI found on it, what
 * CrewBarn writes into each, and how the last fill went.
 *
 *   - PDF on file, no map yet  → analysis in flight
 *   - Map with an error        → why, and Retry
 *   - Map with blanks          → each blank with a picker for what goes in
 *                                it; Preview writes a copy with the current
 *                                values (missing ones named in grey); a
 *                                finished job can be filled again
 *
 * When the job is completed the form is filled in on its own; the picker
 * only matters when the AI's guess for a blank is wrong.
 */
export function WorkOrderAiFieldMapStatus({
  workOrderId,
  hasTemplatePdf,
  map,
  detectedAt,
  sources,
  resolved,
  report,
  completed,
}: {
  workOrderId: string
  hasTemplatePdf: boolean
  map: AiFieldMap | null
  detectedAt: string | null
  sources: Record<string, string> | null
  resolved: string[] | null
  report: FilledFormReport | null
  completed: boolean
}) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['work-orders'] })

  const analyze = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/template/analyze`, { method: 'POST' }),
    onSuccess: refresh,
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
              The customer's form is still attached when the job is completed, with a
              completion page behind it. Nothing is written into its blanks until they're found.
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

  return (
    <BlankList
      // Re-reads the choices when the saved map changes.
      key={`${map.edited_at ?? ''}|${detectedAt ?? ''}`}
      workOrderId={workOrderId}
      map={map}
      detectedAt={detectedAt}
      sources={sources ?? {}}
      resolved={resolved ?? []}
      report={report}
      completed={completed}
      onChanged={refresh}
    />
  )
}

const SIGNATURE_SOURCES = ['customer_signature', 'tech_signature']

function BlankList({
  workOrderId,
  map,
  detectedAt,
  sources,
  resolved,
  report,
  completed,
  onChanged,
}: {
  workOrderId: string
  map: AiFieldMap
  detectedAt: string | null
  sources: Record<string, string>
  resolved: string[]
  report: FilledFormReport | null
  completed: boolean
  onChanged: () => void
}) {
  const fields = map.fields ?? []
  const [choices, setChoices] = useState<string[]>(() =>
    fields.map((f, i) => f.source ?? resolved[i] ?? 'blank'),
  )
  const [dirty, setDirty] = useState(false)
  const [result, setResult] = useState<{ url: string; report: FilledFormReport } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/template/field-map`, {
        method: 'PUT',
        body: { fields: fields.map((f, i) => ({ ...f, source: choices[i] })) },
      }),
    onSuccess: () => { setDirty(false); setError(null); onChanged() },
    onError: (e: ApiError) => setError(e.message ?? "Couldn't save."),
  })

  const fill = useMutation({
    mutationFn: (preview: boolean) =>
      apiRequest<{ data: { url: string; report: FilledFormReport } }>(
        `/v1/work-orders/${workOrderId}/template/fill`,
        { method: 'POST', body: { preview } },
      ),
    onSuccess: (res) => { setResult(res.data); setError(null); onChanged() },
    onError: (e: ApiError) => setError(e.message ?? "Couldn't fill the form."),
  })

  const shown = result?.report ?? report
  const unfilled = (shown?.fields ?? []).filter((f) => !f.written)

  return (
    <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-emerald-900">
          {fields.length} blank{fields.length === 1 ? '' : 's'} found on the customer's form
        </div>
        {map.model && <span className="text-[11px] text-emerald-700">{map.model}</span>}
      </div>
      <p className="text-[11px] text-emerald-800 mt-1">
        {completed
          ? 'The form was filled in when the job was completed. Change what goes in a blank, save, then fill it again.'
          : 'When the job is completed, CrewBarn writes these into the form. Change any it got wrong, and preview to see where they land.'}
      </p>

      {fields.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {fields.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-xs text-emerald-900 bg-white/70 border border-emerald-100 rounded px-2 py-1"
            >
              <span className="font-mono text-[10px] text-emerald-700 shrink-0">p{f.page}</span>
              <span className="font-medium truncate min-w-0">{f.label ?? f.name}</span>
              <select
                aria-label={`What goes in ${f.label ?? f.name}`}
                value={choices[i]}
                onChange={(e) => {
                  const next = [...choices]
                  next[i] = e.target.value
                  setChoices(next)
                  setDirty(true)
                }}
                className="ml-auto max-w-[55%] rounded border border-emerald-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-800"
              >
                {Object.entries(sources)
                  .filter(([key]) =>
                    key === 'blank'
                    || (f.field_type === 'signature' ? SIGNATURE_SOURCES.includes(key) : !SIGNATURE_SOURCES.includes(key)),
                  )
                  .map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dirty && (
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save choices'}
          </button>
        )}
        <button
          type="button"
          onClick={() => fill.mutate(true)}
          disabled={fill.isPending || dirty}
          title={dirty ? 'Save your choices first' : undefined}
          className="text-xs px-3 py-1.5 rounded border border-emerald-300 bg-white text-emerald-900 font-semibold hover:bg-emerald-100 disabled:opacity-50"
        >
          {fill.isPending && fill.variables === true ? 'Writing preview…' : 'Preview on the form'}
        </button>
        {completed && (
          <button
            type="button"
            onClick={() => fill.mutate(false)}
            disabled={fill.isPending || dirty}
            title={dirty ? 'Save your choices first' : undefined}
            className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold disabled:opacity-50"
          >
            {fill.isPending && fill.variables === false ? 'Filling…' : 'Fill the form again'}
          </button>
        )}
        {result && (
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-800 underline"
          >
            {result.report.preview ? 'Open the preview' : 'Open the filled form'}
          </a>
        )}
      </div>
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}

      {shown && (
        <div className="mt-3 rounded border border-emerald-100 bg-white/70 px-2.5 py-2 text-[11px] text-emerald-900">
          <p>
            {shown.preview ? 'Preview: ' : 'Last filled: '}
            {shown.note}
          </p>
          {unfilled.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-emerald-800">
              {unfilled.map((f, i) => (
                <li key={i}>
                  <span className="font-medium">{f.label}</span> (p{f.page}): {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {detectedAt && (
        <p className="text-[11px] text-emerald-700 mt-2">
          Blanks found {new Date(detectedAt).toLocaleString()}
          {map.edited_at ? `, last changed ${new Date(map.edited_at).toLocaleString()}` : ''}.
        </p>
      )}
    </section>
  )
}
