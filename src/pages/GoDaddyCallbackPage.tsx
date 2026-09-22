import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

/**
 * /oauth/godaddy — where Poynt sends the owner's browser back after they
 * click "Authorize Access". Same shape as the QuickBooks landing: the SPA
 * still holds the tenant session, so the code goes to the authed API and
 * the businessId is written inside normal tenant context.
 */
export function GoDaddyCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = params.get('code')
    const context = params.get('context')
    const status = params.get('status')
    if (!code || !context) {
      setError('GoDaddy didn\'t send back an authorization code. Start the connection again from Tool Shed → Payments.')
      return
    }

    apiRequest('/v1/payments/godaddy/connect', { method: 'POST', body: { code, context, status } })
      .then(() => navigate('/tool-shed/payments?godaddy=connected', { replace: true }))
      .catch((e: Error) => setError(e.message))
  }, [params, navigate])

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      {error ? (
        <>
          <h1 className="text-lg font-semibold text-slate-900">Couldn't connect GoDaddy Payments</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/tool-shed/payments', { replace: true })}
            className="mt-6 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Payments
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-500">Finishing the GoDaddy Payments connection…</p>
      )}
    </main>
  )
}
