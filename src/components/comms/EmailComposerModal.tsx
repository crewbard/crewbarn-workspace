import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  composeEmail,
  getEmailTemplate,
  listEmailTemplates,
  renderTemplateForComposer,
  type ComposeEmailResult,
} from '@/lib/comms'
import { EmojiBar } from '@/components/comms/EmojiBar'

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
  defaultEmail,
  defaultSubject,
  defaultBody,
  onSent,
}: {
  isOpen: boolean
  onClose: () => void
  customerId?: string | null
  workOrderId?: string | null
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
    setError(null)
  }

  const applyTemplate = async (id: string) => {
    if (!id) return
    setApplyingTemplate(true)
    try {
      // Render merge tags against this customer/job so the copy fills in.
      const r = await renderTemplateForComposer({
        channel: 'email',
        template_id: id,
        customer_id: customerId ?? null,
        work_order_id: workOrderId ?? null,
      })
      if (r.subject) setSubject((prev) => (prev.trim() === '' ? r.subject! : prev))
      setBody((prev) => (prev.trim() === '' ? r.body : `${prev}\n${r.body}`))
    } catch {
      // Render failed — fall back to the raw template rather than nothing.
      try {
        const t = await getEmailTemplate(id)
        if (t.subject) setSubject((prev) => (prev.trim() === '' ? t.subject : prev))
        setBody((prev) => (prev.trim() === '' ? t.body : `${prev}\n${t.body}`))
      } catch {
        /* ignore */
      }
    } finally {
      setApplyingTemplate(false)
    }
  }

  if (!isOpen) return null

  const canSend = to.trim() !== '' && body.trim() !== '' && !sendMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
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

        <div className="space-y-3 px-5 py-4">
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

          {(templatesQuery.data?.length ?? 0) > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Start from a template {applyingTemplate && <span className="text-slate-400">…</span>}
              </label>
              <select
                defaultValue=""
                onChange={(e) => applyTemplate(e.target.value)}
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
            <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Write your email…"
              className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2">
              <EmojiBar onPick={(emoji) => setBody((prev) => `${prev}${emoji}`)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
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
