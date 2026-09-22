import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getImportSchemas,
  uploadImport,
  commitImport,
  type ImportSchema,
  type ImportUploadResult,
  type ImportCommitResult,
} from '@/lib/imports'
import { QuickBooksConnectCard } from '@/components/QuickBooksConnectCard'

/**
 * Import wizard — migrate data from another FSM or QuickBooks via a
 * CSV/Excel export. Three steps:
 *   1. Pick what you're importing + choose the file.
 *   2. Review the AI's column mapping (editable) against a live preview.
 *   3. Import → results.
 *
 * Phase 1 supports Customers. Other entities appear here automatically
 * once their backend schema is added.
 */
export function ImportWizardPage() {
  const schemasQ = useQuery({ queryKey: ['import-schemas'], queryFn: getImportSchemas })
  const [entity, setEntity] = useState<string>('customers')
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [upload, setUpload] = useState<ImportUploadResult | null>(null)

  // Editable mapping: crewbarn field -> source header ('' = unmapped).
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const [committing, setCommitting] = useState(false)
  const [commitErr, setCommitErr] = useState<string | null>(null)
  const [result, setResult] = useState<ImportCommitResult | null>(null)

  const schemas = schemasQ.data ?? {}
  const schema: ImportSchema | undefined = schemas[entity]

  // Seed the editable mapping from the AI suggestion when an upload lands.
  useEffect(() => {
    if (upload) setMapping({ ...upload.suggested_mapping })
  }, [upload])

  async function handleFile(file: File | null) {
    if (!file) return
    setUploadErr(null)
    setUploading(true)
    try {
      const res = await uploadImport(entity, file)
      setUpload(res)
      setStep(2)
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleCommit() {
    if (!upload) return
    setCommitErr(null)
    setCommitting(true)
    try {
      const res = await commitImport(upload.batch_id, mapping)
      setResult(res)
      setStep(3)
    } catch (e) {
      setCommitErr(e instanceof Error ? e.message : String(e))
    } finally {
      setCommitting(false)
    }
  }

  function reset() {
    setUpload(null)
    setMapping({})
    setResult(null)
    setUploadErr(null)
    setCommitErr(null)
    setStep(1)
  }

  const requiredUnmapped =
    schema?.fields.filter((f) => f.required && !mapping[f.field]).map((f) => f.label) ?? []

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Import data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Bring your records over from another field-service app or QuickBooks.
          Export a CSV or Excel file from your old system, drop it here, and the
          AI maps the columns for you. You review before anything is created.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {[
          { n: 1, label: 'Upload' },
          { n: 2, label: 'Map columns' },
          { n: 3, label: 'Done' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                step >= s.n ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {s.n}
            </span>
            <span className={step >= s.n ? 'text-slate-900 font-medium' : 'text-slate-400'}>
              {s.label}
            </span>
            {i < 2 && <span className="w-8 h-px bg-slate-300" />}
          </div>
        ))}
      </div>

      {/* Step 1 — choose source */}
      {step === 1 && (
        <div className="space-y-4">
          <QuickBooksConnectCard />

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or import from a file
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              What are you importing?
            </label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="w-full sm:max-w-xs px-3 py-2 text-sm border border-slate-300 rounded-md"
            >
              {Object.entries(schemas).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <label className="block border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30">
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm font-medium text-slate-700">
              {uploading ? 'Reading file…' : 'Click to choose a CSV or Excel file'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              .csv or .xlsx · up to 10 MB · first row must be column headers
            </div>
          </label>

          {uploadErr && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {uploadErr}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Step 2 — map */}
      {step === 2 && upload && schema && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Map columns — {upload.filename}
              </h2>
              <span className="text-xs text-slate-500">
                {upload.row_count} rows ·{' '}
                {upload.ai_used ? '✦ AI suggested this mapping' : 'auto-matched by name'}
              </span>
            </div>
            {upload.notes && (
              <p className="text-xs text-slate-500 mb-3 italic">{upload.notes}</p>
            )}

            <div className="space-y-2">
              {schema.fields.map((f) => (
                <div key={f.field} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <div className="text-sm text-slate-700">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                    {f.hint && <span className="block text-[11px] text-slate-400">{f.hint}</span>}
                  </div>
                  <select
                    value={mapping[f.field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.field]: e.target.value }))
                    }
                    className={`w-full px-2 py-1.5 text-sm border rounded-md ${
                      f.required && !mapping[f.field]
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-300'
                    }`}
                  >
                    <option value="">— Don't import —</option>
                    {upload.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Preview (first {Math.min(upload.sample_rows.length, 5)} rows)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    {schema.fields
                      .filter((f) => mapping[f.field])
                      .map((f) => (
                        <th key={f.field} className="px-2 py-1 font-medium">
                          {f.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upload.sample_rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {schema.fields
                        .filter((f) => mapping[f.field])
                        .map((f) => (
                          <td key={f.field} className="px-2 py-1 text-slate-700">
                            {row[mapping[f.field]] ?? ''}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {requiredUnmapped.length > 0 && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Map the required field{requiredUnmapped.length > 1 ? 's' : ''}:{' '}
              {requiredUnmapped.join(', ')}
            </div>
          )}
          {commitErr && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {commitErr}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={reset}
              className="text-sm px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md"
            >
              ← Start over
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || requiredUnmapped.length > 0}
              className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold disabled:opacity-50"
            >
              {committing ? 'Importing…' : `Import ${upload.row_count} rows →`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — results */}
      {step === 3 && result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-lg font-semibold text-slate-900">Import complete</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Created" value={result.created} tone="good" />
            <Stat label="Skipped (dupes)" value={result.skipped} />
            <Stat label="Errors" value={result.error_count} tone={result.error_count ? 'bad' : undefined} />
          </div>
          {result.errors.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                Rows that didn't import
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-3 py-1.5 flex gap-3">
                    <span className="text-slate-400 shrink-0">Row {e.row}</span>
                    <span className="text-slate-700">{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'good' | 'bad'
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'bad'
        ? 'text-red-700'
        : 'text-slate-700'
  return (
    <div className="rounded-lg border border-slate-200 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}
