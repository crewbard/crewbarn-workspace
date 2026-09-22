import { sanitizeHtml } from '@/components/SafeHtml'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import { renderMarkdownToPdfBlob, renderHtmlToPdfBlob, downloadBlob, buildPdfFilename, markdownToHtml, fontToCss } from '@/lib/extractedDocumentPdf'
import type { DesignTokens, FontFamilyName } from '@/lib/extractedDocumentPdf'
import { THEMES, useStarters, type Starter } from './templateStarters'
import { ExtractDesignModal } from './ExtractDesignModal'
import { DescribeDesignModal } from './DescribeDesignModal'
import { BlockLibrary } from './BlockLibrary'
import { MergeTagPanel } from './MergeTagPanel'
import { StarterDetailModal } from './StarterDetailModal'
import { ElementStyler } from './ElementStyler'

/**
 * TemplateEditor — split-pane modal for editing an email or document
 * template.
 *
 *   - Header: name input + Save / PDF / Close
 *   - Left:   subject/title bar + body textarea + Starter library button
 *   - Right:  tabs (Ask AI / History / Settings)
 *
 * Design tokens (theme, primary/accent color, header alignment) are
 * stored on the template row and respected by the PDF renderer so the
 * tenant gets real branded docs, not just text.
 *
 * is_default flips the template into "the one we use by default for
 * this category/type". Only one default per (tenant, category) at the
 * DB level — the backend auto-demotes the prior default on save.
 *
 * Ask AI answers carry an "Apply to body" button so AI suggestions can
 * land in the editor in one click (no copy/paste).
 */

export type TemplateKind = 'email' | 'document'

export interface CategoryOption {
  value: string
  label: string
}

interface TemplateRecord {
  id: string
  name: string
  category?: string
  type?: string
  subject?: string
  title?: string
  body?: string
  active: boolean
  is_default?: boolean
  design_tokens?: DesignTokens | null
  merge_tags: string[]
  updated_at?: string | null
}

interface Props {
  kind: TemplateKind
  /** null = create-new */
  templateId: string | null
  /** Optional initial draft (used when AI-Generate pre-fills) */
  initialDraft?: {
    name?: string
    category?: string  // unified — maps to category|type by kind
    titleOrSubject?: string
    body?: string
    design_tokens?: DesignTokens
  }
  categories: CategoryOption[]
  onClose: () => void
  invalidateKey: string[]
  /**
   * 'modal' = legacy overlay shell (fixed inset, dimmed backdrop).
   * 'fullPage' = render flush in the parent route container.
   *   Defaults to 'modal' for back-compat with any caller still
   *   using the overlay style. The new /custom-documents/:tab/:id
   *   route renders with 'fullPage'.
   */
  variant?: 'modal' | 'fullPage'
  /**
   * When true, fires a fire-and-forget save (POST for new, PATCH for
   * existing) on unmount if the body is dirty and has at least a name +
   * title/subject + body. Used by the full-page route so navigating
   * back to the library doesn't drop in-progress edits.
   */
  autoSaveOnUnmount?: boolean
}

const ENDPOINTS: Record<TemplateKind, string> = {
  email: '/v1/email-templates',
  document: '/v1/document-templates',
}

/**
 * Strip markdown code fences from an AI response so the body doesn't
 * land as literal "```html\n…\n```" text in the editor.
 *
 * Handles three common LLM output shapes:
 *   1. Entire reply is a single fenced block (```html\n…\n```)
 *   2. Prose + a fenced block (we extract just the first block)
 *   3. No fence at all (return as-is)
 *
 * Language tag is optional and ignored — `html`, `css`, `js`, plain.
 */
function stripCodeFence(text: string): string {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return ''
  // Case 1: entire response is one fenced block.
  const whole = trimmed.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```\s*$/)
  if (whole) return whole[1].trim()
  // Case 2: prose + a fenced block — take the first one.
  const inner = trimmed.match(/```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```/)
  if (inner) return inner[1].trim()
  return trimmed
}

function detectSignatureSlots(text: string): string[] {
  const matches = text.match(/\[\[\s*signature:\s*([a-zA-Z0-9_-]+)\s*\]\]/gi) ?? []
  return Array.from(new Set(matches.map((m) => m.replace(/\s+/g, ''))))
}

function workflowDefaultLabel(kind: TemplateKind, category: string): string {
  if (kind === 'email') {
    switch (category) {
      case 'invoice': return 'Invoice emails'
      case 'estimate': return 'Estimate emails'
      case 'appointment': return 'Appointment reminders'
      case 'job': return 'Job automations'
      default: return `${category.replace(/_/g, ' ')} emails`
    }
  }
  switch (category) {
    case 'invoice': return 'Invoice PDF / print'
    case 'estimate': return 'Estimate documents'
    case 'work_order': return 'Job work orders'
    case 'contract': return 'Customer agreements'
    case 'inspection': return 'Inspection reports'
    case 'receipt': return 'Receipts'
    default: return `${category.replace(/_/g, ' ')} documents`
  }
}

function workflowRequiredTags(kind: TemplateKind, category: string): string[] {
  if (kind === 'email') {
    switch (category) {
      case 'invoice': return ['{{customer.first_name}}', '{{invoice.number}}', '{{invoice.pay_link}}']
      case 'estimate': return ['{{customer.first_name}}', '{{job.address}}', '{{portal.url}}']
      case 'appointment': return ['{{customer.first_name}}', '{{appointment.at}}', '{{job.address}}']
      case 'job': return ['{{customer.first_name}}', '{{job.address}}', '{{company.phone}}']
      default: return ['{{customer.first_name}}', '{{company.name}}']
    }
  }
  switch (category) {
    case 'invoice': return ['{{invoice.number}}', '{{billing_customer.name}}', '{{products.total}}']
    case 'estimate': return ['{{job.number}}', '{{customer.name}}', '{{products.total}}']
    case 'work_order': return ['{{job.number}}', '{{customer.name}}', '{{service_location.full_address}}']
    case 'contract': return ['{{customer.name}}', '{{job.description}}', '[[signature:customer]]']
    case 'inspection': return ['{{job.number}}', '{{customer.name}}', '{{technician.name}}']
    case 'receipt': return ['{{invoice.number}}', '{{payment.method}}', '{{products.total}}']
    default: return ['{{customer.name}}', '{{company.name}}']
  }
}

function missingWorkflowTags(kind: TemplateKind, category: string, header: string, body: string): string[] {
  const source = `${header} ${body}`.replace(/\s+/g, '')
  return workflowRequiredTags(kind, category).filter((tag) => !source.includes(tag.replace(/\s+/g, '')))
}

export function TemplateEditor({
  kind,
  templateId,
  initialDraft,
  categories,
  onClose,
  invalidateKey,
  variant = 'modal',
  autoSaveOnUnmount = false,
}: Props) {
  const qc = useQueryClient()
  const endpoint = ENDPOINTS[kind]
  const isEdit = !!templateId
  const categoryField = kind === 'email' ? 'category' : 'type'
  const titleField = kind === 'email' ? 'subject' : 'title'
  const noun = kind === 'email' ? 'email template' : 'document template'
  const headerLabel = kind === 'email' ? 'Subject' : 'Title'

  const detail = useQuery({
    queryKey: [...invalidateKey, templateId],
    queryFn: () => apiRequest<{ data: TemplateRecord }>(`${endpoint}/${templateId}`),
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
      }>(`${endpoint}/${templateId}/revisions`),
    enabled: !!templateId,
  })

  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0]?.value ?? 'general')
  const [titleOrSubject, setTitleOrSubject] = useState('')
  const [body, setBody] = useState('')
  const [active, setActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  // body_format is locked to 'html' as of the markdown-removal pass —
  // markdown jargon was confusing the non-technical user base and pro
  // doc builders (DocuSign / PandaDoc / etc.) don't expose markdown
  // either. Legacy markdown templates auto-convert on load below.
  const [designTokens, setDesignTokens] = useState<DesignTokens>({
    ...THEMES.classic,
    body_format: 'html',
  })
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [showStarters, setShowStarters] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showExtractDesign, setShowExtractDesign] = useState(false)
  const [showDescribeDesign, setShowDescribeDesign] = useState(false)
  const [confirmResetStarter, setConfirmResetStarter] = useState(false)
  /**
   * Starter pick → tag select two-step. When the user clicks a starter
   * card we stash it here and open StarterDetailModal for them to pick
   * which merge tags they want pinned. Confirming applies the starter +
   * pinned_tags via applyStarter().
   */
  const [pendingStarter, setPendingStarter] = useState<Starter | null>(null)
  const [livePreview, setLivePreview] = useState(false)
  /**
   * Visual = WYSIWYG contenteditable (the editor IS the rendered view).
   * Source = raw textarea with HTML markup visible.
   * Only meaningful when body_format === 'html'; markdown mode always
   * shows the textarea regardless.
   */
  const [editorView, setEditorView] = useState<'visual' | 'source'>('visual')
  /**
   * Bumped whenever external code (starter apply, AI replace, history
   * restore, AI Generate accept) writes a new body. The VisualEditor
   * subtree is keyed by this so it remounts and re-seeds its
   * contenteditable innerHTML — without this, typing inside would
   * reset on every external write because innerHTML isn't React-bound.
   */
  const [visualEditorKey, setVisualEditorKey] = useState(0)
  const bumpVisualKey = () => setVisualEditorKey((k) => k + 1)
  const baselineRef = useRef<{
    name: string
    category: string
    titleOrSubject: string
    body: string
    active: boolean
    isDefault: boolean
    designTokens: string
  } | null>(null)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const visualEditorRef = useRef<VisualEditorHandle>(null)

  // Apply optional pre-fill draft on mount (AI Generate flow).
  useEffect(() => {
    if (!initialDraft || loaded) return
    setName(initialDraft.name ?? '')
    if (initialDraft.category) setCategory(initialDraft.category)
    setTitleOrSubject(initialDraft.titleOrSubject ?? '')
    setBody(initialDraft.body ?? '')
    setActive(true)
    setIsDefault(false)
    if (initialDraft.design_tokens) setDesignTokens(initialDraft.design_tokens)
    baselineRef.current = {
      name: '',
      category: initialDraft.category ?? categories[0]?.value ?? 'general',
      titleOrSubject: '',
      body: '',
      active: true,
      isDefault: false,
      designTokens: JSON.stringify(initialDraft.design_tokens ?? THEMES.classic),
    }
    bumpVisualKey()
    setLoaded(true)
  }, [initialDraft, loaded, categories])

  // Apply loaded template (edit flow).
  useEffect(() => {
    if (!templateId || !detail.data || loaded) return
    const t = detail.data.data as any

    // Legacy markdown migration. Templates created before the markdown
    // mode was dropped have body_format='markdown' (or missing) with a
    // markdown body. Convert to HTML on load so the WYSIWYG renders it
    // correctly + the user's next save persists the conversion. No-op
    // for templates already in HTML.
    let loadedBody: string = t.body ?? ''
    let loadedTokens: DesignTokens = t.design_tokens ?? THEMES.classic
    const wasMarkdown = (loadedTokens.body_format ?? 'markdown') !== 'html'
    if (wasMarkdown && loadedBody.trim()) {
      loadedBody = markdownToHtml(loadedBody)
    }
    loadedTokens = { ...loadedTokens, body_format: 'html' }

    setName(t.name ?? '')
    setCategory(t[categoryField] ?? categories[0]?.value ?? 'general')
    setTitleOrSubject(t[titleField] ?? '')
    setBody(loadedBody)
    setActive(!!t.active)
    setIsDefault(!!t.is_default)
    setDesignTokens(loadedTokens)
    baselineRef.current = {
      name: t.name ?? '',
      category: t[categoryField] ?? categories[0]?.value ?? 'general',
      titleOrSubject: t[titleField] ?? '',
      body: loadedBody,
      active: !!t.active,
      isDefault: !!t.is_default,
      designTokens: JSON.stringify(loadedTokens),
    }
    bumpVisualKey()
    setLoaded(true)
  }, [templateId, detail.data, loaded, categoryField, titleField, categories])

  // Esc closes (only when no inner modal is open). Skip in fullPage
  // mode — there the browser back button / "← Library" link is the
  // close path, and Esc would steal focus from the user typing.
  useEffect(() => {
    if (variant === 'fullPage') return
    function onKey(e: KeyboardEvent) {
      if (
        e.key === 'Escape' &&
        !showStarters &&
        !showPreview &&
        !showExtractDesign &&
        !showDescribeDesign &&
        !pendingStarter
      ) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [variant, onClose, showStarters, showPreview, showExtractDesign, showDescribeDesign, pendingStarter])

  const dirty = useMemo(() => {
    const b = baselineRef.current
    if (!b) {
      return !!(name.trim() || titleOrSubject.trim() || body.trim())
    }
    return (
      name !== b.name ||
      category !== b.category ||
      titleOrSubject !== b.titleOrSubject ||
      body !== b.body ||
      active !== b.active ||
      isDefault !== b.isDefault ||
      JSON.stringify(designTokens) !== b.designTokens
    )
  }, [name, category, titleOrSubject, body, active, isDefault, designTokens])

  const detectedTags = useMemo(() => {
    const matches = (titleOrSubject + ' ' + body).match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g) ?? []
    return Array.from(new Set(matches))
  }, [titleOrSubject, body])

  const signatureSlots = useMemo(() => detectSignatureSlots(body), [body])
  const isSignableTemplate = kind === 'document' && signatureSlots.length > 0
  const workflowLabel = workflowDefaultLabel(kind, category)
  const workflowMissingTags = useMemo(
    () => missingWorkflowTags(kind, category, titleOrSubject, body),
    [kind, category, titleOrSubject, body],
  )

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name,
        body,
        active,
        is_default: isDefault,
        design_tokens: designTokens,
      }
      payload[categoryField] = category
      payload[titleField] = titleOrSubject
      if (note.trim()) payload.note = note.trim()
      const url = isEdit ? `${endpoint}/${templateId}` : endpoint
      return apiRequest<{ data: TemplateRecord }>(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: payload,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey })
      setSavedAt(new Date())
      setNote('')
      baselineRef.current = {
        name,
        category,
        titleOrSubject,
        body,
        active,
        isDefault,
        designTokens: JSON.stringify(designTokens),
      }
      if (!isEdit) {
        setTimeout(onClose, 500)
      } else {
        revisions.refetch()
      }
    },
  })

  const del = useMutation({
    mutationFn: () => apiRequest(`${endpoint}/${templateId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey })
      onClose()
    },
  })

  // Auto-save on unmount (full-page route only). Track latest state in
  // a ref so the cleanup function reads current values, not the state
  // captured when the effect was created. Fire-and-forget: if the save
  // fails, we silently drop it (parent has already navigated away).
  // Threshold: must have a name AND a title/subject AND a body to avoid
  // creating junk drafts when someone briefly opens "New" and bails.
  const latestStateRef = useRef({
    name, category, titleOrSubject, body, active, isDefault, designTokens, note,
  })
  useEffect(() => {
    latestStateRef.current = {
      name, category, titleOrSubject, body, active, isDefault, designTokens, note,
    }
  }, [name, category, titleOrSubject, body, active, isDefault, designTokens, note])

  useEffect(() => {
    if (!autoSaveOnUnmount) return
    return () => {
      const s = latestStateRef.current
      // Same dirty check the save button uses
      const base = baselineRef.current
      const isDirty = !base ||
        s.name !== base.name ||
        s.category !== base.category ||
        s.titleOrSubject !== base.titleOrSubject ||
        s.body !== base.body ||
        s.active !== base.active ||
        s.isDefault !== base.isDefault ||
        JSON.stringify(s.designTokens) !== base.designTokens
      if (!isDirty) return
      // Skip junk drafts — must have all three core fields
      if (!s.name.trim() || !s.titleOrSubject.trim() || !s.body.trim()) return

      const payload: Record<string, unknown> = {
        name: s.name,
        body: s.body,
        active: s.active,
        is_default: s.isDefault,
        design_tokens: s.designTokens,
      }
      payload[categoryField] = s.category
      payload[titleField] = s.titleOrSubject
      if (s.note.trim()) payload.note = s.note.trim()

      const url = isEdit ? `${endpoint}/${templateId}` : endpoint
      // Fire and forget — page is unmounting, caller has navigated.
      apiRequest(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: payload,
      }).then(() => {
        qc.invalidateQueries({ queryKey: invalidateKey })
      }).catch((e) => {
        // Log only; we don't want stuck UI on a route exit.
        // eslint-disable-next-line no-console
        console.warn('Template auto-save on unmount failed:', e)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveOnUnmount])

  async function handleDownloadPdf() {
    setPdfError(null)
    setPdfBusy(true)
    try {
      const headerText = titleOrSubject || name || 'Template'
      const blob =
        designTokens.body_format === 'html'
          ? await renderHtmlToPdfBlob(headerText, body, designTokens)
          : await renderMarkdownToPdfBlob(headerText, body, {}, designTokens)
      downloadBlob(blob, buildPdfFilename(headerText))
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF generation failed')
    } finally {
      setPdfBusy(false)
    }
  }

  function applyRevision(content: string, header: string) {
    setBody(content)
    setTitleOrSubject(header)
    bumpVisualKey()
  }

  function insertAtCursor(snippet: string) {
    // If the visual editor is active, fire through its imperative
    // handle so insertion lands at the contenteditable cursor.
    if (
      (designTokens.body_format ?? 'markdown') === 'html' &&
      editorView === 'visual' &&
      visualEditorRef.current
    ) {
      visualEditorRef.current.insertText(snippet)
      return
    }
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
      setBody((prev) => prev + (prev.endsWith('\n') ? '' : '\n') + snippet)
    }
  }

  /**
   * Insert raw HTML at the editor's cursor. Used by the Blocks side
   * panel. Falls back to textarea append for non-visual modes.
   */
  function insertHtmlAtCursor(html: string) {
    if (
      (designTokens.body_format ?? 'markdown') === 'html' &&
      editorView === 'visual' &&
      visualEditorRef.current
    ) {
      visualEditorRef.current.insertHtml(html)
      return
    }
    // Source / markdown modes: append the HTML as text. Users in those
    // modes are editing markup directly, so plain insertion is right.
    setBody((prev) => prev + (prev.endsWith('\n') ? '' : '\n\n') + html + '\n')
  }

  function applyStarter(s: Starter, chosenTags: string[]) {
    if (
      body.trim() &&
      !confirm('Replace the current body with this starter? You can undo with the History tab after saving.')
    ) {
      return
    }
    setName((prev) => prev || s.name)
    setCategory(s.category)
    setTitleOrSubject(s.titleOrSubject)
    setBody(s.body)
    setDesignTokens({ ...s.design_tokens, pinned_tags: chosenTags })
    bumpVisualKey()
    setShowStarters(false)
    setPendingStarter(null)
  }

  function replaceBodyFromAi(text: string) {
    if (
      body.trim() &&
      !confirm('Replace the current body with this AI response?')
    ) {
      return
    }
    setBody(stripCodeFence(text))
    bumpVisualKey()
  }

  function appendBodyFromAi(text: string) {
    const clean = stripCodeFence(text)
    setBody((prev) => (prev.trim() ? prev + '\n\n' + clean : clean))
    bumpVisualKey()
  }

  // Starter library now comes from the backend (single source of truth).
  const starters = useStarters(kind).data ?? []
  const filteredStarters = starters.filter((s) => s.category === category || category === 'general')
  const startersToShow = filteredStarters.length > 0 ? filteredStarters : starters
  const matchingStarter = useMemo(
    () => starters.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ?? null,
    [starters, name],
  )
  const workflowTagsAreActionable = active && (isDefault || !!matchingStarter)

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
    setTitleOrSubject(matchingStarter.titleOrSubject)
    setBody(matchingStarter.body)
    setDesignTokens({
      ...matchingStarter.design_tokens,
      pinned_tags: designTokens.pinned_tags ?? [],
    })
    setNote('Reset to CrewBarn starter')
    bumpVisualKey()
    setConfirmResetStarter(false)
  }

  const saveDisabled =
    !dirty ||
    save.isPending ||
    !name.trim() ||
    !titleOrSubject.trim() ||
    !body.trim()

  // Outer shell: legacy 'modal' renders as a fixed overlay over the
  // current page; 'fullPage' fills the route container so the editor
  // gets its own URL + browser back button.
  const Shell = variant === 'fullPage' ? FullPageShell : ModalShell
  const innerCardClass = variant === 'fullPage'
    ? 'bg-white w-full h-full flex flex-col'
    : 'bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col'

  return (
    <Shell>
      <div className={innerCardClass}>
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${noun} name (internal)`}
              className="text-base font-semibold text-navy-900 bg-transparent w-full outline-none border-b border-transparent hover:border-slate-200 focus:border-amber-400 -ml-1 pl-1"
            />
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isEdit ? `${noun} · ` : `New ${noun} · `}
              {isDefault && (
                <span className="text-emerald-700 font-medium">★ Default · </span>
              )}
              {kind === 'document' && (
                <span className={isSignableTemplate ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  {isSignableTemplate ? `Signable (${signatureSlots.length}) · ` : 'Not signable · '}
                </span>
              )}
              {detail.data?.data?.updated_at && (
                <>Last saved {new Date(detail.data.data.updated_at).toLocaleString()} · </>
              )}
              {detectedTags.length > 0 ? (
                <>
                  Tags: <span className="font-mono">{detectedTags.slice(0, 4).join(', ')}</span>
                  {detectedTags.length > 4 && ` +${detectedTags.length - 4}`}
                </>
              ) : (
                <span className="italic">No merge tags yet — try {'{{customer.name}}'}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">
              {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : dirty ? 'Unsaved' : 'Up to date'}
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Edit note (optional)"
              className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-amber-400 w-40"
            />
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!body.trim()}
              className="text-xs px-2.5 py-1.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium disabled:opacity-50"
              title="Preview this template filled with a real job's data"
            >
              👁 Preview
            </button>
            {!isDefault && (
              <button
                type="button"
                onClick={() => setIsDefault(true)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-medium"
                title={`Make this the default template for ${workflowLabel.toLowerCase()}`}
              >
                Make workflow default
              </button>
            )}
            {matchingStarter && (
              <button
                type="button"
                onClick={resetFromMatchingStarter}
                disabled={save.isPending}
                className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50"
                title="Replace this editor draft with the latest CrewBarn starter that matches this template name"
              >
                Reset starter
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfBusy || !body.trim()}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              title="Render the current body to PDF and download"
            >
              {pdfBusy ? '…' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={saveDisabled}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm disabled:opacity-50"
              title={
                saveDisabled
                  ? 'Fill name, subject/title, and body before saving'
                  : ''
              }
            >
              {save.isPending
                ? 'Saving…'
                : isEdit
                ? 'Save template'
                : 'Create template'}
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
        {save.isError && (
          <div className="px-6 py-2 text-xs text-red-800 bg-red-50 border-b border-red-200">
            Save failed: {(save.error as Error)?.message ?? 'Unknown error'}
          </div>
        )}
        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 text-xs flex flex-wrap items-center gap-2">
          <span
            className={[
              'font-semibold rounded px-2 py-0.5 border',
              isDefault
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200',
            ].join(' ')}
          >
            {isDefault ? `Workflow default: ${workflowLabel}` : `Not workflow default for ${workflowLabel}`}
          </span>
          {workflowMissingTags.length > 0 ? (
            <span className={workflowTagsAreActionable ? 'text-amber-800' : 'text-slate-600'}>
              {workflowTagsAreActionable ? 'Missing recommended tags:' : 'Optional recommended tags:'}{' '}
              <span className="font-mono">{workflowMissingTags.join(', ')}</span>
            </span>
          ) : (
            <span className="text-emerald-700">Recommended workflow tags are present.</span>
          )}
          {workflowMissingTags.length > 0 && (
            <span className="ml-auto flex flex-wrap gap-1">
              {workflowMissingTags.slice(0, 3).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertAtCursor(tag)}
                  className={[
                    'font-mono text-[10px] px-1.5 py-0.5 rounded border bg-white',
                    workflowTagsAreActionable
                      ? 'border-amber-300 hover:bg-amber-50 text-amber-900'
                      : 'border-slate-300 hover:bg-slate-50 text-slate-700',
                  ].join(' ')}
                  title={`Insert ${tag}`}
                >
                  + {tag}
                </button>
              ))}
            </span>
          )}
        </div>
        {confirmResetStarter && matchingStarter && (
          <div className="px-6 py-3 text-sm bg-amber-50 border-b border-amber-200 text-slate-800 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Reset this template to the CrewBarn starter?</div>
              <div className="text-xs text-slate-600">
                This replaces the category, {headerLabel.toLowerCase()}, body, and design settings in the editor. You can review before saving.
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

        {/* Body — split pane */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Subject/Title bar + starter gallery opener. The gallery gives
                owners a visual pick before the existing merge-tag step. */}
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 font-medium w-16 shrink-0">
                {headerLabel}
              </label>
              <input
                type="text"
                value={titleOrSubject}
                onChange={(e) => setTitleOrSubject(e.target.value)}
                placeholder={
                  kind === 'email'
                    ? 'Friendly reminder: invoice {{invoice.number}}'
                    : 'Service Agreement — {{customer.name}}'
                }
                className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowStarters(true)}
                title="Open visual starter template gallery"
                className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium shrink-0"
              >
                Start from template
              </button>
            </div>

            {/* Color strip — preview of the current theme */}
            <div
              className="h-1.5 shrink-0"
              style={{
                background: designTokens.primary_color ?? '#f59e0b',
              }}
            />

            {/* Quick tags strip — one-click insertion of the tags the user
                pinned in the starter picker (or the full tag library via
                the 🏷 Tags side tab). */}
            {(designTokens.pinned_tags?.length ?? 0) > 0 && (
              <div className="px-4 py-2 border-b border-slate-100 bg-amber-50/30 flex items-center gap-2 shrink-0 overflow-x-auto">
                <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium whitespace-nowrap">
                  Quick tags
                </span>
                {designTokens.pinned_tags!.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertAtCursor(tag)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 whitespace-nowrap"
                    title={`Click to insert at cursor: ${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setDesignTokens({ ...designTokens, pinned_tags: [] })
                  }
                  className="ml-auto text-[10px] text-slate-500 hover:text-slate-700 underline whitespace-nowrap"
                  title="Clear quick-tag chips"
                >
                  Clear
                </button>
              </div>
            )}

            {kind === 'document' && (
              <div className="px-4 py-2 border-b border-slate-100 bg-emerald-50/40 flex items-center gap-2 shrink-0 overflow-x-auto">
                <span className="text-[10px] uppercase tracking-wide text-emerald-800 font-semibold whitespace-nowrap">
                  Signature slots
                </span>
                {['[[signature:customer]]', '[[signature:technician]]', '[[signature:company]]'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertAtCursor(tag)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-900 whitespace-nowrap"
                    title={`Insert signature slot: ${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-emerald-900 whitespace-nowrap">
                  {isSignableTemplate ? `${signatureSlots.length} in this template` : 'Add one to make it signable'}
                </span>
              </div>
            )}

            {/* Body view toggle */}
            <div className="px-6 py-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0 flex-wrap">
              {/* HTML-only editor as of the markdown-removal pass. Two
                  sub-views: visual WYSIWYG (default, what 95% of users
                  want) and HTML source for the rare power user. */}
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                Editor
              </span>
              <div className="flex gap-1">
                {(['visual', 'source'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEditorView(v)}
                    className={[
                      'text-[11px] px-2.5 py-1 rounded border',
                      editorView === v
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-medium'
                        : 'border-slate-200 hover:border-slate-400 text-slate-600',
                    ].join(' ')}
                    title={
                      v === 'visual'
                        ? 'WYSIWYG — type and format directly, what you see is the final doc'
                        : 'Raw HTML — paste pre-styled markup or tweak by hand'
                    }
                  >
                    {v === 'visual' ? '✏️ Visual' : '</> HTML'}
                  </button>
                ))}
              </div>

              {/* Live preview only useful when we're NOT already in visual mode */}
              {!((designTokens.body_format ?? 'markdown') === 'html' && editorView === 'visual') && (
                <button
                  type="button"
                  onClick={() => setLivePreview((v) => !v)}
                  className={[
                    'ml-auto text-[11px] px-2.5 py-1 rounded border',
                    livePreview
                      ? 'bg-amber-500 border-amber-500 text-white font-medium'
                      : 'border-slate-300 hover:bg-slate-50 text-slate-700',
                  ].join(' ')}
                  title="Show a live-rendered pane next to the source editor"
                >
                  {livePreview ? '👁 Live preview ON' : '👁 Live preview'}
                </button>
              )}
            </div>

            {detail.isLoading && (
              <div className="p-8 text-sm text-slate-500">Loading…</div>
            )}
            {(!templateId || loaded) && (
              <div className="flex-1 flex overflow-hidden">
                {(designTokens.body_format ?? 'markdown') === 'html' && editorView === 'visual' ? (
                  <VisualEditor
                    key={visualEditorKey}
                    ref={visualEditorRef}
                    initialBody={body}
                    onChange={setBody}
                    designTokens={designTokens}
                  />
                ) : (
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      (designTokens.body_format ?? 'markdown') === 'html'
                        ? '<div style="display:flex;gap:16px">\n  <div>\n    <strong>BILL TO</strong><br/>\n    {{customer.name}}<br/>\n    {{customer.address}}\n  </div>\n  <div>\n    <strong>INVOICE #</strong> {{invoice.number}}<br/>\n    <strong>DATE</strong> {{today}}\n  </div>\n</div>\n\nPaste HTML from Canva, Figma export, your existing template, etc.'
                        : kind === 'email'
                        ? 'Hi {{customer.first_name}},\n\nJust a quick reminder…\n\nTIP: Click 📋 Starters above to start from a ready-made template.'
                        : `# Title\n\n:::cols\n**LEFT BLOCK**\nLine one\nLine two\n+++\n**RIGHT BLOCK**\nLine one\nLine two\n:::\n\n| Description | Qty | Total |\n|:---|---:|---:|\n| Item | 1 | $0.00 |\n\nTIP: Click 📋 Starters above for ready-made layouts.\n\nLayout syntax:\n  :::cols ... +++ ... :::   = side-by-side blocks\n  |:---|---:|:--:|          = table column alignment (left / right / center)\n  $/numeric cells auto right-align`
                    }
                    className={[
                      livePreview ? 'w-1/2 border-r border-slate-200' : 'flex-1',
                      'px-6 py-4 resize-none outline-none font-mono text-sm leading-relaxed',
                    ].join(' ')}
                  />
                )}
                {livePreview && !(designTokens.body_format === 'html' && editorView === 'visual') && (
                  <LivePreviewPane body={body} designTokens={designTokens} />
                )}
              </div>
            )}
          </div>

          {/* Right sidebar — tabbed: Ask AI / History / Settings */}
          <EditorSidebar
            kind={kind}
            templateId={templateId}
            category={category}
            setCategory={setCategory}
            active={active}
            setActive={setActive}
            isDefault={isDefault}
            setIsDefault={setIsDefault}
            workflowLabel={workflowLabel}
            workflowMissingTags={workflowMissingTags}
            workflowTagsAreActionable={workflowTagsAreActionable}
            designTokens={designTokens}
            setDesignTokens={setDesignTokens}
            categories={categories}
            categoryField={categoryField}
            revisions={revisions.data?.data ?? []}
            revisionsLoading={revisions.isLoading}
            onRestoreRevision={applyRevision}
            onInsertSnippet={insertAtCursor}
            isEdit={isEdit}
            onDelete={isEdit ? () => del.mutate() : undefined}
            deleting={del.isPending}
            currentName={name}
            currentBody={body}
            currentHeader={titleOrSubject}
            onReplaceBodyFromAi={replaceBodyFromAi}
            onAppendBodyFromAi={appendBodyFromAi}
            onOpenExtractDesign={() => setShowExtractDesign(true)}
            onOpenDescribeDesign={() => setShowDescribeDesign(true)}
            onInsertHtml={insertHtmlAtCursor}
          />
        </div>
      </div>

      {showStarters && (
        <StartersModal
          starters={startersToShow}
          allStarters={starters}
          currentCategory={category}
          onClose={() => setShowStarters(false)}
          onPick={(s) => {
            setShowStarters(false)
            setPendingStarter(s)
          }}
        />
      )}

      {pendingStarter && (
        <StarterDetailModal
          starter={pendingStarter}
          onClose={() => {
            // Backing out from tag-select returns to the starters gallery
            setPendingStarter(null)
            setShowStarters(true)
          }}
          onUse={(chosenTags) => applyStarter(pendingStarter, chosenTags)}
        />
      )}

      {showPreview && (
        <PreviewModal
          kind={kind}
          header={titleOrSubject}
          body={body}
          designTokens={designTokens}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showExtractDesign && (
        <ExtractDesignModal
          onClose={() => setShowExtractDesign(false)}
          onApply={(extracted, extractedBody) => {
            // Merge extracted tokens into the current set.
            setDesignTokens({ ...designTokens, ...extracted })
            // If the user opted to use the extracted body, drop it
            // into the editor. bumpVisualKey forces VisualEditor to
            // remount with the new content (innerHTML isn't React-bound).
            if (extractedBody && extractedBody.trim()) {
              if (
                body.trim() &&
                !confirm(
                  'Replace the current body with the content extracted from the uploaded doc?',
                )
              ) {
                setShowExtractDesign(false)
                return
              }
              setBody(extractedBody)
              bumpVisualKey()
            }
            setShowExtractDesign(false)
          }}
        />
      )}

      {showDescribeDesign && (
        <DescribeDesignModal
          currentTokens={designTokens}
          onClose={() => setShowDescribeDesign(false)}
          onApply={(extracted) => {
            setDesignTokens({ ...designTokens, ...extracted })
            setShowDescribeDesign(false)
          }}
        />
      )}
    </Shell>
  )
}

