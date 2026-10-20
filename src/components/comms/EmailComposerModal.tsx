import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  composeEmail,
  getEmailTemplate,
  listEmailTemplates,
  renderTemplateForComposer,
  type ComposeEmailResult,
  type ComposerUsedJob,
} from '@/lib/comms'
import { EmojiBar } from '@/components/comms/EmojiBar'
import { TemplateFillPanel, fillTag, findBlankTags, hasBlankTags } from '@/components/comms/TemplateFillPanel'

/**
 * EmailComposerModal — start a new email thread with a customer. Used by the
 * customer-account and work-order Messages tabs. On success it hands the new
 * conversation id back so the caller can open the thread.
 */
export function EmailComposerModal({
  isOpen,
  onClose,
  customerId,
  workOrderId,
  estimateId,
  invoiceId,
  locationId,
  contractId,
  topic,
  defaultEmail,
  defaultSubject,
  defaultBody,
  onSent,
}: {
  isOpen: boolean
  onClose: () => void
  customerId?: string | null
  workOrderId?: string | null
  /** Fill template tags from this estimate (and the job it came from). */
  estimateId?: string | null
  /** Fill template tags from this invoice (and its job). */
  invoiceId?: string | null
  /** The service location the page is about, for address tags. */
  locationId?: string | null
  /** Fill template tags from this service agreement. */
  contractId?: string | null
  /** What the email is about, so only templates that fit are offered first. */
  topic?: 'estimate' | 'job' | 'invoice' | null
  defaultEmail?: string | null
  defaultSubject?: string | null
  defaultBody?: string | null
  onSent?: (conversationId: string) => void
}) {
  const [to, setTo] = useState(defaultEmail ?? '')
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [body, setBody] = useState(defaultBody ?? '')
  const [error, setError] = useState<string | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  // A designed template is shown as it will look, not as code. The message
  // box above it becomes an optional note that goes on top.
  const [templateHtml, setTemplateHtml] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [allTemplates, setAllTemplates] = useState(false)
  // The job the template was filled in from, shown under the picker.
  const [usedJob, setUsedJob] = useState<ComposerUsedJob | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['email-templates', 'composer'],
    queryFn: listEmailTemplates,
    enabled: isOpen,
    staleTime: 60_000,
  })

  const sendMutation = useMutation({
    mutationFn: (): Promise<ComposeEmailResult> =>
      composeEmail({
        toEmail: to.trim(),
        customerId: customerId ?? null,
        workOrderId: workOrderId ?? null,
        subject: subject.trim(),
        body,
        html: templateHtml,
      }),
    onSuccess: (res) => {
      if (!res.sent) {
        setError(res.error ?? 'Send failed.')
        return
      }
      const convId = res.conversation?.id
      reset()
      onClose()
      if (convId) onSent?.(convId)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Send failed.'),
  })

  const reset = () => {
    setTo(defaultEmail ?? '')
    setSubject(defaultSubject ?? '')
    setBody(defaultBody ?? '')
    setTemplateHtml(null)
    setTemplateId('')
    setUsedJob(null)
    setError(null)
  }

  const looksLikeHtml = (text: string) => /<\/?(div|p|table|h[1-6]|span|a|br|img|strong|em|ul|ol|li|td|tr)\b[^>]*>/i.test(text)

  // Picking a template replaces what's there; it never piles onto it.
  // `jobId` re-fills the same template from a job picked under "change".
  const applyTemplate = async (id: string, jobId?: string) => {
    setTemplateId(id)
    if (!id) {
      setTemplateHtml(null)
      setUsedJob(null)
      setSubject(defaultSubject ?? '')
      setBody(defaultBody ?? '')
      return
    }
    setApplyingTemplate(true)
    try {
      let rendered: { subject?: string; body: string; used_job?: ComposerUsedJob | null }
      try {
        // Fill the tags in from everything this page knows.
        rendered = await renderTemplateForComposer({
          channel: 'email',
          template_id: id,
          customer_id: customerId ?? null,
          work_order_id: jobId ?? workOrderId ?? null,
          estimate_id: estimateId ?? null,
          invoice_id: invoiceId ?? null,
          location_id: locationId ?? null,
          contract_id: contractId ?? null,
        })
      } catch {
        const t = await getEmailTemplate(id)
        rendered = { subject: t.subject, body: t.body, used_job: null }
      }
      setUsedJob(rendered.used_job ?? null)
      if (rendered.subject) setSubject(rendered.subject)
      if (looksLikeHtml(rendered.body)) {
        // Designed email: show it as it will arrive; keep the message box for
        // an optional note on top (what was there stays as that note).
        setTemplateHtml(rendered.body)
      } else {
        setTemplateHtml(null)
        setBody(rendered.body)
      }
    } catch {
      setError('That template could not be opened.')
    } finally {
      setApplyingTemplate(false)
    }
  }

  if (!isOpen) return null

  // Only the templates that fit what this email is about, unless asked.
  const FITS: Record<string, string[]> = {
    estimate: ['estimate', 'general', 'marketing'],
    job: ['job', 'appointment', 'warranty', 'invoice', 'general'],
    invoice: ['invoice', 'general'],
  }
  const fit = topic ? FITS[topic] : null
  const templates = templatesQuery.data ?? []
  const fitting = fit ? templates.filter((t) => fit.includes(t.category || 'general')) : templates
  const hiddenCount = templates.length - fitting.length
  const shown = allTemplates || !fit ? templates : fitting

  // Anything a template couldn't fill stays as {{tag}} until it's typed in.
  const blanks = findBlankTags(subject, body, templateHtml)
  const hasBlanks = hasBlankTags(subject, body, templateHtml)
  const fillBlank = (tag: string, value: string) => {
    setSubject((s) => fillTag(s, tag, value))
    setBody((b) => fillTag(b, tag, value))
    setTemplateHtml((h) => (h === null ? h : fillTag(h, tag, value, true)))
  }

  const canSend = to.trim() !== '' && (body.trim() !== '' || !!templateHtml) && !hasBlanks && !sendMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-navy-900">New email</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {templates.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Start from a template {applyingTemplate && <span className="text-slate-400">…</span>}
              </label>
              <select
                value={templateId}
                onChange={(e) => void applyTemplate(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">No template</option>
                {shown.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {fit && hiddenCount > 0 && (
                <button type="button" onClick={() => setAllTemplates((v) => !v)} className="mt-1 text-[11px] font-semibold text-slate-500 underline hover:text-slate-800">
                  {allTemplates ? `Only ${topic} templates` : `Show all templates (${hiddenCount} more)`}
                </button>
              )}
            </div>
          )}

          <TemplateFillPanel
            usedJob={templateId ? usedJob : null}
            customerId={customerId}
            onPickJob={(jobId) => void applyTemplate(templateId, jobId)}
            blanks={blanks}
            onFill={fillBlank}
            busy={applyingTemplate}
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {templateHtml ? 'Note on top (optional)' : 'Message'}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={templateHtml ? 3 : 12}
              placeholder={templateHtml ? 'Add a line above the template, or leave it empty…' : 'Write your email…'}
              className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2">
              <EmojiBar onPick={(emoji) => setBody((prev) => `${prev}${emoji}`)} />
            </div>
          </div>

          {templateHtml && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">What they'll see</span>
                <button type="button" onClick={() => void applyTemplate('')} className="text-xs font-semibold text-slate-500 underline hover:text-slate-800">
                  Remove template
                </button>
              </div>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:12px;background:#f8fafc">${templateHtml}</body></html>`}
                className="block h-80 w-full rounded-md border border-slate-200 bg-white"
              />
              <p className="mt-1 text-[11px] text-slate-500">Your signature goes under it when it's sent.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {hasBlanks && <span className="mr-auto text-xs font-medium text-amber-700">Fill in the blanks first</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              sendMutation.mutate()
            }}
            disabled={!canSend}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sendMutation.isPending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmailComposerModal
