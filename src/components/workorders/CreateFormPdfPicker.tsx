import { useState } from 'react'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'

/**
 * Standalone PDF picker rendered on the WO / Estimate / Sub create
 * forms. Lifts the file into parent state — the parent runs a
 * multipart POST after creating the WO/Estimate (when we have an id).
 *
 * Behavior on upload:
 *  - File goes into parent state immediately (so the form remembers
 *    what was picked).
 *  - We ALSO synchronously POST it to
 *    /v1/template-analysis/extract-content, which sends it to Claude
 *    and returns the extracted fields (customer name, address, scope,
 *    NTE, etc.). Results show up below the chip so the user can verify
 *    what was found before they hit Create.
 *  - Optionally the caller wires onExtracted() to use the extracted
 *    payload to pre-fill the form.
 */
export interface ExtractedContent {
  customer_name?: string
  customer_contact_name?: string
  customer_phone?: string
  customer_email?: string
  service_address?: string
  billing_address?: string
  wo_number?: string
  po_number?: string
  service_date?: string
  priority?: string
  job_type_id?: string
  job_type_name?: string
  scope_of_work?: string
  special_instructions?: string
  nte_dollars?: number
  vendor_partner_number?: string
  issuer_name?: string
  issuer_phone?: string
  matched_customer_id?: string
  matched_customer_name?: string
  matched_location_id?: string
}

