import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/lib/api'
import { resetPassword } from '@/lib/auth'

/**
 * Complete a staff password reset from the emailed link
 * (/reset-password/:token?email=…). Posts token + email + new password to
 * /v1/auth/reset-password.
 */
export function ResetPasswordPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const linkValid = token !== '' && email !== ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword({ email, token, password, password_confirmation: confirm })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError('This reset link is invalid or expired — request a new one.')
      } else if (err instanceof ApiError && err.status === 429) {
        setError('Too many attempts. Please try again shortly.')
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Could not reach the server. Check your connection.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      {done ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-navy-800">Password reset</h2>
          <p className="text-sm text-navy-600">
            Your password has been updated. Redirecting you to sign in…
          </p>
          <Link
            to="/login"
            className="inline-block text-sm font-medium text-amber-700 hover:underline"
          >
            Go to sign in →
          </Link>
        </div>
      ) : !linkValid ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-navy-800">Invalid reset link</h2>
          <p className="text-sm text-navy-600">
            This link is missing information or has been altered. Request a fresh one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block text-sm font-medium text-amber-700 hover:underline"
          >
            Request a new link →
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-navy-800">Set a new password</h2>
            <p className="text-sm text-navy-500 mt-1">
              For <span className="font-medium">{email}</span>
            </p>
          </div>

          <Input
            label="New password"
            type="password"
            autoFocus
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <div
              role="alert"
              className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Set new password
          </Button>

          <div className="text-center text-sm text-navy-500">
            <Link to="/login" className="hover:text-navy-800 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}

/** Centered, branded wrapper (matches ForgotPasswordPage). */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-navy-800">
            Crew<span className="text-amber-500">Barn</span>
          </h1>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
