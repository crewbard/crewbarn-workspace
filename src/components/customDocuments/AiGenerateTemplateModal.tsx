import { useEffect, useState } from 'react'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type { TemplateKind, CategoryOption } from './TemplateEditor'
import type { DesignTokens } from '@/lib/extractedDocumentPdf'

/**
 * AiGenerateTemplateModal — describe-what-you-want flow.
 *
 * User picks a category/type (contract, invoice, inspection, etc.), tells
 * the AI what they want and how they want it to look, hits Generate. We
 * POST to /v1/email-templates/ai-draft or /v1/document-templates/ai-draft,
 * which returns { name, subject|title, body }. We then hand the draft to
 * the parent which opens the TemplateEditor pre-filled.
 *
 * Two-step UI:
 *   1. Describe (textarea + category picker + name hint)
 *   2. Preview (show generated draft, "Open in editor" or "Regenerate")
 */

interface DraftEmail {
  name: string
  category: string
  subject: string
  body: string
  design_tokens?: DesignTokens
}
interface DraftDoc {
  name: string
  type: string
  title: string
  body: string
  design_tokens?: DesignTokens
}
type Draft = DraftEmail | DraftDoc

interface Props {
  kind: TemplateKind
  categories: CategoryOption[]
  onClose: () => void
  /** Called when user clicks Open in editor. Parent should mount the
   *  TemplateEditor in create mode with the draft pre-filled. */
  onAccept: (draft: {
    name?: string
    category?: string
    titleOrSubject?: string
    body?: string
    design_tokens?: DesignTokens
  }) => void
}

export function AiGenerateTemplateModal({ kind, categories, onClose, onAccept }: Props) {
  const noun = kind === 'email' ? 'email template' : 'document template'

  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0]?.value ?? 'general')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

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
    try {
      const endpoint =
        kind === 'email'
          ? `${API_URL}/v1/email-templates/ai-draft`
          : `${API_URL}/v1/document-templates/ai-draft`
      const payload: Record<string, unknown> = { description: description.trim() }
      if (name.trim()) payload.name = name.trim()
      if (kind === 'email') payload.category = category
      else payload.type = category

      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok || !body?.data?.ok || !body?.data?.draft) {
        throw new Error(body?.data?.error ?? body?.message ?? 'AI draft failed.')
      }
      setDraft(body.data.draft as Draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI draft failed.')
    } finally {
      setBusy(false)
    }
  }

  function accept() {
    if (!draft) return
    if (kind === 'email') {
      const d = draft as DraftEmail
      onAccept({
        name: d.name,
        category: d.category,
        titleOrSubject: d.subject,
        body: d.body,
        design_tokens: d.design_tokens,
      })
    } else {
      const d = draft as DraftDoc
      onAccept({
        name: d.name,
        category: d.type,
        titleOrSubject: d.title,
        body: d.body,
        design_tokens: d.design_tokens,
      })
    }
  }

  const headerLabel = kind === 'email' ? 'Subject' : 'Title'
  const titleOrSubject =
    draft && (kind === 'email' ? (draft as DraftEmail).subject : (draft as DraftDoc).title)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">
            ✨ AI-generate {noun}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg w-6 h-6 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!draft && (
          <div className="px-6 py-5 overflow-y-auto space-y-4">
            <p className="text-sm text-slate-600">
              Tell the AI what you want and how you want it to look. It&apos;ll draft a
              starting point — you can refine in the editor afterwards.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                {kind === 'email' ? 'Category' : 'Document type'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === 'email'
                    ? 'e.g. Friendly invoice reminder (7d)'
                    : 'e.g. Annual maintenance contract'
                }
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                Describe what you want
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                placeholder={
                  kind === 'email'
                    ? "e.g. A friendly reminder about an overdue invoice. Tone should be polite but firm. Mention the invoice number, the amount due, and how many days past due. Include a payment link placeholder. Sign off as the company owner."
                    : "e.g. A service contract for annual locksmith maintenance. Include parties, scope of work (rekey, lubrication, hardware inspection), payment schedule, and signature lines for both customer and our company. Use a clean professional layout."
                }
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 font-mono text-xs leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                The more detail (tone, structure, what to include), the better the draft.
              </p>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                {error}
              </div>
            )}
          </div>
        )}

        {draft && (
          <div className="px-6 py-5 overflow-y-auto space-y-4">
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
              ✓ Draft generated. Review below, then open in the editor to refine.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                  Name
                </label>
                <div className="text-sm font-medium text-slate-900">{draft.name}</div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                  {kind === 'email' ? 'Category' : 'Type'}
                </label>
                <div className="text-sm text-slate-700">
                  {kind === 'email'
                    ? (draft as DraftEmail).category
                    : (draft as DraftDoc).type}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                {headerLabel}
              </label>
              <div className="text-sm text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded">
                {titleOrSubject}
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                Body preview
              </label>
              <pre className="text-xs font-mono whitespace-pre-wrap px-3 py-2 bg-slate-50 border border-slate-200 rounded max-h-80 overflow-y-auto">
                {draft.body}
              </pre>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
          >
            Cancel
          </button>

          {!draft && (
            <button
              type="button"
              onClick={generate}
              disabled={busy || !description.trim()}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {busy ? 'Generating…' : '✨ Generate draft'}
            </button>
          )}

          {draft && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={busy}
                className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50"
              >
                ← Regenerate
              </button>
              <button
                type="button"
                onClick={accept}
                className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                Open in editor →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
