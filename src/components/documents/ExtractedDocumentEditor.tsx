import { useEffect, useRef, useState } from 'react'
import {
  useExtractedDoc,
  useExtractedDocRevisions,
  useSaveExtractedDoc,
} from '@/hooks/useExtractedDocuments'
import { renderMarkdownToPdfBlob, downloadBlob, buildPdfFilename } from '@/lib/extractedDocumentPdf'
import { API_URL, getStoredToken, getActingTenant } from '@/lib/api'

/**
 * ExtractedDocumentEditor — full-screen modal for editing the AI-extracted
 * markdown text. Two-pane:
 *   - Left: textarea (the editable content)
 *   - Right: revision history (most recent first), with editor + timestamp
 *
 * Save creates a new revision row with the current account stamped on it,
 * so every edit is traceable. The latest revision's content_text becomes
 * the canonical text on the parent extracted_documents row.
 *
 * PDF rendering of the current text is a future chunk (needs dompdf).
 */
interface Props {
  id: string
  onClose: () => void
}

export function ExtractedDocumentEditor({ id, onClose }: Props) {
  const detail = useExtractedDoc(id)
  const revisions = useExtractedDocRevisions(id)
  const save = useSaveExtractedDoc()

  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!detail.data?.data || loaded) return
    setContent(detail.data.data.content_text)
    setTitle(detail.data.data.title)
    setLoaded(true)
  }, [detail.data, loaded])

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const d = detail.data?.data
  const dirty = d && (content !== d.content_text || title !== d.title)

  function handleSave() {
    if (!d) return
    save.mutate(
      { id, body: { content_text: content, title, note: note.trim() || null } },
      {
        onSuccess: () => {
          setSavedAt(new Date())
          setNote('')
          // Auto-rerender the PDF so the stored edited version is always
          // current. Overwrites in place — no file pile-up.
          handleUpdatePdf()
        },
      },
    )
  }

  const [pdfBusy, setPdfBusy] = useState<'idle' | 'downloading' | 'uploading'>('idle')
  const [pdfError, setPdfError] = useState<string | null>(null)

  /**
   * Fetch all signed signature requests for this doc + return a
   * role→PNG-data-url map for the PDF renderer to composite in.
   */
  async function fetchSignatureMap(docId: string): Promise<Record<string, string>> {
    const token = getStoredToken()
    const actingTenant = getActingTenant()
    try {
      const resp = await fetch(`${API_URL}/v1/extracted-documents/${docId}/signature-requests`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      if (!resp.ok) return {}
      const body = await resp.json().catch(() => ({}))
      const rows: Array<{ role: string; status: string; signature_data_url: string | null }> = body?.data ?? []
      const map: Record<string, string> = {}
      for (const r of rows) {
        if (r.status === 'signed' && r.signature_data_url) map[r.role] = r.signature_data_url
      }
      return map
    } catch {
      return {}
    }
  }

  async function handleDownloadPdf() {
    if (!d) return
    setPdfError(null)
    setPdfBusy('downloading')
    try {
      const sigs = await fetchSignatureMap(d.id)
      const blob = await renderMarkdownToPdfBlob(title || d.title, content, sigs)
      downloadBlob(blob, buildPdfFilename(title || d.title))
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF generation failed')
    } finally {
      setPdfBusy('idle')
    }
  }

  /**
   * Render the current text to a PDF and overwrite the SINGLE canonical
   * PDF for this extracted doc in place. The original source file stays
   * untouched (it's the user's source-of-truth evidence); no growing
   * pile of timestamped attachments.
   */
  async function handleUpdatePdf() {
    if (!d) return
    setPdfError(null)
    setPdfBusy('uploading')
    try {
      const sigs = await fetchSignatureMap(d.id)
      const blob = await renderMarkdownToPdfBlob(title || d.title, content, sigs)
      const file = new File([blob], `${d.id}.pdf`, { type: 'application/pdf' })

      const fd = new FormData()
      fd.append('pdf', file)

      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/extracted-documents/${d.id}/upload-pdf`, {
        method: 'POST',
        body: fd,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body?.message ?? `HTTP ${resp.status}`)
      }
      detail.refetch()
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF render failed')
    } finally {
      setPdfBusy('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="text-base font-semibold text-navy-900 bg-transparent w-full outline-none border-b border-transparent hover:border-slate-200 focus:border-amber-400 -ml-1 pl-1"
            />
            {d?.last_edited_at && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Last edited {new Date(d.last_edited_at).toLocaleString()}
                {d.last_edited_by_account_id && ` · by ${d.last_edited_by_account_id}`}
                {d.current_pdf_url && (
                  <>
                    {' · '}
                    <a
                      href={d.current_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:underline"
                    >
                      Open current PDF
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">
              {savedAt
                ? `Saved ${savedAt.toLocaleTimeString()}`
                : dirty
                ? 'Unsaved'
                : 'Up to date'}
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Edit note (optional)"
              className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-amber-400 w-48"
            />
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfBusy !== 'idle' || !d}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              title="Render current text as PDF and download"
            >
              {pdfBusy === 'downloading' ? '…' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={handleUpdatePdf}
              disabled={pdfBusy !== 'idle' || !d}
              className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              title="Render the current text to PDF and overwrite the stored edited copy in place. Original source file stays untouched."
            >
              {pdfBusy === 'uploading' ? 'Rendering…' : 'Update PDF version'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || save.isPending}
              className="text-sm px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-lg w-6 h-6 flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="px-6 py-2 text-xs text-red-800 bg-red-50 border-b border-red-200">
            PDF: {pdfError}
          </div>
        )}

        {/* Body — split pane */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            {detail.isLoading && (
              <div className="p-8 text-sm text-slate-500">Loading…</div>
            )}
            {d?.status === 'failed' && (
              <div className="m-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-800">
                <strong>Extraction failed.</strong> {d.extraction_error ?? 'Unknown error.'}
              </div>
            )}
            {d?.status === 'extracted' && loaded && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Document content (markdown supported)"
                className="flex-1 px-6 py-4 resize-none outline-none font-mono text-sm leading-relaxed"
              />
            )}
          </div>

          {/* Right sidebar — tabbed: Ask AI / History / Signatures. */}
          <EditorSidebar
            docId={id}
            content={content}
            onInsertSignatureField={(role) => {
              const token = `[[signature:${role}]]`
              setContent((prev) => prev + (prev.endsWith('\n') ? '' : '\n\n') + token + '\n')
            }}
            revisions={revisions.data?.data ?? []}
            revisionsLoading={revisions.isLoading}
          />
        </div>
      </div>
    </div>
  )
}

// ---------- Sidebar (Ask / History / Signatures) ----------

interface SidebarRevision {
  id: string
  editor: string
  note: string | null
  created_at: string | null
  preview: string
}

interface SidebarProps {
  docId: string
  content: string
  onInsertSignatureField: (role: string) => void
  revisions: SidebarRevision[]
  revisionsLoading: boolean
}

function EditorSidebar({ docId, content, onInsertSignatureField, revisions, revisionsLoading }: SidebarProps) {
  const [tab, setTab] = useState<'ask' | 'history' | 'sign'>('ask')

  return (
    <aside className="w-80 border-l border-slate-200 overflow-y-auto bg-slate-50 flex flex-col">
      <div className="flex border-b border-slate-200 bg-white text-xs">
        {(['ask', 'history', 'sign'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'flex-1 px-3 py-2.5 font-medium uppercase tracking-wide transition-colors',
              tab === t ? 'text-navy-900 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            {t === 'ask' ? 'CBI' : t === 'history' ? 'History' : 'Signatures'}
          </button>
        ))}
      </div>

      {tab === 'ask' && <AskAboutDocPane docId={docId} />}

      {tab === 'history' && (
        <ul className="divide-y divide-slate-100">
          {revisionsLoading && <li className="px-4 py-3 text-xs text-slate-500">Loading…</li>}
          {revisions.map((r) => (
            <li key={r.id} className="px-4 py-2.5 hover:bg-white">
              <div className="text-xs font-medium text-slate-800">{r.editor}</div>
              <div className="text-[11px] text-slate-500">
                {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
              </div>
              {r.note && <div className="text-[11px] text-slate-600 italic mt-0.5">{r.note}</div>}
            </li>
          ))}
          {!revisionsLoading && revisions.length === 0 && (
            <li className="px-4 py-3 text-xs text-slate-500 italic">No revisions yet.</li>
          )}
        </ul>
      )}

      {tab === 'sign' && (
        <SignaturesPane docId={docId} content={content} onInsertSignatureField={onInsertSignatureField} />
      )}
    </aside>
  )
}

// ---------- Ask-about-this-doc pane (D) ----------

interface DocChatMessage {
  role: 'user' | 'assistant'
  content: string
  error?: string | null
}

function AskAboutDocPane({ docId }: { docId: string }) {
  const [messages, setMessages] = useState<DocChatMessage[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send() {
    const text = prompt.trim()
    if (!text || busy) return
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setPrompt('')
    setBusy(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/extracted-documents/${docId}/ask`, {
        method: 'POST',
        body: JSON.stringify({ prompt: text, history }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok || !body?.data?.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '', error: body?.data?.error ?? body?.message ?? 'AI failed.' }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: body.data.text }])
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  return (
    <div className="flex-1 flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            Ask anything about this document — &ldquo;summarize&rdquo;, &ldquo;what&apos;s the warranty period?&rdquo;,
            &ldquo;extract the addresses&rdquo;. AI sees only this document.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={[
                'inline-block max-w-[90%] px-2.5 py-1.5 rounded text-xs whitespace-pre-wrap',
                m.role === 'user' ? 'bg-amber-500 text-white' : m.error ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-white border border-slate-200 text-slate-800',
              ].join(' ')}
            >
              {m.error ? `✗ ${m.error}` : m.content}
            </div>
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
          placeholder="Ask about this doc…"
          rows={2}
          className="w-full text-xs resize-none px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
        />
      </div>
    </div>
  )
}