// Outer-shell variants. Modal = fixed overlay over the current page;
// FullPage = render flush in the route container (no overlay, no
// max-width cap) so the editor gets its own URL + back button.
function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      {children}
    </div>
  )
}

function FullPageShell({ children }: { children: React.ReactNode }) {
  // Flex column so the inner card (which is h-full) fills the page
  // height. parent route container provides the chrome around this.
  return <div className="flex flex-col h-full">{children}</div>
}

// ---------- Sidebar (Ask / History / Settings) ----------

interface SidebarRev {
  id: string
  header: string
  content: string
  editor: string
  note: string | null
  created_at: string | null
  preview: string
}

function EditorSidebar({
  kind,
  templateId,
  category,
  setCategory,
  active,
  setActive,
  isDefault,
  setIsDefault,
  workflowLabel,
  workflowMissingTags,
  workflowTagsAreActionable,
  designTokens,
  setDesignTokens,
  categories,
  categoryField,
  revisions,
  revisionsLoading,
  onRestoreRevision,
  onInsertSnippet,
  isEdit,
  onDelete,
  deleting,
  currentName,
  currentBody,
  currentHeader,
  onReplaceBodyFromAi,
  onAppendBodyFromAi,
  onOpenExtractDesign,
  onOpenDescribeDesign,
  onInsertHtml,
}: {
  kind: TemplateKind
  templateId: string | null
  category: string
  setCategory: (v: string) => void
  active: boolean
  setActive: (v: boolean) => void
  isDefault: boolean
  setIsDefault: (v: boolean) => void
  workflowLabel: string
  workflowMissingTags: string[]
  workflowTagsAreActionable: boolean
  designTokens: DesignTokens
  setDesignTokens: (v: DesignTokens) => void
  categories: CategoryOption[]
  categoryField: 'category' | 'type'
  revisions: SidebarRev[]
  revisionsLoading: boolean
  onRestoreRevision: (content: string, header: string) => void
  onInsertSnippet: (snippet: string) => void
  isEdit: boolean
  onDelete?: () => void
  deleting: boolean
  currentName: string
  currentBody: string
  currentHeader: string
  onReplaceBodyFromAi: (text: string) => void
  onAppendBodyFromAi: (text: string) => void
  onOpenExtractDesign: () => void
  onOpenDescribeDesign: () => void
  onInsertHtml: (html: string) => void
}) {
  const [tab, setTab] = useState<'blocks' | 'tags' | 'style' | 'ask' | 'history' | 'settings'>('blocks')

  // Right-click in the canvas dispatches 'tpl:open-style-tab' so the
  // user can jump straight to "fix this element's color" without
  // hunting for the Style tab manually.
  useEffect(() => {
    function open() { setTab('style') }
    window.addEventListener('tpl:open-style-tab', open)
    return () => window.removeEventListener('tpl:open-style-tab', open)
  }, [])

  const tabLabels: Record<typeof tab, string> = {
    blocks: 'Blocks',
    tags: 'Tags',
    style: 'Style',
    ask: 'CBI',
    history: 'History',
    settings: 'Design',
  }
  const tabIcons: Record<typeof tab, string> = {
    blocks: '🧱',
    tags: '🏷',
    style: '🖌',
    ask: '💬',
    history: '📜',
    settings: '🎨',
  }

  return (
    <aside className="w-96 border-l border-slate-200 overflow-hidden bg-slate-50 flex flex-col">
      <div className="flex border-b border-slate-200 bg-white">
        {(['blocks', 'tags', 'style', 'ask', 'history', 'settings'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              // Stack emoji over label so 'History' / 'Design' don't
              // wrap inconsistently with the shorter 'Ask' / 'Tags'.
              // Every tab looks the same now.
              'flex-1 px-1 py-2 flex flex-col items-center gap-0.5 font-medium uppercase tracking-wide transition-colors',
              tab === t
                ? 'text-navy-900 border-b-2 border-amber-500'
                : 'text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            <span className="text-base leading-none">{tabIcons[t]}</span>
            <span className="text-[10px]">{tabLabels[t]}</span>
          </button>
        ))}
      </div>

      {tab === 'blocks' && <BlockLibrary onInsert={onInsertHtml} />}

      {tab === 'tags' && <MergeTagPanel onInsert={onInsertSnippet} />}

      {tab === 'style' && <ElementStyler />}

      {tab === 'ask' && (
        <AskAboutTemplatePane
          kind={kind}
          templateId={templateId}
          templateName={currentName}
          category={category}
          currentBody={currentBody}
          currentHeader={currentHeader}
          onReplaceBody={onReplaceBodyFromAi}
          onAppendBody={onAppendBodyFromAi}
        />
      )}

      {tab === 'history' && (
        <div className="overflow-y-auto flex-1">
          {!templateId && (
            <p className="px-4 py-3 text-xs text-slate-500 italic">
              Save the template once to start tracking revisions.
            </p>
          )}
          {templateId && revisionsLoading && (
            <p className="px-4 py-3 text-xs text-slate-500">Loading…</p>
          )}
          {templateId && !revisionsLoading && revisions.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-500 italic">No revisions yet.</p>
          )}
          <ul className="divide-y divide-slate-100">
            {revisions.map((r) => (
              <li key={r.id} className="px-4 py-3 hover:bg-white">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs font-medium text-slate-800">{r.editor}</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Replace the current editor content with this revision?')) {
                        onRestoreRevision(r.content, r.header)
                      }
                    }}
                    className="text-[10px] uppercase tracking-wide text-amber-700 hover:underline"
                  >
                    Restore
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                </div>
                {r.note && (
                  <div className="text-[11px] text-slate-600 italic mt-0.5">{r.note}</div>
                )}
                <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.preview}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'settings' && (
        <DesignAndSettingsPane
          kind={kind}
          category={category}
          setCategory={setCategory}
          active={active}
          setActive={setActive}
          isDefault={isDefault}
          setIsDefault={setIsDefault}
          workflowLabel={workflowLabel}
          workflowMissingTags={workflowMissingTags}
          workflowTagsAreActionable={workflowTagsAreActionable}
          designTokens={designTokens}
          setDesignTokens={setDesignTokens}
          categories={categories}
          categoryField={categoryField}
          isEdit={isEdit}
          onDelete={onDelete}
          deleting={deleting}
          onOpenExtractDesign={onOpenExtractDesign}
          onOpenDescribeDesign={onOpenDescribeDesign}
        />
      )}
    </aside>
  )
}

// ---------- Design + Settings pane ----------

function DesignAndSettingsPane({
  kind,
  category,
  setCategory,
  active,
  setActive,
  isDefault,
  setIsDefault,
  workflowLabel,
  workflowMissingTags,
  workflowTagsAreActionable,
  designTokens,
  setDesignTokens,
  categories,
  categoryField,
  isEdit,
  onDelete,
  deleting,
  onOpenExtractDesign,
  onOpenDescribeDesign,
}: {
  kind: TemplateKind
  category: string
  setCategory: (v: string) => void
  active: boolean
  setActive: (v: boolean) => void
  isDefault: boolean
  setIsDefault: (v: boolean) => void
  workflowLabel: string
  workflowMissingTags: string[]
  workflowTagsAreActionable: boolean
  designTokens: DesignTokens
  setDesignTokens: (v: DesignTokens) => void
  categories: CategoryOption[]
  categoryField: 'category' | 'type'
  isEdit: boolean
  onDelete?: () => void
  deleting: boolean
  onOpenExtractDesign: () => void
  onOpenDescribeDesign: () => void
}) {
  function applyTheme(themeKey: keyof typeof THEMES) {
    // Merge into existing tokens — THEMES presets only cover
    // theme / primary_color / accent_color, so a plain replace would
    // wipe body_format, paper_size, layout_density, etc. Without
    // body_format=html the editor flips to its source-textarea
    // fallback view (looks like the visual editor died).
    setDesignTokens({ ...designTokens, ...THEMES[themeKey] })
  }

  function patchTokens(patch: Partial<DesignTokens>) {
    setDesignTokens({ ...designTokens, ...patch, theme: 'custom' })
  }

  return (
    <div className="overflow-y-auto flex-1 p-4 space-y-5 text-sm">
      {/* Defaults card */}
      <section className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          Use this template
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">
            {categoryField === 'type' ? 'Document type' : 'Category'}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded text-amber-600 focus:ring-amber-500"
          />
          <span>Active (available to use)</span>
        </label>

        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="font-medium text-emerald-800">★ Default for {category}</span>
            <span className="block text-[11px] text-slate-500">
              {kind === 'email'
                ? 'Used automatically when CrewBarn sends this kind of email (e.g. invoice reminders).'
                : 'Used automatically when CrewBarn generates this kind of doc.'}
              {' '}Only one default per {categoryField === 'type' ? 'type' : 'category'}.
            </span>
          </span>
        </label>
        <div
          className={[
            'rounded-md border px-3 py-2 text-xs',
            workflowTagsAreActionable && workflowMissingTags.length > 0
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : isDefault
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-slate-200 bg-slate-50 text-slate-700',
          ].join(' ')}
        >
          <div className="font-semibold">
            {isDefault ? `Default for ${workflowLabel}` : `${workflowLabel} default`}
          </div>
          {workflowMissingTags.length > 0 ? (
            <p className="mt-1">
              {workflowTagsAreActionable ? 'Recommended tags missing:' : 'Optional recommended tags:'}{' '}
              <span className="font-mono">{workflowMissingTags.join(', ')}</span>
            </p>
          ) : (
            <p className="mt-1">Recommended workflow tags are present.</p>
          )}
          {!isDefault && (
            <button
              type="button"
              onClick={() => setIsDefault(true)}
              className="mt-2 text-[11px] px-2 py-1 rounded border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-900 font-medium"
            >
              Make workflow default
            </button>
          )}
        </div>
      </section>

      {/* Brand assets (logo + brand color) */}
      <BrandPanel />

      {/* Theme picker */}
      <section className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            Theme
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onOpenDescribeDesign}
              className="text-[10px] px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium"
              title="Describe your design in plain English — AI turns it into tokens"
            >
              ✨ Describe design
            </button>
            <button
              type="button"
              onClick={onOpenExtractDesign}
              className="text-[10px] px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium"
              title="Upload your existing branded doc — AI extracts the design"
            >
              📤 From existing doc
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((key) => {
            const t = THEMES[key]
            const active = designTokens.theme === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyTheme(key)}
                className={[
                  'rounded-md border-2 overflow-hidden transition-all',
                  active ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200 hover:border-slate-400',
                ].join(' ')}
                title={key}
              >
                <div className="h-5" style={{ background: t.primary_color }} />
                <div className="h-3" style={{ background: t.accent_color }} />
                <div className="text-[9px] text-center py-0.5 capitalize">{key}</div>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Primary
            </label>
            <input
              type="color"
              value={designTokens.primary_color ?? '#f59e0b'}
              onChange={(e) => patchTokens({ primary_color: e.target.value })}
              className="w-full h-8 border border-slate-200 rounded cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Accent
            </label>
            <input
              type="color"
              value={designTokens.accent_color ?? '#0f172a'}
              onChange={(e) => patchTokens({ accent_color: e.target.value })}
              className="w-full h-8 border border-slate-200 rounded cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Auto-title alignment
          </label>
          <div className="flex gap-1">
            {(['left', 'center'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => patchTokens({ header_alignment: align })}
                className={[
                  'flex-1 text-xs px-2 py-1.5 rounded border capitalize',
                  designTokens.header_alignment === align ||
                  (!designTokens.header_alignment && align === 'left')
                    ? 'bg-amber-50 border-amber-400 text-amber-900'
                    : 'border-slate-200 hover:border-slate-400 text-slate-600',
                ].join(' ')}
              >
                {align}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
            Aligns the PDF's auto-generated title strip (the template's{' '}
            <em>Title</em> field at the top of the doc). Does <strong>not</strong>{' '}
            affect H1s you place inside the body — those follow their own CSS.
          </p>
        </div>
      </section>

      {/* Page layout */}
      <section className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          Page layout
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Density
          </label>
          <div className="flex gap-1">
            {(['compact', 'normal', 'spacious'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => patchTokens({ layout_density: d })}
                className={[
                  'flex-1 text-xs px-2 py-1.5 rounded border capitalize',
                  (designTokens.layout_density ?? 'normal') === d
                    ? 'bg-amber-50 border-amber-400 text-amber-900'
                    : 'border-slate-200 hover:border-slate-400 text-slate-600',
                ].join(' ')}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
            {(() => {
              const d = designTokens.layout_density ?? 'normal'
              if (d === 'compact')
                return 'Tight margins + smaller text. Best for one-page invoices, receipts.'
              if (d === 'spacious')
                return 'Wider margins + airy spacing. Best for contracts + agreements.'
              return 'Default brand layout.'
            })()}
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Paper size
          </label>
          <select
            value={designTokens.paper_size ?? 'letter'}
            onChange={(e) => patchTokens({ paper_size: e.target.value as DesignTokens['paper_size'] })}
            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
          >
            <option value="letter">US Letter (8.5 × 11)</option>
            <option value="legal">US Legal (8.5 × 14)</option>
            <option value="a4">A4 (210 × 297 mm)</option>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Contracts often use legal for the extra signing room.
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Font family
          </label>
          <select
            value={designTokens.font_family ?? 'helvetica'}
            onChange={(e) =>
              patchTokens({ font_family: e.target.value as FontFamilyName })
            }
            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
            style={{ fontFamily: fontToCss(designTokens.font_family) }}
          >
            <optgroup label="Sans-serif">
              <option value="helvetica" style={{ fontFamily: fontToCss('helvetica') }}>
                Helvetica
              </option>
              <option value="arial" style={{ fontFamily: fontToCss('arial') }}>
                Arial
              </option>
              <option value="inter" style={{ fontFamily: fontToCss('inter') }}>
                Inter
              </option>
            </optgroup>
            <optgroup label="Serif">
              <option value="times" style={{ fontFamily: fontToCss('times') }}>
                Times New Roman
              </option>
              <option value="georgia" style={{ fontFamily: fontToCss('georgia') }}>
                Georgia
              </option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="courier" style={{ fontFamily: fontToCss('courier') }}>
                Courier
              </option>
            </optgroup>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            PDFs use jsPDF&apos;s stock fonts — Arial / Inter render as Helvetica,
            Georgia as Times. The in-app preview shows the real font.
          </p>
        </div>

      </section>

      {/* Insert merge tags + signature placeholders live in the
          🏷 Tags side tab now — full categorized + searchable list
          plus drag-and-drop into the editor. */}
      <p className="text-[11px] text-slate-500 italic px-1">
        💡 Insert merge tags via the <strong>🏷 Tags</strong> tab.
        Drop in pre-built layout blocks via <strong>🧱 Blocks</strong>.
      </p>

      {isEdit && onDelete && (
        <button
          type="button"
          onClick={() => onDelete()}
          disabled={deleting}
          className="text-xs w-full px-3 py-2 text-red-700 hover:bg-red-50 rounded-md border border-red-200 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete template'}
        </button>
      )}
    </div>
  )
}

// ---------- Ask-about-this-template pane ----------

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  error?: string | null
}

function AskAboutTemplatePane({
  kind,
  templateId,
  templateName,
  category,
  currentBody,
  currentHeader,
  onReplaceBody,
  onAppendBody,
}: {
  kind: TemplateKind
  templateId: string | null
  templateName: string
  category: string
  currentBody: string
  currentHeader: string
  onReplaceBody: (text: string) => void
  onAppendBody: (text: string) => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoApply, setAutoApply] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Heuristic: an AI response is a "rewrite" worth auto-applying when the
  // user's prompt looks like an edit instruction (rewrite/change/fix/etc.)
  // AND the reply doesn't start with conversational filler.
  function isRewriteResponse(userPrompt: string, reply: string): boolean {
    const editVerbs = /\b(rewrite|change|fix|tighten|shorten|lengthen|make|add|remove|replace|update|reword|simplify|expand|condense|improve|edit|swap|drop)\b/i
    if (!editVerbs.test(userPrompt)) return false
    const trimmed = reply.trim()
    const conversationalStart = /^(here|sure|okay|ok|got it|i('ve| have)|that|certainly|absolutely|yes|no,)/i
    if (conversationalStart.test(trimmed)) return false
    return trimmed.length > 30  // not just a one-liner like "Done."
  }

  async function send() {
    const text = prompt.trim()
    if (!text || busy) return
    if (!currentBody.trim() && !currentHeader.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: '',
          error: 'Type something in the editor first — the AI needs a draft to work with.',
        },
      ])
      setPrompt('')
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setPrompt('')
    setBusy(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const base = kind === 'email' ? '/v1/email-templates' : '/v1/document-templates'
      const url = templateId
        ? `${API_URL}${base}/${templateId}/ask`
        : `${API_URL}${base}/ask-draft`

      const payload: Record<string, unknown> = { prompt: text, history }
      if (!templateId) {
        payload.name = templateName
        if (kind === 'email') payload.category = category
        else payload.type = category
        payload.header = currentHeader
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
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok || !body?.data?.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '',
            error: body?.data?.error ?? body?.message ?? 'AI failed.',
          },
        ])
      } else {
        const reply: string = body.data.text
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
        // Auto-apply rewrites if the toggle is on AND it looks like a rewrite.
        if (autoApply && isRewriteResponse(text, reply)) {
          onReplaceBody(reply)
        }
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
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={(e) => setAutoApply(e.target.checked)}
            className="rounded text-amber-600 focus:ring-amber-500"
          />
          <span>
            🪄 Auto-apply rewrites
            <span className="block text-[10px] text-slate-500 leading-tight">
              When ON, AI rewrites land in the editor automatically.
            </span>
          </span>
        </label>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            Ask anything about this template — &ldquo;rewrite this friendlier&rdquo;,
            &ldquo;make this shorter&rdquo;, &ldquo;add a payment link section&rdquo;. Each
            AI reply has <strong>Replace body</strong> + <strong>Append</strong> buttons so
            you can push the suggestion straight into the editor. Or flip Auto-apply on and
            rewrites land automatically.
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
              {m.error ? `✗ ${m.error}` : m.content}
            </div>
            {m.role === 'assistant' && !m.error && m.content.trim() && (
              <div className="flex gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => onReplaceBody(m.content)}
                  className="text-[10px] px-2 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                  title="Replace the editor body with this response"
                >
                  ⇤ Replace body
                </button>
                <button
                  type="button"
                  onClick={() => onAppendBody(m.content)}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                  title="Append this response to the end of the body"
                >
                  ↓ Append
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
          placeholder={
            templateId ? 'Ask about this template…' : 'Ask about this draft…'
          }
          rows={2}
          className="w-full text-xs resize-none px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
        />
      </div>
    </div>
  )
}

// ---------- Preview modal (render template against a real job) ----------

interface JobOption {
  id: string
  label: string
  work_order_number?: number | null
  customer?: string
  title?: string
}

function PreviewModal({
  kind,
  header,
  body,
  designTokens,
  onClose,
}: {
  kind: TemplateKind
  header: string
  body: string
  designTokens: DesignTokens
  onClose: () => void
}) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<JobOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState<{ header: string; body: string } | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [emptyTags, setEmptyTags] = useState<string[]>([])
  const [aliases, setAliases] = useState<Record<string, string>>({})
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [pickerJobs, setPickerJobs] = useState<JobOption[]>([])
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [sampleData, setSampleData] = useState(false)
  // Full-screen mode — expands the preview to fill the viewport so a
  // document template reads like a real full-page document.
  const [fullScreen, setFullScreen] = useState(false)

  async function fetchPreview(useJobId: string | null, useSampleData = false) {
    setLoading(true)
    setError(null)
    try {
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/templates/preview`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          header,
          body,
          job_id: useJobId,
          sample_data: useSampleData,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data?.data?.ok) {
        throw new Error(data?.message ?? 'Preview failed.')
      }
      setRendered({
        header: data.data.rendered_header ?? '',
        body: data.data.rendered_body ?? '',
      })
      setMissing(data.data.missing ?? [])
      setEmptyTags(data.data.empty ?? [])
      setAliases(data.data.aliases ?? {})
      setSuggestions(data.data.suggestions ?? {})
      setJob(data.data.job ?? null)
      setSampleData(!!data.data.sample_data)
      if (data.data.job?.id) setJobId(data.data.job.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.')
    } finally {
      setLoading(false)
    }
  }

  // Initial load — pick a random job
  useEffect(() => {
    fetchPreview(null, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchPickerJobs(q: string) {
    try {
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(
        `${API_URL}/v1/templates/preview/jobs?q=${encodeURIComponent(q)}`,
        {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
          },
        },
      )
      const data = await resp.json().catch(() => ({}))
      setPickerJobs(data?.data ?? [])
    } catch {
      setPickerJobs([])
    }
  }

  useEffect(() => {
    if (!showPicker) return
    const id = setTimeout(() => fetchPickerJobs(search), 200)
    return () => clearTimeout(id)
  }, [search, showPicker])

  async function downloadPdf() {
    if (!rendered) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      const headerText = rendered.header || 'Preview'
      const blob =
        designTokens.body_format === 'html'
          ? await renderHtmlToPdfBlob(headerText, rendered.body, designTokens)
          : await renderMarkdownToPdfBlob(headerText, rendered.body, {}, designTokens)
      downloadBlob(blob, buildPdfFilename(`preview_${rendered.header || 'template'}`))
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF render failed')
    } finally {
      setPdfBusy(false)
    }
  }

  // In HTML body mode, the rendered.body IS already raw HTML — render
  // it as-is. In markdown mode, run it through markdownToHtml.
  const previewHtml = rendered
    ? (designTokens.body_format === 'html' ? rendered.body : markdownToHtml(rendered.body))
    : ''
  const accent = designTokens.accent_color ?? '#0f172a'
  const primary = designTokens.primary_color ?? '#f59e0b'

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
  const previewCss = `
    .preview-body h1, .preview-body h2, .preview-body h3, .preview-body h4 {
      color: ${accent};
      font-weight: 700;
      margin-top: 1.2em;
      margin-bottom: 0.4em;
      line-height: 1.25;
    }
    .preview-body h1 { font-size: 1.5rem; }
    .preview-body h2 { font-size: 1.25rem; }
    .preview-body h3 { font-size: 1.1rem; }
    .preview-body p { margin: 0.5em 0; line-height: 1.55; }
    .preview-body ul, .preview-body ol { margin: 0.5em 0 0.5em 1.5em; }
    .preview-body ul { list-style: disc; }
    .preview-body ol { list-style: decimal; }
    .preview-body li { margin: 0.2em 0; }
    .preview-body strong { font-weight: 700; color: ${accent}; }
    .preview-body em { font-style: italic; }
    .preview-body code {
      background: #f1f5f9; padding: 0 0.3em; border-radius: 3px;
      font-size: 0.9em; font-family: ui-monospace, monospace;
    }
    .preview-body table {
      border-collapse: collapse; margin: 0.8em 0; width: 100%;
      font-size: 0.9em;
    }
    .preview-body th, .preview-body td {
      border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;
    }
    .preview-body th { background: #f1f5f9; font-weight: 600; }
    .preview-body blockquote {
      border-left: 3px solid ${primary}; padding-left: 10px;
      color: #475569; font-style: italic; margin: 0.6em 0;
    }
  `

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black/50 flex items-center justify-center ${fullScreen ? '' : 'p-4'}`}
      onClick={onClose}
    >
      <div
        className={`bg-white shadow-2xl flex flex-col ${
          fullScreen
            ? 'w-screen h-screen rounded-none'
            : 'w-full max-w-5xl max-h-[90vh] rounded-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-navy-900">
              👁 Preview — {kind === 'email' ? 'email template' : 'document template'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {job ? (
                <>
                  Showing how this looks with <strong>{job.label}</strong>
                  {sampleData ? ' plus sample-filled blanks.' : '.'}
                </>
              ) : loading ? (
                'Picking a job…'
              ) : sampleData ? (
                'Showing sample-filled preview data.'
              ) : (
                'No job picked yet.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchPreview(null, false)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              title="Pick a different random job"
            >
              🎲 Random job
            </button>
            <button
              type="button"
              onClick={() => fetchPreview(jobId, !sampleData)}
              disabled={loading}
              className={[
                'text-xs px-3 py-1.5 rounded-md border disabled:opacity-50',
                sampleData
                  ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
                  : 'border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              title="Fill blank preview fields with realistic sample values"
            >
              {sampleData ? 'Sample data on' : 'Sample data'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPicker((p) => !p)
                if (!showPicker) fetchPickerJobs('')
              }}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
            >
              🔎 Pick job
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfBusy || !rendered}
              className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium disabled:opacity-50"
            >
              {pdfBusy ? 'Rendering…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={() => setFullScreen((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
              title={fullScreen ? 'Exit full screen' : 'Full screen'}
            >
              {fullScreen ? '🗗 Exit full screen' : '⛶ Full screen'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-lg w-6 h-6 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {showPicker && (
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 space-y-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job # / customer / title…"
              autoFocus
              className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
            />
            <div className="max-h-40 overflow-y-auto bg-white rounded border border-slate-200 divide-y divide-slate-100">
              {pickerJobs.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-500 italic">No matches.</p>
              )}
              {pickerJobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    setShowPicker(false)
                    setSearch('')
                    fetchPreview(j.id, false)
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-xs"
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-6 py-2 text-xs text-red-800 bg-red-50 border-b border-red-200">
            {error}
          </div>
        )}
        {pdfError && (
          <div className="px-6 py-2 text-xs text-red-800 bg-red-50 border-b border-red-200">
            PDF: {pdfError}
          </div>
        )}
        {(Object.keys(aliases).length > 0 || missing.length > 0 || emptyTags.length > 0) && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-950">
            <div className="font-semibold">Merge tag check</div>
            {Object.keys(aliases).length > 0 && (
              <p className="mt-1">
                Aliases resolved:{' '}
                <span className="font-mono">
                  {Object.entries(aliases).map(([from, to]) => `${from} -> ${to}`).join(', ')}
                </span>
              </p>
            )}
            {emptyTags.length > 0 && (
              <p className="mt-1">
                Known tags with no data on this job:{' '}
                <span className="font-mono">{emptyTags.join(', ')}</span>
              </p>
            )}
            {missing.length > 0 && (
              <div className="mt-1">
                <span>Unresolved tags: </span>
                <span className="font-mono">{missing.join(', ')}</span>
                {Object.keys(suggestions).length > 0 && (
                  <p className="mt-1">
                    Suggested replacements:{' '}
                    <span className="font-mono">
                      {Object.entries(suggestions).map(([from, to]) => `${from} -> ${to}`).join(', ')}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rendered preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && !rendered && (
            <p className="text-sm text-slate-500 italic">Loading preview…</p>
          )}
          {rendered && (
            <div
              className="rounded-lg shadow-md bg-white overflow-hidden"
              style={
                {
                  borderTop: designTokens.header_banner
                    ? 'none'
                    : `4px solid ${designTokens.primary_color ?? '#f59e0b'}`,
                  fontFamily: fontToCss(designTokens.font_family),
                  ['--primary' as string]: designTokens.primary_color ?? '#f59e0b',
                  ['--accent' as string]: designTokens.accent_color ?? '#0f172a',
                } as React.CSSProperties
              }
            >
              <style>{previewCss}</style>

              {designTokens.header_banner ? (
                <div
                  className="px-8 py-6"
                  style={{
                    background: designTokens.primary_color ?? '#f59e0b',
                    color: bannerTextColor(designTokens.primary_color ?? '#f59e0b'),
                    textAlign:
                      designTokens.header_alignment === 'center' ? 'center' : 'left',
                  }}
                >
                  <h1 className="text-2xl font-bold">
                    {rendered.header || '(no header)'}
                  </h1>
                </div>
              ) : (
                <div className="px-8 pt-6">
                  <h1
                    className="text-2xl font-bold mb-1"
                    style={{
                      color: designTokens.accent_color ?? '#0f172a',
                      textAlign:
                        designTokens.header_alignment === 'center' ? 'center' : 'left',
                    }}
                  >
                    {rendered.header || '(no header)'}
                  </h1>
                  <div
                    className="h-1 mb-4 rounded-full"
                    style={{ background: designTokens.primary_color ?? '#f59e0b' }}
                  />
                </div>
              )}

              <div className="px-8 py-6">
                <div
                  className="prose prose-sm max-w-none preview-body"
                  style={{ color: '#1e293b' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml, { document: true }) }}
                />
              </div>
              <div className="px-8 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
                <span>
                  {designTokens.footer_text
                    ? designTokens.footer_text
                    : 'Preview · merge-tags filled from a real job · not sent'}
                </span>
                <span>CrewBarn</span>
              </div>
            </div>
          )}

          {missing.length > 0 && (
            <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-900">
              <strong>These tags did not render.</strong>{' '}
              <span className="font-mono">{missing.join(', ')}</span>
              <p className="text-[11px] text-red-700 mt-1">
                If this is a line-item tag, use a products block like <code>{'{{products.table}}'}</code>.
                Otherwise pick a job that has that data or replace the tag.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Visual editor (WYSIWYG contenteditable) ----------

/**
 * VisualEditor — WYSIWYG editor for HTML body templates.
 *
 * Renders the body as live HTML inside a contenteditable div, so the
 * user sees the actual rendered design (colors, columns, tables, logo)
 * and clicks straight into text to edit it. No HTML markup visible.
 *
 * Parent must remount via key prop whenever `initialBody` changes from
 * outside (starter apply, AI replace, history restore) — otherwise the
 * contenteditable's innerHTML doesn't react to React state changes.
 * Inside-typing flows via onInput → parent setBody without remounting.
 *
 * Toolbar uses document.execCommand. It's deprecated but works in every
 * current browser and is the fastest path to a usable WYSIWYG for our
 * shape of content. Move to TipTap / Slate if we ever need richer
 * inline-tool behavior.
 */
export interface VisualEditorHandle {
  insertHtml: (html: string) => void
  insertText: (text: string) => void
  focus: () => void
}

const VisualEditor = forwardRef<
  VisualEditorHandle,
  {
    initialBody: string
    onChange: (newHtml: string) => void
    designTokens: DesignTokens
  }
>(function VisualEditor({ initialBody, onChange, designTokens }, handleRef) {
  const ref = useRef<HTMLDivElement>(null)
  const primary = designTokens.primary_color ?? '#f59e0b'
  const accent = designTokens.accent_color ?? '#0f172a'

  // Seed contenteditable's innerHTML once on mount. After that, typing
  // mutates innerHTML directly — we never re-set it from React or we'd
  // wipe the user's cursor mid-keystroke.
  // Empty contentEditable divs have no block for execCommand to target,
  // so toolbar clicks (B/I/U/H1…) silently no-op until the user types
  // first. Seed an empty <p> when the body is blank so there's always a
  // caret-takeable block.
  useEffect(() => {
    if (ref.current) {
      const seed = initialBody && initialBody.trim()
        ? initialBody
        : '<p><br></p>'
      ref.current.innerHTML = seed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track the editor's last selection so click-to-insert (block /
  // merge-tag side panels) lands at the user's cursor even after the
  // button takes focus. We can't use onMouseDown={preventDefault} on
  // the buttons — that would kill the drag-and-drop init.
  const savedRangeRef = useRef<Range | null>(null)
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const el = ref.current
      if (el && el.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange()
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  /**
   * Guarantee there's a usable selection inside the editor before any
   * execCommand fires. Three-tier fallback:
   *   1. Current window selection is already inside the editor → keep it.
   *   2. We saved a range earlier (selectionchange listener) → restore it.
   *   3. Nothing saved (fresh editor, never focused) → place caret at end.
   * Tier 3 is what makes toolbar clicks work on a fresh editor.
   */
  function ensureSelectionInEditor() {
    const el = ref.current
    const sel = window.getSelection()
    if (!sel || !el) return
    if (sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      return
    }
    if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
      return
    }
    // No selection anywhere we can use — drop the caret at the end.
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  function exec(cmd: string, value?: string) {
    ref.current?.focus()
    ensureSelectionInEditor()
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand(cmd, false, value)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function insertHtml(html: string) {
    ref.current?.focus()
    ensureSelectionInEditor()
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand('insertHTML', false, html)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function insertText(text: string) {
    ref.current?.focus()
    ensureSelectionInEditor()
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand('insertText', false, text)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  // Expose insert methods to parent so the Blocks / Tags side panels
  // can fire insertions at the editor's current cursor.
  useImperativeHandle(handleRef, () => ({
    insertHtml,
    insertText,
    focus: () => ref.current?.focus(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  // ---------- Product-image variant toggle ----------
  // Swaps the {{products.table}} ↔ {{products.table_with_images}} (and
  // {{products.cards}} ↔ {{products.cards_no_image}}) merge tags in the
  // body so the designer can flip image columns on/off without knowing
  // which exact tag to type. State (`on` / `off` / `none`) is derived
  // from current innerHTML on every check so it stays right even after
  // the user types tags manually.
  function detectProductImagesState(html: string): 'on' | 'off' | 'none' {
    if (/\{\{\s*products\.table_with_images\s*\}\}/.test(html)) return 'on'
    if (/\{\{\s*products\.cards\s*\}\}/.test(html) && !/\{\{\s*products\.cards_no_image\s*\}\}/.test(html)) return 'on'
    if (/\{\{\s*products\.table\s*\}\}/.test(html)) return 'off'
    if (/\{\{\s*products\.cards_no_image\s*\}\}/.test(html)) return 'off'
    return 'none'
  }

  const [productImagesState, setProductImagesState] = useState<'on' | 'off' | 'none'>(
    () => detectProductImagesState(initialBody)
  )

  function toggleProductImages() {
    if (!ref.current) return
    const html = ref.current.innerHTML
    const state = detectProductImagesState(html)
    if (state === 'none') {
      alert('No {{products.table}} or {{products.cards}} tag in this template yet.\n\nAdd one from the right sidebar → 🏷 Tags → Line items / Products, then click this toggle to flip the image column on or off.')
      return
    }
    let next = html
    if (state === 'on') {
      next = next
        .replace(/\{\{\s*products\.table_with_images\s*\}\}/g, '{{products.table}}')
        .replace(/\{\{\s*products\.cards\s*\}\}/g, '{{products.cards_no_image}}')
      setProductImagesState('off')
    } else {
      next = next
        .replace(/\{\{\s*products\.table\s*\}\}/g, '{{products.table_with_images}}')
        .replace(/\{\{\s*products\.cards_no_image\s*\}\}/g, '{{products.cards}}')
      setProductImagesState('on')
    }
    ref.current.innerHTML = next
    onChange(next)
  }

  function handleLink() {
    const url = prompt('Link URL (e.g. https://example.com or {{invoice.pay_link}}):')
    if (url) exec('createLink', url)
  }

  // Drop target — when user drags a block / tag from the side panel,
  // we let the browser place the caret at the drop point + insert.
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    const html = e.dataTransfer.getData('text/html')
    const text = e.dataTransfer.getData('text/plain')
    if (!html && !text) return  // browser-default handling (e.g. dragging a file)
    e.preventDefault()
    // Move caret to the drop point. Document.caretPositionFromPoint /
    // caretRangeFromPoint differ across browsers — try both.
    const range = caretRangeFromPoint(e.clientX, e.clientY)
    if (range) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    if (html) insertHtml(html)
    else if (text) insertText(text)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar — formatting only; merge tags + blocks live in the
          right sidebar tabs now. */}
      <div className="px-4 py-1.5 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1 text-xs shrink-0">
        <ToolBtn onClick={() => exec('bold')} title="Bold (Ctrl+B)"><span className="font-bold">B</span></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="Italic (Ctrl+I)"><span className="italic">I</span></ToolBtn>
        <ToolBtn onClick={() => exec('underline')} title="Underline"><span className="underline">U</span></ToolBtn>
        <ToolBtn onClick={() => exec('strikeThrough')} title="Strikethrough"><span className="line-through">S</span></ToolBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolBtn onClick={() => exec('formatBlock', '<h1>')} title="Heading 1">H1</ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', '<h2>')} title="Heading 2">H2</ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', '<h3>')} title="Heading 3">H3</ToolBtn>
        <ToolBtn onClick={() => exec('formatBlock', '<p>')} title="Paragraph">¶</ToolBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Bullet list">• List</ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Numbered list">1. List</ToolBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolBtn onClick={() => exec('justifyLeft')} title="Align left">⇤</ToolBtn>
        <ToolBtn onClick={() => exec('justifyCenter')} title="Align center">↔</ToolBtn>
        <ToolBtn onClick={() => exec('justifyRight')} title="Align right">⇥</ToolBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolBtn onClick={handleLink} title="Insert link">🔗</ToolBtn>
        <ToolBtn onClick={() => exec('removeFormat')} title="Clear formatting">Clear</ToolBtn>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={toggleProductImages}
          onMouseDown={(e) => e.preventDefault()}
          title={
            productImagesState === 'none'
              ? 'Add a {{products.table}} or {{products.cards}} tag first'
              : productImagesState === 'on'
              ? 'Line-item images are showing on the customer doc. Click to hide.'
              : 'Line-item images are hidden on the customer doc. Click to show.'
          }
          disabled={productImagesState === 'none'}
          className={`px-2 py-1 rounded inline-flex items-center gap-1 text-[11px] font-medium border ${
            productImagesState === 'on'
              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : productImagesState === 'off'
              ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>{productImagesState === 'on' ? '🖼' : '🚫'}</span>
          <span>{productImagesState === 'on' ? 'Images on' : 'Images off'}</span>
        </button>
        <span className="ml-auto text-[10px] text-slate-500 italic">
          Use the right sidebar → 🧱 Blocks / 🏷 Tags to insert layout pieces + merge tags
        </span>
      </div>

      {/* Editor-only visual aids. These dashed borders make tables (and
          their cells) visible while editing — invisible-by-default
          tables are a classic WYSIWYG trap. The rules are scoped via
          the .tpl-canvas class so they ONLY affect the editor view;
          the final rendered PDF / agreement preview / sent email is
          unaffected. */}
      <style>{`
        .tpl-canvas table {
          border-collapse: collapse;
          width: 100%;
        }
        .tpl-canvas table, .tpl-canvas table tr {
          outline: 1px dashed rgba(148, 163, 184, 0.55); /* slate-400 */
          outline-offset: -1px;
        }
        .tpl-canvas table th, .tpl-canvas table td {
          outline: 1px dashed rgba(148, 163, 184, 0.55);
          outline-offset: -1px;
          padding: 6px 10px;
          min-height: 1em;
        }
        .tpl-canvas table th:empty::after,
        .tpl-canvas table td:empty::after {
          content: '\\200B';  /* zero-width space so empty cells stay clickable */
        }
      `}</style>

      {/* Editable canvas. --primary / --accent CSS vars let block HTML
          reference brand colors via var(--primary).
          Right-click opens the Style tab on the clicked element —
          shortcut for "tweak this row/cell/heading's color". */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          e.preventDefault()
          // Place caret at the clicked spot so ElementStyler picks up
          // the right element via its selectionchange listener.
          const range = caretRangeFromPoint(e.clientX, e.clientY)
          if (range) {
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
          // Tell the sidebar to switch to the Style tab.
          window.dispatchEvent(new CustomEvent('tpl:open-style-tab'))
        }}
        className="tpl-canvas flex-1 px-8 py-6 overflow-y-auto outline-none bg-white"
        style={
          {
            fontFamily: fontToCss(designTokens.font_family),
            lineHeight: 1.55,
            color: '#1e293b',
            ['--primary' as string]: primary,
            ['--accent' as string]: accent,
          } as React.CSSProperties
        }
      />
    </div>
  )
})

/**
 * Cross-browser caret-from-mouse-position helper used by the drop
 * handler so the dragged block / tag lands at the cursor point, not
 * at the end of the document.
 */
function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    return doc.caretRangeFromPoint(x, y)
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (!pos) return null
    const r = document.createRange()
    r.setStart(pos.offsetNode, pos.offset)
    r.collapse(true)
    return r
  }
  return null
}

function ToolBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      // Stop the click from stealing focus from the contenteditable
      onMouseDown={(e) => e.preventDefault()}
      className="px-1.5 py-1 rounded hover:bg-slate-100 active:bg-slate-200 text-slate-700 min-w-[26px] text-center"
    >
      {children}
    </button>
  )
}

// ---------- Live preview pane (split-view next to source editor) ----------

/**
 * Renders the body live next to the source textarea. In HTML mode it
 * drops the body straight into the DOM via dangerouslySetInnerHTML so
 * starters' `<style>` tags + class-based styling apply. In markdown
 * mode it routes through markdownToHtml.
 *
 * The wrapper sets CSS variables --primary + --accent from the
 * template's design tokens so starters that reference
 * `var(--primary)` light up with the chosen brand colors.
 */
function LivePreviewPane({
  body,
  designTokens,
}: {
  body: string
  designTokens: DesignTokens
}) {
  const isHtml = (designTokens.body_format ?? 'markdown') === 'html'
  const html = isHtml ? body : markdownToHtml(body)
  const primary = designTokens.primary_color ?? '#f59e0b'
  const accent = designTokens.accent_color ?? '#0f172a'

  return (
    <div
      className="w-1/2 overflow-y-auto bg-slate-100"
      style={
        {
          fontFamily: fontToCss(designTokens.font_family),
          // Pass the brand colors down as CSS vars so the starters'
          // `background: var(--primary)` etc. pick them up.
          ['--primary' as string]: primary,
          ['--accent' as string]: accent,
        } as React.CSSProperties
      }
    >
      <div className="m-4 bg-white rounded-md shadow-sm p-6 min-h-[calc(100%-2rem)]">
        {body.trim() === '' ? (
          <p className="text-xs text-slate-400 italic">
            Live preview — type/paste in the editor on the left and see it render here.
          </p>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html, { document: true }) }} />
        )}
      </div>
    </div>
  )
}

// ---------- Brand panel (top of Design tab) ----------

/**
 * Tenant logo + brand color uploader. The logo URL becomes
 * {{company.logo}} in every template merge-tag render so starters
 * can just drop `<img src="{{company.logo}}">` in the header.
 */
function BrandPanel() {
  // Read-only view of the tenant brand logo. Uploads / replacement /
  // removal all live on /tool-shed/brand so there's exactly one place
  // to manage brand assets — avoids the "did I upload it in the right
  // place?" confusion that two write surfaces over the same row created.
  const brand = useQuery({
    queryKey: ['tenant-brand'],
    queryFn: () =>
      apiRequest<{ data: { logo_url: string | null; brand_primary_color: string | null } }>(
        '/v1/tenant-settings/brand',
      ),
  })
  const logo = brand.data?.data?.logo_url

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-wide text-amber-900 font-semibold">
          Brand · logo
        </div>
        <span className="text-[10px] text-slate-500">
          Used as <code className="font-mono">{'{{company.logo}}'}</code>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white border border-slate-200 rounded p-2 flex items-center justify-center min-h-[60px]">
          {logo ? (
            <img
              src={logo}
              alt="Tenant logo"
              className="max-h-12 max-w-full object-contain"
            />
          ) : (
            <span className="text-[11px] text-slate-400 italic">No logo uploaded</span>
          )}
        </div>
        <Link
          to="/tool-shed/brand"
          className="text-[11px] px-3 py-1.5 rounded border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-medium whitespace-nowrap"
        >
          Manage in Tool Shed →
        </Link>
      </div>

      <p className="text-[10px] text-slate-600 leading-snug">
        Brand logo + color live in Tool Shed → Brand. Whatever you set
        there auto-flows into every template that uses{' '}
        <code className="font-mono">{'{{company.logo}}'}</code>.
      </p>
    </section>
  )
}

