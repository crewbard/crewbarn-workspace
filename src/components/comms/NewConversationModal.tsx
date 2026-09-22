import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  composeEmail,
  composeSms,
  type ComposeEmailResult,
  type ComposeSmsResult,
} from '@/lib/comms'
import { EmojiBar } from '@/components/comms/EmojiBar'

type ComposeMode = 'sms' | 'email'

export function NewConversationModal({
  isOpen,
  onClose,
  onSent,
}: {
  isOpen: boolean
  onClose: () => void
  onSent?: (conversationId: string) => void
}) {
  const [mode, setMode] = useState<ComposeMode>('sms')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sendSmsMutation = useMutation({
    mutationFn: (): Promise<ComposeSmsResult> =>
      composeSms({
        toPhone: to.trim(),
        customerId: null,
        workOrderId: null,
        body,
      }),
    onSuccess: handleSent,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Send failed.'),
  })

  const sendEmailMutation = useMutation({
    mutationFn: (): Promise<ComposeEmailResult> =>
      composeEmail({
        toEmail: to.trim(),
        customerId: null,
        workOrderId: null,
        subject: subject.trim(),
        body,
      }),
    onSuccess: handleSent,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Send failed.'),
  })

  function handleSent(res: ComposeSmsResult | ComposeEmailResult) {
    if (!res.sent) {
      setError(res.error ?? 'Send failed.')
      return
    }
    const conversationId = res.conversation?.id
    reset()
    onClose()
    if (conversationId) onSent?.(conversationId)
  }

  const reset = () => {
    setTo('')
    setSubject('')
    setBody('')
    setError(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  const isSending = sendSmsMutation.isPending || sendEmailMutation.isPending
  const canSend = to.trim() !== '' && body.trim() !== '' && !isSending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={close}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-navy-900">New message</h2>
            <p className="text-xs text-slate-500">Send to any phone number or email. Unknown contacts can be linked later.</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('sms')
                setError(null)
              }}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'sms' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('email')
                setError(null)
              }}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'email' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Email
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {mode === 'email' ? 'To email' : 'To phone'}
            </label>
            <input
              type={mode === 'email' ? 'email' : 'tel'}
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder={mode === 'email' ? 'customer@example.com' : '(555) 555-5555'}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {mode === 'email' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={mode === 'email' ? 8 : 5}
              placeholder={mode === 'email' ? 'Write your email...' : 'Write your text...'}
              className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <EmojiBar onPick={(emoji) => setBody((prev) => `${prev}${emoji}`)} />
              {mode === 'sms' && <div className="text-right text-[11px] text-slate-400">{body.length}/1000</div>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              if (mode === 'email') {
                sendEmailMutation.mutate()
              } else {
                sendSmsMutation.mutate()
              }
            }}
            disabled={!canSend}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSending ? 'Sending...' : mode === 'email' ? 'Send email' : 'Send text'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewConversationModal
