import { useEffect, useRef, useState } from 'react'
import { setCompletionRequirementsHandler, type CompletionRequirementsRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * CompletionRequirementsProvider — mounts once near the app root. When a
 * job can't be completed yet (its customer account, job type or company
 * asks for proof it doesn't have), the API client hands the refusal here:
 * this lists what's missing. Someone with "Complete a job without its
 * required proof" can give a reason and complete it anyway; the reason is
 * saved on the job and noted in its history. Everyone else closes it and
 * finishes the job first.
 *
 * One dialog serves every status control in the app — no per-call wiring.
 */
export function CompletionRequirementsProvider({ children }: { children: React.ReactNode }) {
  const { has } = usePermissions()
  const canOverride = has('jobs.override_requirements')
  const canOverrideRef = useRef(canOverride)
  canOverrideRef.current = canOverride

  const [request, setRequest] = useState<CompletionRequirementsRequest | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const resolverRef = useRef<((v: string | null) => void) | null>(null)

  useEffect(() => {
    setCompletionRequirementsHandler((req) => {
      setReason('')
      setError(null)
      setRequest(req)
      // apiRequest asks these one at a time; if one ever arrives on top of
      // another, the earlier is cancelled rather than left waiting forever.
      resolverRef.current?.(null)
      return new Promise((resolve) => {
        resolverRef.current = resolve
      })
    })
    return () => {
      setCompletionRequirementsHandler(null)
      // Unmounted with the dialog open: cancel it so its request finishes.
      resolverRef.current?.(null)
      resolverRef.current = null
    }
  }, [])

  function finish(value: string | null) {
    setRequest(null)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(value)
  }

  function completeAnyway() {
    if (reason.trim().length < 5) {
      setError('Say why it can’t be done (5+ characters). It’s saved on the job.')
      return
    }
    finish(reason.trim())
  }

  useEffect(() => {
    if (!request) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  return (
    <>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => finish(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-requirements-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl"
          >
            <div className="px-5 py-3 border-b border-slate-200">
              <h2 id="completion-requirements-title" className="text-base font-semibold text-slate-900">
                Finish these first
              </h2>
            </div>
            <div className="p-5 space-y-3">
              {request.violations.length > 0 ? (
                <ul className="space-y-1.5">
                  {request.violations.map((v) => (
                    <li key={v.code} className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span aria-hidden="true">•</span>
                      <span>{v.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-700">{request.message}</p>
              )}
              <p className="text-xs text-slate-500">
                The job's customer account, job type or company asks for these before it can be completed.
              </p>
              {canOverride && (
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    Can’t be done? Complete anyway, with a reason
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="e.g. Store closed at night, nobody on site to sign"
                  />
                </label>
              )}
              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => finish(null)}
                className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
              >
                {canOverride ? 'Cancel' : 'OK'}
              </button>
              {canOverride && (
                <button
                  type="button"
                  onClick={completeAnyway}
                  className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md"
                >
                  Complete anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
