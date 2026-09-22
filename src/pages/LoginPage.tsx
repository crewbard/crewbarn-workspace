import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthIntroFirstLight } from '@/pages/AuthIntro'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { checkLoginApproval } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  two_factor_code: z.string().optional(),
  trust_device: z.boolean().optional(),
})

type LoginFormValues = z.infer<typeof loginSchema>

/**
 * DevelopmentBanner — renders a thin amber banner at the top of the login page
 * when VITE_ENV_LABEL is set. Returns null when the env var is empty/unset so
 * local dev stays clean. To remove the banner in production, clear the env var
 * in Cloudflare Pages settings and redeploy.
 */
function DevelopmentBanner() {
  const label = import.meta.env.VITE_ENV_LABEL
  if (!label) return null
  return (
    <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs font-medium px-4 py-2 text-center">
      🚧 {label}
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading, login } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  // True once the backend says this account needs a 2FA code — flips the form
  // to show the authenticator-code field.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  // Push-to-approve: waiting on the phone. Holds the approval id + creds to
  // re-submit once approved; a link drops to the code fallback.
  const [pushWait, setPushWait] = useState<{
    approvalId: string
    email: string
    password: string
    trust: boolean
  } | null>(null)

  /**
   * Pick the URL to return the user to after login. Priority order:
   *   1. `?next=…` query param — set by the global 401 interceptor
   *      when the API kicks them out mid-session.
   *   2. `location.state.from` — set by RequireAuth when a guarded
   *      route bumped them here on initial load.
   *   3. `/` — fallback.
   */
  function getReturnTo(): string {
    const params = new URLSearchParams(location.search)
    const next = params.get('next')
    if (next && next.startsWith('/')) return next
    const fromState = (location.state as { from?: { pathname: string; search?: string } } | null)?.from
    if (fromState?.pathname) {
      return fromState.pathname + (fromState.search ?? '')
    }
    return '/'
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(getReturnTo(), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null)
    try {
      const res = await login(
        values.email,
        values.password,
        'Web Dashboard - Chrome',
        values.two_factor_code?.trim() || undefined,
        values.trust_device,
      )
      if (res.twoFactorRequired) {
        if (res.method === 'push' && res.loginApprovalId) {
          // A prompt went to the phone — wait for the approval, code is the
          // fallback link below.
          setPushWait({
            approvalId: res.loginApprovalId,
            email: values.email,
            password: values.password,
            trust: !!values.trust_device,
          })
          setSubmitError(null)
          return
        }
        // Code path: reveal the field and let them submit again with it filled.
        setNeedsTwoFactor(true)
        setSubmitError(null)
        return
      }
      navigate(getReturnTo(), { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && needsTwoFactor) {
          setSubmitError('That code is invalid or expired — try the current one.')
        } else if (err.status === 401) {
          setSubmitError('Invalid email or password.')
        } else if (err.status === 429) {
          setSubmitError('Too many login attempts. Please try again in a moment.')
        } else if (err.status >= 500) {
          setSubmitError('Server error. Please try again.')
        } else {
          setSubmitError(err.message)
        }
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setSubmitError('Could not reach the server. Check your connection.')
      } else {
        setSubmitError('Something went wrong. Please try again.')
      }
    }
  }

  // Poll for the phone's approval while the push-wait screen is up. On
  // approve → re-submit login with the approval id → session. On deny/expire
  // → drop to the code fallback.
  useEffect(() => {
    if (!pushWait) return
    let cancelled = false
    const started = Date.now()
    const timer = window.setInterval(async () => {
      if (cancelled) return
      // Give up after ~2 min and fall back to the code.
      if (Date.now() - started > 125_000) {
        window.clearInterval(timer)
        if (!cancelled) {
          setPushWait(null)
          setNeedsTwoFactor(true)
          setSubmitError('The request expired. Enter a code instead.')
        }
        return
      }
      try {
        const status = await checkLoginApproval(pushWait.email, pushWait.approvalId)
        if (status === 'approved') {
          window.clearInterval(timer)
          const res = await login(
            pushWait.email,
            pushWait.password,
            'Web Dashboard - Chrome',
            undefined,
            pushWait.trust,
            pushWait.approvalId,
          )
          if (!cancelled && !res.twoFactorRequired) {
            navigate(getReturnTo(), { replace: true })
          }
        } else if (status === 'denied' || status === 'expired') {
          window.clearInterval(timer)
          if (!cancelled) {
            setPushWait(null)
            setNeedsTwoFactor(true)
            setSubmitError(
              status === 'denied'
                ? 'That sign-in was denied on your phone.'
                : 'The request expired. Enter a code instead.',
            )
          }
        }
      } catch {
        // transient — keep polling
      }
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushWait])

  if (isLoading) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left pane: form (with optional dev banner above) */}
      <div className="flex-1 flex flex-col">
        <DevelopmentBanner />
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-navy-800">
                Crew<span className="text-amber-500">Barn</span>
              </h1>
              <p className="text-navy-500 mt-2 text-sm">
                Sign in to your account to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="********"
                error={errors.password?.message}
                {...register('password')}
              />

              {needsTwoFactor && (
                <>
                  <Input
                    label="Authenticator code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="6-digit code (or a recovery code)"
                    error={errors.two_factor_code?.message}
                    {...register('two_factor_code')}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
                    <input type="checkbox" className="rounded border-slate-300" {...register('trust_device')} />
                    Trust this device for 30 days — skip the code next time
                  </label>
                </>
              )}

              {pushWait && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-amber-800">
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm font-semibold">Check your phone</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    We sent an approval request to the CrewBarn app. Tap <strong>Approve</strong> to
                    finish signing in.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPushWait(null)
                      setNeedsTwoFactor(true)
                      setSubmitError(null)
                    }}
                    className="text-xs font-medium text-amber-800 underline"
                  >
                    Enter a code instead
                  </button>
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-danger"
                >
                  {submitError}
                </div>
              )}

              {!pushWait && (
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting
                    ? 'Signing in...'
                    : needsTwoFactor
                      ? 'Verify code'
                      : 'Sign in'}
                </Button>
              )}
            </form>

            <div className="mt-6 text-center text-sm text-navy-500">
              <Link to="/forgot-password" className="hover:text-navy-800 hover:underline">
                Forgot password?
              </Link>
            </div>

            <p className="text-center text-xs text-navy-400 mt-12">
              By signing in you agree to the terms of service.
            </p>
          </div>
        </div>
      </div>

      {/* Right pane: "first light" — the sun comes up behind the barn. Desktop
          only; the three perpetually-animating gradient blobs it replaces ran
          for as long as the page was open. */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden" aria-hidden="true">
        <AuthIntroFirstLight />
      </div>
    </div>
  )
}
