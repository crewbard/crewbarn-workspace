import { useEffect, useState } from 'react'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type { SmsCategoryOption } from './SmsTemplateEditor'

/**
 * AiGenerateSmsModal — describe-what-you-want flow for SMS templates.
 *
 * User picks a category, describes the text they want, hits Generate.
 * We POST to /v1/sms-templates/ai-draft which returns { name, body }.
 * The draft is handed to the parent, which opens SmsTemplateEditor
 * pre-filled.
 */

interface SmsDraft {
  name: string
  category: string
  body: string
}

interface Props {
  categories: SmsCategoryOption[]
  onClose: () => void
  onAccept: (draft: { name?: string; category?: string; body?: string }) => void
}

export function AiGenerateSmsModal({ categories, onClose, onAccept }: Props) {
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0]?.value ?? 'general')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<SmsDraft | null>(null)

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
      const payload: Record<string, unknown> = { description: description.trim(), category }
      if (name.trim()) payload.name = name.trim()
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/sms-templates/ai-draft`, {
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
      setDraft(body.data.draft as SmsDraft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI draft failed.')
    } finally {
      setBusy(false)
    }
  }

  function accept() {
    if (!draft) return
    onAccept({ name: draft.name, category: draft.category, body: draft.body })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">AI-generate SMS template</h2>
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
              Describe the text message you want. The AI drafts a short, plain-text
              starting point with merge tags — refine it in the editor afterwards.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
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
                placeholder="e.g. Appointment reminder (text)"
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
                rows={6}
                placeholder="e.g. A friendly reminder text the day before an appointment. Mention the time, the address, and the tech's name. Tell them to reply or call to reschedule. Keep it under 2 segments."
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 font-mono text-xs leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                SMS is plain text — the AI keeps it short and tag-friendly.
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
              Draft generated. Review below, then open in the editor to refine.
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
                  Category
                </label>
                <div className="text-sm text-slate-700">{draft.category}</div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                Message body
              </label>
              <pre className="text-xs whitespace-pre-wrap px-3 py-2 bg-slate-50 border border-slate-200 rounded max-h-60 overflow-y-auto">
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
              {busy ? 'Generating…' : 'Generate draft'}
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
                Regenerate
              </button>
              <button
                type="button"
                onClick={accept}
                className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                Open in editor
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
