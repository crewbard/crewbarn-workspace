import { useState } from 'react'
import type { TesterSentiment, TesterStep } from '@/types/tester'

/**
 * Modal shown when a tester clicks "Done — add notes" on the walkthrough
 * widget. Captures free-text feedback + a sentiment radio choice, then
 * advances them to the next step.
 */
export function TesterNoteModal({
  step,
  isLast,
  submitting,
  onSubmit,
  onCancel,
}: {
  step: TesterStep
  isLast: boolean
  submitting: boolean
  onSubmit: (input: { body?: string; sentiment?: TesterSentiment }) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [sentiment, setSentiment] = useState<TesterSentiment | ''>('')

  function handleSubmit() {
    onSubmit({
      body: body.trim() || undefined,
      sentiment: sentiment || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Step {step.index + 1} feedback{step.category ? ` · ${step.category}` : ''}
          </div>
          <div className="text-base font-semibold text-slate-900 mt-0.5">
            {step.title}
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
              How did it go?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['worked', 'confusing', 'broke'] as TesterSentiment[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSentiment(s)}
                  className={`text-sm px-3 py-2 rounded border font-medium transition-colors ${
                    sentiment === s
                      ? s === 'worked'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : s === 'confusing'
                          ? 'bg-amber-50 border-amber-400 text-amber-800'
                          : 'bg-red-50 border-red-400 text-red-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s === 'worked' ? '✓ Worked great' : s === 'confusing' ? '🤔 Confusing' : '🛑 Broke'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
              Notes (optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Anything weird, confusing, broken, or great? Even one line helps."
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
              autoFocus
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
          >
            {submitting ? 'Saving…' : isLast ? 'Submit & finish' : 'Submit & next test'}
          </button>
        </div>
      </div>
    </div>
  )
}
