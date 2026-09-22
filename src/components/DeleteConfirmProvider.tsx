import { useEffect, useRef, useState } from 'react'
import { setDeleteConfirmHandler } from '@/lib/api'

/**
 * DeleteConfirmProvider — mounts once near the app root and registers a
 * global handler with the API client. Whenever any DELETE is rejected
 * by the backend's ConfirmDelete gate (password + reason required), the
 * client calls this handler, which pops a modal asking the user to
 * re-enter their password and a reason. On submit it resolves with the
 * creds and the original request retries automatically; on cancel it
 * resolves null and the delete is abandoned.
 *
 * One modal serves every delete button in the app — no per-call wiring.
 */
export function DeleteConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The promise resolver for the in-flight prompt.
  const resolverRef = useRef<
    ((v: { password: string; reason: string } | null) => void) | null
  >(null)

  useEffect(() => {
    setDeleteConfirmHandler((request) => {
      setPassword('')
      setReason('')
      setError(request.code === 'reason_required' ? 'A reason is required.' : null)
      setOpen(true)
      return new Promise((resolve) => {
        resolverRef.current = resolve
      })
    })
    return () => setDeleteConfirmHandler(null)
  }, [])

  function finish(value: { password: string; reason: string } | null) {
    setOpen(false)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(value)
  }

  function submit() {
    if (!password) {
      setError('Enter your password.')
      return
    }
    if (reason.trim().length < 3) {
      setError('Enter a reason (3+ characters).')
      return
    }
    finish({ password, reason: reason.trim() })
  }

  // Esc cancels.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => finish(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl"
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <span className="text-red-600 text-lg">🗑️</span>
              <h2 className="text-base font-semibold text-slate-900">
                Confirm deletion
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                Deleting is permanent-ish (recoverable by an admin) and is
                logged. Re-enter your password and give a reason to continue.
              </p>
              {/*
                Off-screen username target. Without a username field paired to
                the password, the browser's password autofill dumps the email
                into the nearest text input on the PAGE (e.g. a search box),
                silently filtering whatever list is behind the modal. Giving
                the modal its own username field keeps autofill contained here.
              */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                tabIndex={-1}
                aria-hidden="true"
                className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
                defaultValue=""
              />
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Your password
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                  placeholder="••••••••"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                  placeholder="e.g. Duplicate record / created in error"
                />
              </label>
              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {error}
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => finish(null)}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