// ---------- Starters modal ----------

function starterKindLabel(starter: Starter): string {
  const kind = starter.kind ?? 'document'
  if (kind === 'email') return 'Email'
  if (kind === 'sms') return 'SMS'
  return 'PDF'
}

function starterPreviewSrcDoc(starter: Starter): string {
  const isHtml = (starter.design_tokens.body_format ?? 'markdown') === 'html'
  const bodyHtml = isHtml ? starter.body : markdownToHtml(starter.body)
  const font = fontToCss(starter.design_tokens.font_family)
  const primary = starter.design_tokens.primary_color ?? '#f59e0b'
  const accent = starter.design_tokens.accent_color ?? '#0f172a'

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; }
  body { font-family: ${font}; }
  .preview-shell {
    width: 760px;
    min-height: 980px;
    background: white;
    padding: 54px 62px;
    transform: scale(.255);
    transform-origin: top left;
  }
  img { max-width: 160px; max-height: 54px; object-fit: contain; }
  table { border-collapse: collapse; width: 100%; }
  th, td { vertical-align: top; }
  :root { --primary: ${primary}; --accent: ${accent}; }
</style>
</head>
<body>
  <div class="preview-shell">${bodyHtml}</div>
</body>
</html>`
}

function StarterPreviewCard({ starter, onPick }: { starter: Starter; onPick: (s: Starter) => void }) {
  const primary = starter.design_tokens.primary_color ?? '#f59e0b'
  const category = starter.category.replace(/_/g, ' ')
  const tagCount = starter.suggested_tags?.length ?? 0

  return (
    <button
      type="button"
      onClick={() => onPick(starter)}
      className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-amber-400 hover:shadow-md transition-all flex flex-col min-h-[390px]"
    >
      <div className="h-2" style={{ background: primary }} />
      <div className="h-64 bg-slate-100 border-b border-slate-200 overflow-hidden relative">
        <iframe
          title={`${starter.name} preview`}
          srcDoc={starterPreviewSrcDoc(starter)}
          sandbox=""
          className="absolute inset-0 w-full h-full pointer-events-none bg-slate-100"
        />
      </div>
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-slate-900 text-sm leading-snug">{starter.name}</div>
          <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">
            {starterKindLabel(starter)}
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{starter.blurb}</p>
        <div className="mt-auto flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{category}</span>
          {tagCount > 0 && (
            <span className="ml-auto text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              {tagCount} suggested tags
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function StartersModal({
  starters,
  allStarters,
  currentCategory,
  onClose,
  onPick,
}: {
  starters: Starter[]
  allStarters: Starter[]
  currentCategory: string
  onClose: () => void
  onPick: (s: Starter) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? allStarters : starters
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Start from a CrewBarn template</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Preview a starter, then choose which merge tags to pin before it lands in the editor.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-600">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Show all categories
            </label>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-lg w-6 h-6 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {list.length === 0 && (
            <div className="col-span-full text-sm text-slate-500 italic text-center py-12">
              No starters for &ldquo;{currentCategory}&rdquo; yet. Toggle &ldquo;Show all
              categories&rdquo; or pick + customize one from another category.
            </div>
          )}
          {list.map((s) => (
            <StarterPreviewCard key={s.id} starter={s} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  )
}
