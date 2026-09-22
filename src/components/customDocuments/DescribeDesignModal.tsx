import { useEffect, useState } from 'react'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type { DesignTokens } from '@/lib/extractedDocumentPdf'
import { fontToCss } from '@/lib/extractedDocumentPdf'

/**
 * DescribeDesignModal — user types/pastes a plain-English (or copy/
 * paste from a brand brief) description of how the doc should look,
 * AI parses it into design tokens.
 *
 * Examples of what users type:
 *   "navy banner with white text, serif fonts, centered title"
 *   "compact invoice, modern blue, sans-serif"
 *   "letterhead style with red header, two-column layout"
 *   "match our website brand: orange (#ff7800) accents, Inter font"
 */
export function DescribeDesignModal({
  currentTokens,
  onClose,
  onApply,
}: {
  currentTokens: DesignTokens
  onClose: () => void
  onApply: (tokens: DesignTokens) => void
}) {
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<DesignTokens | null>(null)
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function generate() {
    if (!description.trim()) return
    setBusy(true)
    setError(null)
    setTokens(null)
    setNotes('')
    try {
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/templates/describe-design`, {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim(),
          current_tokens: currentTokens,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok || !body?.data?.ok) {
        throw new Error(body?.data?.error ?? body?.message ?? 'AI failed.')
      }
      setTokens(body.data.tokens as DesignTokens)
      setNotes(body.data.notes ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI failed.')
    } finally {
      setBusy(false)
    }
  }

  const primary = tokens?.primary_color ?? '#f59e0b'
  const accent = tokens?.accent_color ?? '#0f172a'

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
              ✨ Describe your design
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Type or paste a description (your brand guide, a Canva caption,
              specs from a designer). AI turns it into design tokens.
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
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  "Examples:\n\n" +
                  '"Navy banner with white text, serif fonts, centered title. Letter size, normal spacing."\n\n' +
                  '"Compact one-page invoice. Modern blue (#3b82f6). Sans-serif. Right-aligned totals."\n\n' +
                  '"Match our brand: orange #ff7800 primary, dark grey #2a2a2a accent, Inter font, no banner."\n\n' +
                  "Paste any brand guidelines, copy from a designer's spec, or just describe what you want."
                }
                rows={10}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 font-mono text-xs leading-relaxed"
              />
              <p className="text-[11px] text-slate-500">
                AI extracts: primary + accent color (hex), font family, paper
                size, density, alignment, banner yes/no, footer text. Anything
                you don&apos;t mention keeps its current value.
              </p>
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

              <div className="grid grid-cols-2 gap-3 text-sm">
                <TokenSwatch label="Primary" value={tokens.primary_color}>
                  <div
                    className="w-9 h-9 rounded border border-slate-200"
                    style={{ background: tokens.primary_color }}
                  />
                </TokenSwatch>
                <TokenSwatch label="Accent" value={tokens.accent_color}>
                  <div
                    className="w-9 h-9 rounded border border-slate-200"
                    style={{ background: tokens.accent_color }}
                  />
                </TokenSwatch>
                <TokenField label="Font" value={tokens.font_family ?? 'helvetica'} cssFont={fontToCss(tokens.font_family)} />
                <TokenField label="Alignment" value={tokens.header_alignment ?? 'left'} />
                <TokenField label="Banner" value={tokens.header_banner ? 'yes' : 'no'} />
                <TokenField label="Density" value={tokens.layout_density ?? 'normal'} />
                <TokenField label="Paper" value={(tokens.paper_size ?? 'letter').toUpperCase()} />
                {tokens.footer_text && (
                  <TokenField label="Footer" value={tokens.footer_text} />
                )}
              </div>

              {/* Live preview strip */}
              <div className="rounded-lg overflow-hidden border border-slate-200">
                {tokens.header_banner ? (
                  <div
                    className="px-4 py-4 font-bold"
                    style={{
                      background: primary,
                      color: lum(primary) > 170 ? '#0f172a' : '#ffffff',
                      fontFamily: fontToCss(tokens.font_family),
                      textAlign: tokens.header_alignment === 'center' ? 'center' : 'left',
                    }}
                  >
                    Sample title
                  </div>
                ) : (
                  <div
                    className="px-4 pt-4"
                    style={{
                      fontFamily: fontToCss(tokens.font_family),
                      textAlign: tokens.header_alignment === 'center' ? 'center' : 'left',
                    }}
                  >
                    <div className="font-bold text-lg mb-1" style={{ color: accent }}>
                      Sample title
                    </div>
                    <div className="h-1 rounded-full" style={{ background: primary }} />
                  </div>
                )}
                <div
                  className="px-4 py-3 text-xs"
                  style={{ fontFamily: fontToCss(tokens.font_family), color: '#475569' }}
                >
                  Body text in the chosen font + colors.
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
              onClick={generate}
              disabled={!description.trim() || busy}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {busy ? 'Thinking…' : '✨ Generate tokens'}
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
                ← Edit description
              </button>
              <button
                type="button"
                onClick={() => onApply(tokens)}
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

function TokenSwatch({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 flex items-center gap-3">
      {children}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
          {label}
        </div>
        <div className="font-mono text-xs text-slate-700">{value}</div>
      </div>
    </div>
  )
}

function TokenField({ label, value, cssFont }: { label: string; value: string; cssFont?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
        {label}
      </div>
      <div
        className="text-sm text-slate-800 capitalize"
        style={cssFont ? { fontFamily: cssFont } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function lum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 200
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b
}
