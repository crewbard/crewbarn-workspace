import { useEffect, useRef, useState } from 'react'
import { setSmsConsentHandler, type SmsConsentRequest } from '@/lib/api'

/**
 * SmsConsentProvider — mounts once near the app root. A text to somebody
 * who hasn't agreed to texts (and hasn't texted the company first) is
 * refused by the server with needs_sms_consent; apiRequest hands that here.
 * The person sending says whether the customer agreed. Yes: the text is
 * sent again with consent_confirmed and the agreement is saved on the
 * customer's record with who confirmed it. No: nothing is sent.
 *
 * Every text box in the app gets this without its own wiring.
 */
export function SmsConsentProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<SmsConsentRequest | null>(null)
  const resolverRef = useRef<((agreed: boolean) => void) | null>(null)

  useEffect(() => {
    setSmsConsentHandler((req) => {
      setRequest(req)
      // apiRequest asks these one at a time; if one ever arrives on top of
      // another, the earlier is answered "don't send" rather than left waiting.
      resolverRef.current?.(false)
      return new Promise((resolve) => {
        resolverRef.current = resolve
      })
    })
    return () => {
      setSmsConsentHandler(null)
      // Unmounted with the question open: don't send, so its request finishes.
      resolverRef.current?.(false)
      resolverRef.current = null
    }
  }, [])

  function finish(agreed: boolean) {
    setRequest(null)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(agreed)
  }

  useEffect(() => {
    if (!request) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  const who = request?.name || 'this person'

  return (
    <>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => finish(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sms-consent-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl"
          >
            <div className="px-5 py-3 border-b border-slate-200">
              <h2 id="sms-consent-title" className="text-base font-semibold text-slate-900">
                Has {who} agreed to get texts?
              </h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-slate-600">
              <p>{request.message}</p>
              <p className="text-xs text-slate-500">
                Only say yes if they agreed: by phone, in person or in writing. The agreement is saved on their
                record with your name and today's date. Phone carriers can block texts sent without one.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => finish(false)}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Don't send
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => finish(true)}
                className="px-3 py-1.5 text-sm font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700"
              >
                They agreed, send it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
