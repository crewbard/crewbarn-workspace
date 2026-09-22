import { useMemo } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { TemplateEditor } from '@/components/customDocuments/TemplateEditor'

/**
 * Full-page route wrapper for the template editor. Replaces the
 * old modal-overlay flow with a real URL per template so the
 * editor gets the browser back button, deep linking, and a
 * proper title bar.
 *
 *   /custom-documents/email/:id           edit existing email tpl
 *   /custom-documents/email/new           new email tpl
 *   /custom-documents/document/:id        edit existing doc tpl
 *   /custom-documents/document/new        new doc tpl
 *
 * SMS templates still use the legacy modal — they're simple enough
 * that the modal works fine. /custom-documents/sms/* redirects to
 * the list with the sms tab active.
 */

const EMAIL_CATEGORIES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'job', label: 'Job' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'general', label: 'General' },
]

const DOC_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'work_order', label: 'Work Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'general', label: 'General' },
]

type Tab = 'email' | 'document' | 'sms'

export default function TemplateEditorPage() {
  const { tab, id } = useParams<{ tab: string; id: string }>()
  const navigate = useNavigate()

  // Derive these before any hook so the redirect guards can live BELOW
  // all hooks (calling hooks after an early return throws React #310).
  // For an invalid tab kindTab falls back to 'document' but we redirect
  // before rendering anything, so the value is never used.
  const kindTab = (tab === 'email' ? 'email' : 'document') as Exclude<Tab, 'sms'>
  const isNew = id === 'new'
  const templateId = isNew ? null : (id ?? null)

  // AI-Generate flow stashes the draft in sessionStorage before
  // navigating here. Pull it out exactly once and clear so a refresh
  // doesn't keep restoring the old AI-suggested body.
  const initialDraft = useMemo(() => {
    if (!isNew) return undefined
    const raw = sessionStorage.getItem('tpl-draft')
    if (!raw) return undefined
    try {
      const parsed = JSON.parse(raw) as { kind: string; draft: unknown }
      sessionStorage.removeItem('tpl-draft')
      if (parsed.kind !== kindTab) return undefined
      return parsed.draft as Parameters<typeof TemplateEditor>[0]['initialDraft']
    } catch {
      sessionStorage.removeItem('tpl-draft')
      return undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect guards — AFTER all hooks so hook order is stable.
  if (!tab || (tab !== 'email' && tab !== 'document' && tab !== 'sms')) {
    return <Navigate to="/custom-documents" replace />
  }
  if (tab === 'sms') {
    // SMS still uses the legacy modal flow.
    return <Navigate to="/custom-documents?tab=sms" replace />
  }

  const config = kindTab === 'email'
    ? {
        kind: 'email' as const,
        categories: EMAIL_CATEGORIES,
        invalidateKey: ['email-templates'],
      }
    : {
        kind: 'document' as const,
        categories: DOC_TYPES,
        invalidateKey: ['document-templates'],
      }

  function backToLibrary() {
    navigate(`/custom-documents?tab=${kindTab}`)
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-slate-50">
      {/* Slim breadcrumb header. The big editor toolbar lives inside
          TemplateEditor itself. */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-3 text-xs text-slate-500 shrink-0">
        <button
          type="button"
          onClick={backToLibrary}
          className="text-amber-700 hover:underline font-medium"
        >
          ← Custom documents
        </button>
        <span className="text-slate-300">/</span>
        <span>{kindTab === 'email' ? 'Email templates' : 'Document templates'}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">
          {isNew ? `New ${kindTab} template` : 'Edit template'}
        </span>
      </div>

      {/* Editor fills the remaining viewport. */}
      <div className="flex-1 overflow-hidden">
        <TemplateEditor
          kind={config.kind}
          templateId={templateId}
          initialDraft={initialDraft}
          categories={config.categories}
          invalidateKey={config.invalidateKey}
          onClose={backToLibrary}
          variant="fullPage"
          autoSaveOnUnmount
        />
      </div>
    </div>
  )
}