export function CreateFormPdfPicker({
  file,
  onChange,
  onExtracted,
  hint = 'On job completion we stamp date, scope, signature, and GPS check-in/out coordinates onto this PDF.',
  compact = false,
}: {
  file: File | null
  onChange: (f: File | null) => void
  onExtracted?: (extracted: ExtractedContent) => string | void | Promise<string | void>
  hint?: string
  compact?: boolean
}) {
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [applicationMessage, setApplicationMessage] = useState<string | null>(null)

  async function handleFileChange(f: File | null) {
    onChange(f)
    setExtracted(null)
    setExtractError(null)
    setApplicationMessage(null)
    if (!f) return

    setExtracting(true)
    try {
      const ex = await extractContentFromPdf(f)
      setExtracted(ex)
      const message = await onExtracted?.(ex)
      setApplicationMessage(message ?? null)
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : 'AI extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  if (compact) {
    return (
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm mb-0 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-950 tracking-tight">
            Customer's WO / PO (optional)
          </h3>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 max-w-xl">{hint}</p>
            <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer text-sm px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-amber-300 text-slate-700">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <span aria-hidden="true">📄</span>
              <span className="font-medium">
                {file ? 'Replace PDF' : 'Choose PDF…'}
              </span>
            </label>
          </div>
          {file && (
            <div className="mt-3 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs">
              <span className="truncate flex-1 text-slate-800">📄 {file.name}</span>
              <span className="text-slate-500 shrink-0">
                {Math.round(file.size / 1024)} KB
              </span>
              <button
                type="button"
                onClick={() => handleFileChange(null)}
                className="text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded"
                aria-label="Remove PDF"
              >
                ×
              </button>
            </div>
          )}

          {/* AI extraction status + results */}
          {extracting && (
            <div className="mt-3 text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 rounded px-3 py-2">
              <span className="inline-flex items-center gap-2">
                <Spinner /> AI is reading the PDF — this usually takes 5–15 seconds…
              </span>
            </div>
          )}

          {extractError && !extracting && (
            <div className="mt-3 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">
              <strong>AI extraction failed:</strong> {extractError}
            </div>
          )}

          {extracted && !extracting && (
            <ExtractedPanel extracted={extracted} applicationMessage={applicationMessage} />
          )}
        </div>
      </section>
    )
  }

  return (
    <section className={compact ? 'bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm' : 'bg-white border border-slate-200 rounded-xl p-4'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950 tracking-tight">
            Customer's WO / PO (optional)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{hint}</p>
        </div>
        <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer text-sm px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-amber-300 text-slate-700">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <span aria-hidden="true">📄</span>
          <span className="font-medium">
            {file ? 'Replace PDF' : 'Choose PDF…'}
          </span>
        </label>
      </div>
      {file && (
        <div className="mt-3 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs">
          <span className="truncate flex-1 text-slate-800">📄 {file.name}</span>
          <span className="text-slate-500 shrink-0">
            {Math.round(file.size / 1024)} KB
          </span>
          <button
            type="button"
            onClick={() => handleFileChange(null)}
            className="text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded"
            aria-label="Remove PDF"
          >
            ×
          </button>
        </div>
      )}

      {/* AI extraction status + results */}
      {extracting && (
        <div className="mt-3 text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 rounded px-3 py-2">
          <span className="inline-flex items-center gap-2">
            <Spinner /> AI is reading the PDF — this usually takes 5–15 seconds…
          </span>
        </div>
      )}

      {extractError && !extracting && (
        <div className="mt-3 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">
          <strong>AI extraction failed:</strong> {extractError}
        </div>
      )}

      {extracted && !extracting && (
        <ExtractedPanel extracted={extracted} applicationMessage={applicationMessage} />
      )}
    </section>
  )
}

function ExtractedPanel({
  extracted,
  applicationMessage,
}: {
  extracted: ExtractedContent
  applicationMessage: string | null
}) {
  // Short single-line fields render in a tight 2-column grid.
  const shortRows: Array<[label: string, value: string | number | undefined]> = [
    ['Customer', extracted.customer_name],
    ['Contact', extracted.customer_contact_name],
    ['Phone', extracted.customer_phone],
    ['Email', extracted.customer_email],
    ["Customer's WO #", extracted.wo_number],
    ['PO #', extracted.po_number],
    ['Service date', extracted.service_date],
    ['Priority', extracted.priority],
    ['Job type', extracted.job_type_name],
    ['NTE', extracted.nte_dollars != null ? `$${extracted.nte_dollars.toFixed(2)}` : undefined],
    ['Vendor partner #', extracted.vendor_partner_number],
    ['Issuer', extracted.issuer_name],
    ['Issuer phone', extracted.issuer_phone],
  ]
  // Long multi-line fields render full-width below, wrapping naturally.
  const longRows: Array<[label: string, value: string | undefined]> = [
    ['Service address', extracted.service_address],
    ['Billing address', extracted.billing_address],
    ['Scope of work', extracted.scope_of_work],
    ['Special instructions', extracted.special_instructions],
  ]

  const filledShort = shortRows.filter(([, v]) => v != null && String(v).trim() !== '')
  const filledLong = longRows.filter(([, v]) => v != null && v.trim() !== '')
  const totalFilled = filledShort.length + filledLong.length

  return (
    <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded p-3">
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="text-xs font-semibold text-emerald-900 inline-flex items-center gap-1.5">
          <span>✨</span>
          AI extracted {totalFilled} field{totalFilled === 1 ? '' : 's'}
        </div>
        <span className="text-[10px] text-emerald-700 italic shrink-0">
          {applicationMessage
            ? applicationMessage
            : 'Verify before saving.'}
        </span>
      </div>
      {totalFilled === 0 ? (
        <p className="text-xs text-emerald-800">
          Nothing recognizable was extracted from this PDF. Fill the form by hand below.
        </p>
      ) : (
        <>
          {filledShort.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {filledShort.map(([label, value]) => (
                <div key={label} className="flex gap-2 min-w-0">
                  <dt className="text-emerald-700 font-medium shrink-0">{label}:</dt>
                  <dd className="text-emerald-900 break-words min-w-0">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {filledLong.length > 0 && (
            <dl className="mt-2 space-y-2 text-xs border-t border-emerald-200 pt-2">
              {filledLong.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-emerald-700 font-medium mb-0.5">{label}:</dt>
                  <dd className="text-emerald-900 whitespace-pre-line break-words">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}

      {/* Digital-signature ready notice — the PDF is now stored as a
          digital artifact and the form-field positions are detected
          in the background, so when the tech completes the job their
          signature + GPS + times stamp directly onto this PDF. */}
      <div className="mt-3 pt-2 border-t border-emerald-200 text-xs text-emerald-800 inline-flex items-start gap-1.5">
        <span aria-hidden="true">🖊</span>
        <span>
          <strong>Ready for digital signature.</strong> When the job completes, the customer's signature, tech sign-off, GPS check-in/out, and timestamps will be stamped directly onto this PDF and emailed back to the customer.
        </span>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3 w-3 text-indigo-700"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * POSTs a PDF to /v1/template-analysis/extract-content and returns
 * the AI-extracted content object.
 */
async function extractContentFromPdf(file: File): Promise<ExtractedContent> {
  const fd = new FormData()
  fd.append('file', file)

  const token = getStoredToken()
  const tenant = getActingTenant()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenant) headers['X-Act-As-Tenant'] = tenant

  const res = await fetch(`${API_URL}/v1/template-analysis/extract-content`, {
    method: 'POST',
    headers,
    body: fd,
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok || !payload?.ok) {
    const msg = payload?.message ?? payload?.error ?? `Extract failed (${res.status})`
    throw new Error(String(msg))
  }
  return (payload.extracted ?? {}) as ExtractedContent
}

/**
 * Posts a PDF to the WO/Estimate template endpoint. Best-effort:
 * a single failed upload doesn't roll back the parent record.
 */
export async function uploadCreatedFormPdf(
  endpoint: string,
  file: File,
): Promise<void> {
  const fd = new FormData()
  fd.append('template', file)
  const token = getStoredToken()
  const tenant = getActingTenant()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenant) headers['X-Act-As-Tenant'] = tenant
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: fd,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Upload failed (${res.status})`)
  }
}
