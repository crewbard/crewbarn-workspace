import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  composeSms,
  getSmsTemplateBody,
  listSmsTemplates,
  renderTemplateForComposer,
  type ComposeSmsResult,
  type ComposerUsedJob,
} from '@/lib/comms'
import { EmojiBar } from '@/components/comms/EmojiBar'
import { TemplateFillPanel, fillTag, findBlankTags, hasBlankTags } from '@/components/comms/TemplateFillPanel'

/**
 * SmsComposerModal starts a customer SMS thread. Existing threads still reply
 * through ConversationThread; this is only for the first outbound text.
 */
export function SmsComposerModal({
  isOpen,
  onClose,
  customerId,
  workOrderId,
  estimateId,
  invoiceId,
  locationId,
  contractId,
  defaultPhone,
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
  defaultPhone?: string | null
  defaultBody?: string | null
  onSent?: (conversationId: string) => void
}) {
  const [to, setTo] = useState(defaultPhone ?? '')
  const [body, setBody] = useState(defaultBody ?? '')
  const [error, setError] = useState<string | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [templateId, setTemplateId] = useState('')
  // The job the template was filled in from, shown under the picker.
  const [usedJob, setUsedJob] = useState<ComposerUsedJob | null>(null)
  // What the template last put in the box, so picking another job swaps it
  // rather than adding a second copy.
  const [lastInserted, setLastInserted] = useState<string | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['sms-templates', 'composer'],
    queryFn: listSmsTemplates,
    enabled: isOpen,
    staleTime: 60_000,
  })

  const sendMutation = useMutation({
    mutationFn: (): Promise<ComposeSmsResult> =>
      composeSms({
        toPhone: to.trim(),
        customerId: customerId ?? null,
        workOrderId: workOrderId ?? null,
        body,
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
    setTo(defaultPhone ?? '')
    setBody(defaultBody ?? '')
    setTemplateId('')
    setUsedJob(null)
    setLastInserted(null)
    setError(null)
  }

  const insertTemplateText = (text: string) => {
    setBody((prev) => {
      if (lastInserted && prev.includes(lastInserted)) return prev.replace(lastInserted, text)
      return prev.trim() === '' ? text : `${prev}\n${text}`
    })
    setLastInserted(text)
  }

  // `jobId` re-fills the same template from a job picked under "change".
  const applyTemplate = async (id: string, jobId?: string) => {
    setTemplateId(id)
    if (!id) {
      setUsedJob(null)
      setLastInserted(null)
      return
    }
    setApplyingTemplate(true)
    try {
      // Fill the tags in from everything this page knows.
      const r = await renderTemplateForComposer({
        channel: 'sms',
        template_id: id,
        customer_id: customerId ?? null,
        work_order_id: jobId ?? workOrderId ?? null,
        estimate_id: estimateId ?? null,
        invoice_id: invoiceId ?? null,
        location_id: locationId ?? null,
        contract_id: contractId ?? null,
      })
      setUsedJob(r.used_job)
      insertTemplateText(r.body)
    } catch {
      try {
        const templateBody = await getSmsTemplateBody(id)
        setUsedJob(null)
        insertTemplateText(templateBody)
      } catch {
        /* ignore */
      }
    } finally {
      setApplyingTemplate(false)
    }
  }

  if (!isOpen) return null

  // Anything a template couldn't fill stays as {{tag}} until it's typed in.
  const blanks = findBlankTags(body)
  const hasBlanks = hasBlankTags(body)
  const fillBlank = (tag: string, value: string) => {
    setBody((b) => fillTag(b, tag, value))
    setLastInserted((t) => (t === null ? t : fillTag(t, tag, value)))
  }

  const canSend = to.trim() !== '' && body.trim() !== '' && !hasBlanks && !sendMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-navy-900">New text</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
            <input
              type="tel"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="(555) 555-5555"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {(templatesQuery.data?.length ?? 0) > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Start from a template {applyingTemplate && <span className="text-slate-400">...</span>}
              </label>
              <select
                value={templateId}
                onChange={(e) => void applyTemplate(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">No template</option>
                {templatesQuery.data!.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
            <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your text..."
              className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <EmojiBar onPick={(emoji) => setBody((prev) => `${prev}${emoji}`)} />
              <div className="text-right text-[11px] text-slate-400">{body.length}/1000</div>
            </div>
          </div>
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
            className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sendMutation.isPending ? 'Sending...' : 'Send text'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SmsComposerModal