// ---------- Signatures pane (C) ----------

interface SigRow {
  id: string
  role: string
  signer_label: string | null
  signer_email: string | null
  status: 'pending' | 'signed' | 'declined' | 'revoked'
  signed_at: string | null
  expires_at: string | null
  signature_data_url: string | null
}

function SignaturesPane({
  docId,
  content,
  onInsertSignatureField,
}: {
  docId: string
  content: string
  onInsertSignatureField: (role: string) => void
}) {
  const [reqs, setReqs] = useState<SigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('customer')
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [createResult, setCreateResult] = useState<{ sign_url: string; role: string; email_sent?: boolean; email_error?: string | null } | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/extracted-documents/${docId}/signature-requests`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      setReqs(body?.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [docId])

  async function createRequest() {
    setCreateError(null)
    try {
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/extracted-documents/${docId}/signature-requests`, {
        method: 'POST',
        body: JSON.stringify({ role, signer_label: label || null, signer_email: email || null }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setCreateError(body?.message ?? `HTTP ${resp.status}`)
        return
      }
      setCreateResult({
        sign_url: body.data.sign_url,
        role: body.data.role,
        email_sent: body.data.email_sent,
        email_error: body.data.email_error,
      })
      setLabel(''); setEmail('')
      load()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed')
    }
  }

  async function revoke(id: string) {
    const token = getStoredToken()
    const actingTenant = getActingTenant()
    await fetch(`${API_URL}/v1/signature-requests/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
      },
    })
    load()
  }

  async function resend(id: string) {
    const token = getStoredToken()
    const actingTenant = getActingTenant()
    const resp = await fetch(`${API_URL}/v1/signature-requests/${id}/resend`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
      },
    })
    const body = await resp.json().catch(() => ({}))
    if (resp.ok && body?.data) {
      setCreateResult({
        sign_url: body.data.sign_url,
        role: '',
        email_sent: body.data.email_sent,
        email_error: body.data.email_error,
      })
    }
    load()
  }

  // Detect signature tokens present in body
  const tokensInBody = Array.from(content.matchAll(/\[\[signature:([a-zA-Z0-9_-]+)\]\]/g)).map((m) => m[1])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="bg-white border border-slate-200 rounded p-3">
        <div className="text-xs font-semibold text-slate-700 mb-1.5">Insert signature field</div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_'))}
            placeholder="role (customer)"
            className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => onInsertSignatureField(role)}
            disabled={!role.trim()}
            className="text-xs px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            + Add to doc
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">
          Inserts a {`[[signature:role]]`} token at the end of the body. The signer's drawn signature replaces it in the rendered PDF.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded p-3">
        <div className="text-xs font-semibold text-slate-700 mb-1.5">Request a signature</div>
        <div className="space-y-1.5">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
          >
            {tokensInBody.length === 0 ? (
              <option value="">No signature fields in body — add one above</option>
            ) : (
              tokensInBody.map((t) => <option key={t} value={t}>{t}</option>)
            )}
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Signer label (e.g. Joe Smith)"
            className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={createRequest}
            disabled={!role || tokensInBody.length === 0}
            className="w-full text-xs px-2 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            Create signing link
          </button>
        </div>
        {createError && <div className="text-[11px] text-red-700 mt-1.5">{createError}</div>}
        {createResult && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
            {createResult.email_sent ? (
              <span className="text-emerald-700">✓ Email sent to signer.</span>
            ) : createResult.email_error ? (
              <span className="text-amber-800">
                Email didn&apos;t send ({createResult.email_error}). Share the link manually:
              </span>
            ) : (
              <span>Share with signer:</span>
            )}
            <div className="font-mono break-all mt-1">{createResult.sign_url}</div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createResult.sign_url)}
              className="text-[10px] mt-1 px-1.5 py-0.5 rounded border border-amber-300 hover:bg-white"
            >
              Copy
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-700 mb-1.5 px-1">Outstanding + signed</div>
        {loading && <div className="text-xs text-slate-500 px-1">Loading…</div>}
        {!loading && reqs.length === 0 && <div className="text-xs text-slate-500 italic px-1">No signature requests yet.</div>}
        <ul className="space-y-1.5">
          {reqs.map((r) => (
            <li key={r.id} className="bg-white border border-slate-200 rounded p-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.role}</span>
                  {r.signer_label && <span className="text-slate-500"> · {r.signer_label}</span>}
                </div>
                <span
                  className={[
                    'text-[10px] uppercase tracking-wide px-1 rounded',
                    r.status === 'signed' ? 'bg-emerald-50 text-emerald-700' : r.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {r.status}
                </span>
              </div>
              {r.signer_email && <div className="text-[10px] text-slate-500 mt-0.5">{r.signer_email}</div>}
              {r.status === 'signed' && r.signed_at && (
                <div className="text-[10px] text-emerald-700 mt-0.5">Signed {new Date(r.signed_at).toLocaleString()}</div>
              )}
              {r.status === 'signed' && r.signature_data_url && (
                <img
                  src={r.signature_data_url}
                  alt="Signature"
                  className="mt-1 max-h-12 border border-slate-200 rounded bg-white"
                />
              )}
              {r.status === 'pending' && (
                <div className="mt-1 flex gap-3 text-[10px]">
                  <button
                    type="button"
                    onClick={() => resend(r.id)}
                    className="text-amber-700 hover:underline"
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(r.id)}
                    className="text-red-700 hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

