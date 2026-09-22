import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/lib/api'
import { forgotPassword } from '@/lib/auth'

/**
 * Request a staff password-reset link. Posts to /v1/auth/forgot-password,
 * which always returns 200 (no account enumeration) — so we show the same
 * "check your email" confirmation regardless of whether the address exists.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many requests. Please try again in a few minutes.')
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Could not reach the server. Check your connection.')
      } else {
        // Don't leak existence on unexpected errors — treat as sent.
        setSent(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-navy-800">Check your email</h2>
          <p className="text-sm text-navy-600">
            If an account exists for <span className="font-medium">{email}</span>, we've
            sent a link to reset your password. It expires in 60 minutes.
          </p>
          <p className="text-xs text-navy-400">
            Didn't get it? Check spam, or try again in a couple of minutes.
          </p>
          <Link
            to="/login"
            className="inline-block text-sm font-medium text-amber-700 hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-navy-800">Forgot your password?</h2>
            <p className="text-sm text-navy-500 mt-1">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          <Input
            label="Email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            Send reset link
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

/** Centered, branded wrapper shared by the forgot/reset pages. */
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
