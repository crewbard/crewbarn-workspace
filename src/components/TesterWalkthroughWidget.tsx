import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAdvanceTester,
  useBackTesterStep,
  useRestartTester,
  useSkipTesterStep,
  useTesterProgress,
} from '@/hooks/useTester'
import { TesterNoteModal } from './TesterNoteModal'
import type { TesterSentiment } from '@/types/tester'

/**
 * Floating walkthrough widget shown only to accounts with role='tester'.
 *
 * Bottom-right card showing the current step + buttons to skip or
 * complete-with-note. On "Done" we open TesterNoteModal which captures
 * feedback then calls /tester/progress/advance.
 *
 * When all steps are done, shows a thank-you panel with a "Restart"
 * button (so testers can re-run the flow if asked).
 */
export function TesterWalkthroughWidget() {
  const { account } = useAuth()
  const isTester = account?.role === 'tester'

  const { data, isLoading } = useTesterProgress(isTester)
  const advance = useAdvanceTester()
  const skip = useSkipTesterStep()
  const back = useBackTesterStep()
  const restart = useRestartTester()

  const [collapsed, setCollapsed] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  if (!isTester || isLoading || !data) return null

  const progress = data.data
  const step = progress.step
  const isComplete = !!progress.completed_at && !step
  const isLastStep = step ? step.index === progress.total_steps - 1 : false

  function handleAdvance(input: { body?: string; sentiment?: TesterSentiment }) {
    advance.mutate(input, {
      onSuccess: () => setNoteModalOpen(false),
    })
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-40 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-full shadow-lg no-print"
      >
        Tests {Math.min(progress.current_step + (isComplete ? 0 : 1), progress.total_steps)}/{progress.total_steps}
      </button>
    )
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 w-80 bg-white border border-amber-300 rounded-xl shadow-xl no-print">
        <div className="px-4 py-2.5 border-b border-amber-100 bg-amber-50 rounded-t-xl flex items-center justify-between">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            {isComplete
              ? '✓ All tests complete'
              : `Test ${progress.current_step + 1} of ${progress.total_steps}`}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="text-xs text-amber-700 hover:text-amber-900 font-medium"
            title="Minimize"
          >
            —
          </button>
        </div>

        {isComplete ? (
          <div className="px-4 py-4">
            <div className="text-sm font-medium text-slate-900">Thank you!</div>
            <p className="text-xs text-slate-600 mt-1">
              You finished the walkthrough. Patrick gets pinged on every note
              you left. Want to run it again?
            </p>
            <button
              type="button"
              onClick={() => restart.mutate()}
              disabled={restart.isPending}
              className="mt-3 text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
            >
              {restart.isPending ? 'Restarting…' : 'Restart walkthrough'}
            </button>
          </div>
        ) : step ? (
          <div className="px-4 py-3">
            {step.category && (
              <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                {step.category}
              </div>
            )}
            <div className="text-sm font-semibold text-slate-900">{step.title}</div>
            <p className="text-xs text-slate-600 mt-1">{step.detail}</p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {progress.current_step > 0 && (
                  <button
                    type="button"
                    onClick={() => back.mutate()}
                    disabled={back.isPending || skip.isPending || advance.isPending}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                    title="Go back to the previous test"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => skip.mutate()}
                  disabled={skip.isPending || advance.isPending || back.isPending}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Skip
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                disabled={skip.isPending || advance.isPending || back.isPending}
                className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
              >
                Done — add notes
              </button>
            </div>

            <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${(progress.current_step / progress.total_steps) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {noteModalOpen && step && (
        <TesterNoteModal
          step={step}
          isLast={isLastStep}
          submitting={advance.isPending}
          onSubmit={handleAdvance}
          onCancel={() => setNoteModalOpen(false)}
        />
      )}
    </>
  )
}
