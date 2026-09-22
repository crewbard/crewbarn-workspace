import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import { MergeTagPanel } from './MergeTagPanel'
import { useStarters } from './templateStarters'

/**
 * SmsTemplateEditor — split-pane modal for editing a text-message
 * template. Deliberately simpler than TemplateEditor: SMS is plain
 * text, so there are no design tokens, no PDF, no HTML/visual editor,
 * no starters gallery.
 *
 *   - Header: name input + Save / Close
 *   - Left:   category + body textarea + live SMS segment counter
 *   - Right:  tabs (Tags / Ask AI / History) + active/default settings
 *
 * Ask AI replies carry "Replace body" / "Append" buttons so AI
 * suggestions land in the editor in one click.
 */

export interface SmsCategoryOption {
  value: string
  label: string
}

interface SmsTemplateRecord {
  id: string
  name: string
  category: string
  body?: string
  active: boolean
  is_default?: boolean
  merge_tags: string[]
  updated_at?: string | null
}

interface Props {
  /** null = create-new */
  templateId: string | null
  /** Optional initial draft (used when AI-Generate pre-fills). */
  initialDraft?: { name?: string; category?: string; body?: string }
  categories: SmsCategoryOption[]
  invalidateKey: string[]
  onClose: () => void
}

const ENDPOINT = '/v1/sms-templates'

/**
 * Rough SMS segment estimate. GSM-7 fits 160 chars in one segment,
 * 153/segment when concatenated. UCS-2 (emoji / accents) drops to
 * 70 / 67. Merge tags expand at send time so this is approximate —
 * the UI labels it as such.
 */
function smsSegments(text: string): { chars: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  const chars = text.length
  // Approximate: any character above the Latin-1 range (emoji, CJK, etc.)
  // forces the carrier to UCS-2, which shrinks the per-segment budget.
  let isUcs2 = false
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0xff) {
      isUcs2 = true
      break
    }
  }
  const single = isUcs2 ? 70 : 160
  const multi = isUcs2 ? 67 : 153
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi)
  return { chars, segments, encoding: isUcs2 ? 'UCS-2' : 'GSM-7' }
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  error?: string
}

export function SmsTemplateEditor({ templateId, initialDraft, categories, invalidateKey, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = !!templateId

  const detail = useQuery({
    queryKey: [...invalidateKey, templateId],
    queryFn: () => apiRequest<{ data: SmsTemplateRecord }>(`${ENDPOINT}/${templateId}`),
    enabled: !!templateId,
  })

  const revisions = useQuery({
    queryKey: [...invalidateKey, templateId, 'revisions'],
    queryFn: () =>
      apiRequest<{
        data: Array<{
          id: string
          header: string
          content: string
          editor: string
          note: string | null
          created_at: string | null
          preview: string
        }>
      }>(`${ENDPOINT}/${templateId}/revisions`),
    enabled: !!templateId,
  })

  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0]?.value ?? 'general')
  const [body, setBody] = useState('')
  const [active, setActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [tab, setTab] = useState<'tags' | 'ask' | 'history'>('tags')
  const [confirmResetStarter, setConfirmResetStarter] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const baselineRef = useRef<string | null>(null)
  const starters = useStarters('sms').data ?? []

  // Pre-fill from AI-Generate draft.
  useEffect(() => {
    if (!initialDraft || loaded) return
    setName(initialDraft.name ?? '')
    if (initialDraft.category) setCategory(initialDraft.category)
    setBody(initialDraft.body ?? '')
    setActive(true)
    setIsDefault(false)
    baselineRef.current = JSON.stringify({
      name: '',
      category: initialDraft.category ?? categories[0]?.value,
      body: '',
      active: true,
      isDefault: false,
    })
    setLoaded(true)
  }, [initialDraft, loaded, categories])

  // Apply loaded template (edit flow).
  useEffect(() => {
    if (!templateId || !detail.data || loaded) return
    const t = detail.data.data
    setName(t.name ?? '')
    setCategory(t.category ?? categories[0]?.value ?? 'general')
    setBody(t.body ?? '')
    setActive(!!t.active)
    setIsDefault(!!t.is_default)
    baselineRef.current = JSON.stringify({
      name: t.name ?? '',
      category: t.category ?? categories[0]?.value,
      body: t.body ?? '',
      active: !!t.active,
      isDefault: !!t.is_default,
    })
    setLoaded(true)
  }, [templateId, detail.data, loaded, categories])

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const dirty = useMemo(() => {
    const b = baselineRef.current
    const now = JSON.stringify({ name, category, body, active, isDefault })
    if (!b) return !!(name.trim() || body.trim())
    return now !== b
  }, [name, category, body, active, isDefault])

  const seg = useMemo(() => smsSegments(body), [body])

  const detectedTags = useMemo(() => {
    const matches = body.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g) ?? []
    return Array.from(new Set(matches))
  }, [body])
  const matchingStarter = useMemo(
    () => starters.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ?? null,
    [starters, name],
  )

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name, category, body, active, is_default: isDefault }
      if (note.trim()) payload.note = note.trim()
      const url = isEdit ? `${ENDPOINT}/${templateId}` : ENDPOINT
      return apiRequest<{ data: SmsTemplateRecord }>(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: payload,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey })
      setSavedAt(new Date())
      setNote('')
      baselineRef.current = JSON.stringify({ name, category, body, active, isDefault })
      if (!isEdit) {
        setTimeout(onClose, 500)
      } else {
        revisions.refetch()
      }
    },
  })

  const del = useMutation({
    mutationFn: () => apiRequest(`${ENDPOINT}/${templateId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey })
      onClose()
    },
  })

  function insertAtCursor(snippet: string) {
    const el = bodyRef.current
    if (el && document.activeElement === el) {
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = body.slice(0, start) + snippet + body.slice(end)
      setBody(next)
      setTimeout(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = start + snippet.length
      }, 0)
    } else {
      setBody((prev) => prev + snippet)
    }
  }

  function resetFromMatchingStarter() {
    if (!matchingStarter) return
    if (dirty) {
      setConfirmResetStarter(true)
      return
    }
    applyMatchingStarterReset()
  }

  function applyMatchingStarterReset() {
    if (!matchingStarter) return
    setCategory(matchingStarter.category)
    setBody(matchingStarter.body)
    setNote('Reset to CrewBarn starter')
    setConfirmResetStarter(false)
  }

  const saveDisabled = !dirty || save.isPending || !name.trim() || !body.trim()

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SMS template name (internal)"
              className="text-base font-semibold text-navy-900 bg-transparent w-full outline-none border-b border-transparent hover:border-slate-200 focus:border-amber-400 -ml-1 pl-1"
            />
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isEdit ? 'SMS template' : 'New SMS template'}
              {isDefault && <span className="ml-1 text-emerald-700 font-medium">· star default for {category}</span>}
              {savedAt && <span className="ml-1 text-emerald-600">· saved</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {matchingStarter && (
              <button
                type="button"
                onClick={resetFromMatchingStarter}
                disabled={save.isPending}
                className="text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50"
                title="Replace this text draft with the latest CrewBarn starter that matches this template name"
              >
                Reset starter
              </button>
            )}
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={saveDisabled}
              className="text-sm px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-lg w-7 h-7 flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {save.isError && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800">
            {(save.error as Error).message}
          </div>
        )}
        {confirmResetStarter && matchingStarter && (
          <div className="px-6 py-3 text-sm bg-amber-50 border-b border-amber-200 text-slate-800 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Reset this text template to the CrewBarn starter?</div>
              <div className="text-xs text-slate-600">
                This replaces the category and message body in the editor. You can review before saving.
              </div>
            </div>
            <button
              type="button"
              onClick={applyMatchingStarterReset}
              className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetStarter(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Left — editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-2.5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <span className="w-px h-4 bg-slate-200" />
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                Active
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                Default for {category}
              </label>
            </div>

            {detail.isLoading && <div className="p-8 text-sm text-slate-500">Loading…</div>}
            {(!templateId || loaded) && (
              <>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    'Hi {{customer.first_name}}, reminder from {{company.name}}: ' +
                    "we're scheduled for {{appointment.at}}. Reply or call {{company.phone}} to reschedule.\n\n" +
                    'TIP: Click the Tags panel on the right to drop in merge tags.'
                  }
                  className="flex-1 px-6 py-4 resize-none outline-none text-sm leading-relaxed"
                />
                {/* SMS segment counter */}
                <div className="px-6 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-4 text-[11px] text-slate-600 flex-wrap">
                  <span>
                    <strong className="text-slate-800">{seg.chars}</strong> chars
                  </span>
                  <span>
                    <strong className="text-slate-800">{seg.segments}</strong> SMS segment{seg.segments === 1 ? '' : 's'}
                  </span>
                  <span className="text-slate-400">{seg.encoding}</span>
                  {seg.segments > 1 && (
                    <span className="text-amber-700">
                      Multi-segment — each segment is billed separately by most carriers.
                    </span>
                  )}
                  <span className="ml-auto text-slate-400 italic">
                    Approx — merge tags expand at send time.
                  </span>
                </div>
                {detectedTags.length > 0 && (
                  <div className="px-6 py-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-mono truncate">
                    Uses: {detectedTags.join(', ')}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right — sidebar */}
          <aside className="w-96 border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-200 bg-white text-[11px]">
              {(['tags', 'ask', 'history'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={[
                    'flex-1 px-2 py-2.5 font-medium uppercase tracking-wide transition-colors',
                    tab === t ? 'text-navy-900 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-800',
                  ].join(' ')}
                >
                  {t === 'tags' ? 'Tags' : t === 'ask' ? 'CBI' : 'History'}
                </button>
              ))}
            </div>

            {tab === 'tags' && <MergeTagPanel onInsert={insertAtCursor} />}

            {tab === 'ask' && (
              <SmsAskPane
                templateId={templateId}
                templateName={name}
                category={category}
                currentBody={body}
                onReplaceBody={(t) => {
                  if (body.trim() && !confirm('Replace the current body with this AI response?')) return
                  setBody(t.trim())
                }}
                onAppendBody={(t) => setBody((prev) => (prev.trim() ? prev + '\n' + t.trim() : t.trim()))}
              />
            )}

            {tab === 'history' && (
              <div className="overflow-y-auto flex-1">
                {!templateId && (
                  <p className="px-4 py-3 text-xs text-slate-500 italic">
                    Save the template once to start tracking revisions.
                  </p>
                )}
                {templateId && revisions.isLoading && (
                  <p className="px-4 py-3 text-xs text-slate-500">Loading…</p>
                )}
                {templateId && !revisions.isLoading && (revisions.data?.data?.length ?? 0) === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-500 italic">No revisions yet.</p>
                )}
                <ul className="divide-y divide-slate-100">
                  {(revisions.data?.data ?? []).map((r) => (
                    <li key={r.id} className="px-4 py-3 hover:bg-white">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-xs font-medium text-slate-800">{r.editor}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Replace the current body with this revision?')) setBody(r.content)
                          }}
                          className="text-[10px] uppercase tracking-wide text-amber-700 hover:underline"
                        >
                          Restore
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                      </div>
                      {r.note && <div className="text-[11px] text-slate-600 italic mt-0.5">{r.note}</div>}
                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.preview}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl gap-3">
          <div className="flex items-center gap-3">
            {isEdit && (
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-sm px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Revision note (optional)"
              className="text-xs px-2 py-1.5 border border-slate-300 rounded w-56"
            />
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={saveDisabled}
              className="text-sm px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Ask AI pane ----------

function SmsAskPane({
  templateId,
  templateName,
  category,
  currentBody,
  onReplaceBody,
  onAppendBody,
}: {
  templateId: string | null
  templateName: string
  category: string
  currentBody: string
  onReplaceBody: (text: string) => void
  onAppendBody: (text: string) => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send() {
    const text = prompt.trim()
    if (!text || busy) return
    if (!currentBody.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: '', error: 'Type something in the editor first — the AI needs a draft to work with.' },
      ])
      setPrompt('')
      return
    }
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setPrompt('')
    setBusy(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const url = templateId
        ? `${API_URL}/v1/sms-templates/${templateId}/ask`
        : `${API_URL}/v1/sms-templates/ask-draft`
      const payload: Record<string, unknown> = { prompt: text, history }
      if (!templateId) {
        payload.name = templateName
        payload.category = category
        payload.body = currentBody
      }
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data?.data?.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '', error: data?.data?.error ?? data?.message ?? 'AI failed.' },
        ])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data.text }])
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            Ask anything about this SMS — &ldquo;make it shorter&rdquo;, &ldquo;friendlier
            tone&rdquo;, &ldquo;add the pay link&rdquo;. Each reply has{' '}
            <strong>Replace body</strong> + <strong>Append</strong> buttons.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={[
                'inline-block max-w-[90%] px-2.5 py-1.5 rounded text-xs whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-amber-500 text-white'
                  : m.error
                  ? 'bg-red-50 border border-red-200 text-red-900'
                  : 'bg-white border border-slate-200 text-slate-800',
              ].join(' ')}
            >
              {m.error ? `Error: ${m.error}` : m.content}
            </div>
            {m.role === 'assistant' && !m.error && m.content.trim() && (
              <div className="flex gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => onReplaceBody(m.content)}
                  className="text-[10px] px-2 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                >
                  Replace body
                </button>
                <button
                  type="button"
                  onClick={() => onAppendBody(m.content)}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                >
                  Append
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-xs text-slate-500">Thinking…</div>}
      </div>
      <div className="border-t border-slate-200 p-2 bg-white">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={templateId ? 'Ask about this template…' : 'Ask about this draft…'}
          rows={2}
          className="w-full text-xs resize-none px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
        />
      </div>
    </div>
  )
}
