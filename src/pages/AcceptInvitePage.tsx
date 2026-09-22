import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

interface PreviewResp {
  data: {
    email: string
    first_name: string | null
    last_name: string | null
    tenant_name: string | null
    expires_at: string | null
  }
}

/**
 * /accept-invite/:token
 *
 * Public landing page the invited staff member visits via the email link.
 * Shows their shop + email, lets them set a password, then activates the
 * account. They can immediately log in afterward.
 *
 * No auth required — the raw token (in the URL) IS the auth for this flow.
 */
export function AcceptInvitePage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const preview = useQuery({
    queryKey: ['accept-invite', token],
    queryFn: () => apiRequest<PreviewResp>(`/v1/auth/accept-invite/${token}`),
    retry: false,
  })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const accept = useMutation({
    mutationFn: () =>
      apiRequest('/v1/auth/accept-invite', {
        method: 'POST',
        body: { token, password },
      }),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  function submit() {
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    accept.mutate()
  }

  if (preview.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">Loading invite…</p>
      </div>
    )
  }

  if (preview.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">⚠</div>
          <h1 className="text-xl font-semibold text-navy-900">Invite link no longer works</h1>
          <p className="text-sm text-slate-600 mt-2">
            This invite is invalid, expired, or already used. Ask the shop owner to send a fresh one.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  const d = preview.data!.data

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="text-center mb-5">
          <div className="text-lg font-bold text-navy-800">
            Crew<span className="text-amber-500">Barn</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-navy-900 text-center">Welcome to {d.tenant_name ?? 'CrewBarn'}</h1>
        <p className="text-sm text-slate-600 text-center mt-1">
          Hi {d.first_name ?? 'there'} — set a password to activate{' '}
          <code className="text-xs">{d.email}</code>.
        </p>

        {success ? (
          <div className="mt-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 text-center text-sm">
            ✓ Password set. Redirecting to login…
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={accept.isPending}
              className="w-full text-sm px-4 py-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {accept.isPending ? 'Setting password…' : 'Set password & activate'}
            </button>
          </div>
        )}

        {d.expires_at && !success && (
          <p className="text-[11px] text-slate-400 text-center mt-4">
            Link expires {new Date(d.expires_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
