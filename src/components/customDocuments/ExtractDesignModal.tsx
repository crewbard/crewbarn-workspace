import { sanitizeHtml } from '@/components/SafeHtml'
import { useEffect, useRef, useState } from 'react'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type { DesignTokens } from '@/lib/extractedDocumentPdf'

/**
 * ExtractDesignModal — user uploads a PDF / image of their existing
 * branded document, AI inspects it and returns the design tokens
 * (colors, font, alignment, banner, density, paper size) that match.
 * User confirms before we apply them to the current template.
 */
export function ExtractDesignModal({
  onClose,
  onApply,
}: {
  onClose: () => void
  /** Called on confirm. `bodyHtml` is the AI-rebuilt body with merge
   *  tags + tables — caller routes it into the editor's body. */
  onApply: (tokens: DesignTokens, bodyHtml: string | null) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<DesignTokens | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  /** When true, the extracted body lands in the editor on Apply. */
  const [replaceBody, setReplaceBody] = useState<boolean>(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function upload() {
    if (!file) return
    setBusy(true)
    setError(null)
    setTokens(null)
    setNotes('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/templates/extract-design`, {
        method: 'POST',
        body: fd,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok || !body?.data?.ok) {
        throw new Error(body?.data?.error ?? body?.message ?? 'Extraction failed.')
      }
      setTokens(body.data.tokens as DesignTokens)
      setNotes(body.data.notes ?? '')
      setBodyHtml(body.data.body_html ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed.')
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    if (!tokens) return
    // body_format flips to 'html' when we have extracted body content
    // so the editor renders it WYSIWYG out of the box.
    const finalTokens: DesignTokens =
      replaceBody && bodyHtml
        ? { ...tokens, body_format: 'html' }
        : tokens
    onApply(finalTokens, replaceBody ? bodyHtml : null)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">
              📤 Extract design from existing doc
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a PDF or image of your existing branded document. AI reads
              the colors, fonts, and layout, then applies them to this template.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {!tokens && (
            <>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg px-6 py-10 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 transition-colors"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setFile(f)
                    setError(null)
                  }}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <p className="text-sm text-slate-900 font-medium">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024).toFixed(0)} KB · {file.type || 'file'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-2">Click to pick a different file.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-700 font-medium">Click to choose a file</p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, PNG, JPG, or WebP · 20 MB max
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                  {error}
                </div>
              )}
            </>
          )}

          {tokens && (
            <>
              {notes && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  ✓ <strong>AI:</strong> {notes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <TokenCard label="Primary color">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded border border-slate-200"
                      style={{ background: tokens.primary_color ?? '#f59e0b' }}
                    />
                    <span className="font-mono text-xs">{tokens.primary_color}</span>
                  </div>
                </TokenCard>
                <TokenCard label="Accent color">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded border border-slate-200"
                      style={{ background: tokens.accent_color ?? '#0f172a' }}
                    />
                    <span className="font-mono text-xs">{tokens.accent_color}</span>
                  </div>
                </TokenCard>
                <TokenCard label="Font family">
                  <span
                    className={
                      tokens.font_family === 'serif' ? 'font-serif text-sm' : 'font-sans text-sm'
                    }
                  >
                    {tokens.font_family === 'serif' ? 'Serif (Times)' : 'Sans-serif (Helvetica)'}
                  </span>
                </TokenCard>
                <TokenCard label="Header alignment">
                  <span className="text-sm capitalize">{tokens.header_alignment}</span>
                </TokenCard>
                <TokenCard label="Header banner">
                  <span className="text-sm">{tokens.header_banner ? 'Yes' : 'No'}</span>
                </TokenCard>
                <TokenCard label="Layout density">
                  <span className="text-sm capitalize">{tokens.layout_density}</span>
                </TokenCard>
                <TokenCard label="Paper size">
                  <span className="text-sm uppercase">{tokens.paper_size}</span>
                </TokenCard>
              </div>

              {/* Body content preview (when extracted) */}
              {bodyHtml && (
                <div className="rounded-lg border border-emerald-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-emerald-100 bg-emerald-50 flex items-center justify-between gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceBody}
                        onChange={(e) => setReplaceBody(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-medium text-emerald-900">
                        Use extracted body in the editor
                      </span>
                    </label>
                    <span className="text-[10px] text-emerald-700">
                      Tables, headings, signatures preserved · concrete values replaced with merge tags
                    </span>
                  </div>
                  <div
                    className="px-4 py-3 max-h-72 overflow-y-auto text-xs"
                    style={
                      {
                        fontFamily:
                          tokens.font_family === 'serif' || tokens.font_family === 'times' || tokens.font_family === 'georgia'
                            ? '"Times New Roman", Times, serif'
                            : 'Helvetica, Arial, sans-serif',
                        ['--primary' as string]: tokens.primary_color ?? '#f59e0b',
                        ['--accent' as string]: tokens.accent_color ?? '#0f172a',
                      } as React.CSSProperties
                    }
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml, { document: true }) }}
                  />
                </div>
              )}

              {/* Visual preview strip */}
              <div className="rounded-lg overflow-hidden border border-slate-200">
                {tokens.header_banner ? (
                  <div
                    className="px-4 py-4 text-center text-white font-bold"
                    style={{
                      background: tokens.primary_color,
                      color: bannerTextColor(tokens.primary_color ?? '#f59e0b'),
                      fontFamily:
                        tokens.font_family === 'serif'
                          ? '"Times New Roman", Times, serif'
                          : 'Helvetica, Arial, sans-serif',
                      textAlign:
                        tokens.header_alignment === 'center' ? 'center' : 'left',
                    }}
                  >
                    Sample Title
                  </div>
                ) : (
                  <div
                    className="px-4 pt-4"
                    style={{
                      fontFamily:
                        tokens.font_family === 'serif'
                          ? '"Times New Roman", Times, serif'
                          : 'Helvetica, Arial, sans-serif',
                      textAlign:
                        tokens.header_alignment === 'center' ? 'center' : 'left',
                    }}
                  >
                    <div
                      className="font-bold text-lg mb-1"
                      style={{ color: tokens.accent_color }}
                    >
                      Sample Title
                    </div>
                    <div
                      className="h-1 rounded-full"
                      style={{ background: tokens.primary_color }}
                    />
                  </div>
                )}
                <div className="px-4 py-3 text-xs text-slate-600">
                  This is how the title area will look with the extracted design.
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
          >
            Cancel
          </button>

          {!tokens && (
            <button
              type="button"
              onClick={upload}
              disabled={!file || busy}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {busy ? 'Analyzing…' : '✨ Extract design'}
            </button>
          )}

          {tokens && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTokens(null)
                  setNotes('')
                }}
                className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
              >
                ← Try another file
              </button>
              <button
                type="button"
                onClick={apply}
                className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                Apply to template →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TokenCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium mb-1">
        {label}
      </div>
      {children}
    </div>
  )
}

function bannerTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 170 ? '#0f172a' : '#ffffff'
}
