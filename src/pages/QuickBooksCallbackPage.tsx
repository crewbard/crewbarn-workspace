import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { finishQuickBooksConnect } from '@/lib/quickbooks'

/**
 * Landing page for Intuit's OAuth redirect (registered redirect URI =
 * /oauth/quickbooks). Intuit sends us back here with ?code, ?state, and
 * ?realmId while the tenant is still logged into the SPA. We hand those to
 * the authenticated API to finish the connection, then bounce to Import.
 *
 * On denial Intuit sends ?error=access_denied instead.
 */
export function QuickBooksCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false) // StrictMode mounts twice; only finish once.

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const denied = params.get('error')
    if (denied) {
      setError('QuickBooks connection was cancelled.')
      return
    }

    const code = params.get('code')
    const state = params.get('state')
    const realmId = params.get('realmId')
    if (!code || !state || !realmId) {
      setError('QuickBooks did not return the expected information. Please try connecting again.')
      return
    }

    finishQuickBooksConnect({ code, realm_id: realmId, state })
      .then(() => navigate('/tool-shed/import?qbo=connected', { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [params, navigate])

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      {!error ? (
        <>
          <div className="text-3xl mb-3 animate-pulse">🔗</div>
          <h1 className="text-lg font-semibold text-slate-900">Connecting QuickBooks…</h1>
          <p className="text-sm text-slate-500 mt-1">Finishing the secure handshake with Intuit.</p>
        </>
      ) : (
        <>
          <div className="text-3xl mb-3">⚠️</div>
          <h1 className="text-lg font-semibold text-slate-900">Couldn't connect QuickBooks</h1>
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mt-3">
            {error}
          </p>
          <button
            onClick={() => navigate('/tool-shed/import', { replace: true })}
            className="mt-4 text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium"
          >
            Back to Import
          </button>
        </>
      )}
    </div>
  )
}
