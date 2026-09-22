import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { apiRequest } from '@/lib/api'

/**
 * Mandatory-2FA gate. When the signed-in account is OBLIGED to have 2FA
 * (privileged role owner/admin/office/dispatcher, or the tenant set its
 * policy to "required") but hasn't enrolled a factor yet, we block the app
 * with a one-time setup screen — a code to their CrewBarn email by default,
 * SMS as an option — until it's confirmed. Everyone else passes straight
 * through.
 *
 * Fail-open: any error fetching status lets the app load (never brick a
 * login on a status blip); the login gate still enforces at sign-in.
 */

interface TfaStatus {
  enrolled: boolean
  mandated: boolean
  default_method: 'totp' | 'email' | 'sms'
  allowed_methods: ('totp' | 'sms' | 'email')[]
  authenticator_only: boolean
  email_masked: string | null
  phone_masked: string | null
}

export function TwoFactorGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TfaStatus | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    apiRequest<{ data: TfaStatus }>('/v1/two-factor/status')
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setChecked(true))
  }, [])

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-navy-500 text-sm">Loading…</div>
      </div>
    )
  }

  if (status?.mandated && !status.enrolled) {
    return <EnrollNow status={status} onDone={() => setStatus({ ...status, enrolled: true })} />
  }

  return <>{children}</>
}

function EnrollNow({ status, onDone }: { status: TfaStatus; onDone: () => void }) {
  // Platform staff (and any authenticator-only account) get the app-setup wall
  // — no email/text escape hatch. Everyone else picks an allowed channel.
  if (status.authenticator_only || (status.allowed_methods.length === 1 && status.allowed_methods[0] === 'totp')) {
    return <AuthenticatorEnrollWall onDone={onDone} />
  }
  return <ChannelEnrollWall status={status} onDone={onDone} />
}

/**
 * Forced authenticator (TOTP) enrollment — the first and only screen for a
 * platform staff account until it's set up. QR renders locally; no skip.
 */
function AuthenticatorEnrollWall({ onDone }: { onDone: () => void }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  // Mint the secret once, on mount.
  useEffect(() => {
    apiRequest<{ data: { secret: string; otpauth_uri: string } }>('/v1/two-factor/enroll', { method: 'POST' })
      .then((r) => { setSecret(r.data.secret); setOtpauthUri(r.data.otpauth_uri) })
      .catch((e) => setError((e as { payload?: { message?: string } })?.payload?.message ?? 'Could not start setup.'))
  }, [])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await apiRequest<{ data: { recovery_codes: string[] } }>(
        '/v1/two-factor/confirm',
        { method: 'POST', body: { code: code.trim() } },
      )
      setRecoveryCodes(r.data.recovery_codes)
    } catch (e) {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? 'That code is invalid or expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-navy-900">Set up your authenticator</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your account requires an authenticator app before you can continue. Scan the code, then
            enter the 6-digit number to finish.
          </p>
        </div>

        {recoveryCodes ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-emerald-900">You&apos;re set. Save your recovery codes.</div>
            <p className="text-xs text-emerald-800 mt-1">Each works once if you lose your phone — shown only now.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <div key={c} className="rounded bg-white border border-emerald-200 px-2 py-1 text-center">{c}</div>
              ))}
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
              className="mt-3 text-xs font-medium text-emerald-800 hover:underline"
            >
              Copy all
            </button>
            <button
              onClick={onDone}
              className="mt-3 ml-4 text-xs font-semibold text-emerald-900 hover:underline"
            >
              I&apos;ve saved them — continue
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              {otpauthUri ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <QRCodeSVG value={otpauthUri} size={168} />
                </div>
              ) : (
                <div className="h-[192px] w-[192px] animate-pulse rounded-lg bg-slate-100" />
              )}
            </div>
            {secret && (
              <p className="text-center text-xs text-slate-500">
                Can&apos;t scan? Key:{' '}
                <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{secret}</code>
              </p>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-full text-center text-lg tracking-widest border border-slate-300 rounded-lg px-3 py-2.5"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={busy || code.trim().length < 6 || !secret}
              onClick={confirm}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Confirm & continue'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ChannelEnrollWall({ status, onDone }: { status: TfaStatus; onDone: () => void }) {
  const allowsEmail = status.allowed_methods.includes('email')
  const allowsSms = status.allowed_methods.includes('sms')
  const hasPhone = !!status.phone_masked && allowsSms
  const [channel, setChannel] = useState<'email' | 'sms'>(
    (status.default_method === 'sms' && hasPhone) || !allowsEmail ? 'sms' : 'email',
  )
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The destination is NOT chosen here — the server sends only to the
  // email/phone already on file. We just pick which on-file channel.
  const sendCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest('/v1/two-factor/channel/enroll', {
        method: 'POST',
        body: { channel },
      })
      setSent(true)
    } catch (e) {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? 'Could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest('/v1/two-factor/channel/confirm', {
        method: 'POST',
        body: { channel, code: code.trim() },
      })
      onDone()
    } catch (e) {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? 'That code is invalid or expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-navy-900">Secure your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your role requires two-factor sign-in. We'll send a code to the contact info on your
            account — takes a minute, one time only.
          </p>
        </div>

        {!sent ? (
          <>
            <div className="space-y-2">
              {allowsEmail && (
                <button
                  type="button"
                  onClick={() => setChannel('email')}
                  className={`w-full text-left text-sm font-medium rounded-lg border px-3 py-2.5 ${
                    channel === 'email'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-300 text-slate-600'
                  }`}
                >
                  📧 Email a code to <span className="font-mono">{status.email_masked ?? 'your email'}</span>
                </button>
              )}
              {allowsSms && (
                hasPhone ? (
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`w-full text-left text-sm font-medium rounded-lg border px-3 py-2.5 ${
                      channel === 'sms'
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    📱 Text a code to <span className="font-mono">{status.phone_masked}</span>
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 px-1">
                    No mobile number on file — add one in your profile to use text codes.
                  </p>
                )
              )}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={sendCode}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send my code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Enter the 6-digit code we sent to your {channel === 'email' ? 'email' : 'phone'}.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="w-full text-center text-lg tracking-widest border border-slate-300 rounded-lg px-3 py-2.5"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={busy || code.trim().length < 6}
              onClick={confirm}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Confirm & continue'}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setCode(''); setError(null) }}
              className="w-full text-xs text-slate-500 hover:underline"
            >
              Use a different method
            </button>
          </>
        )}
      </div>
    </div>
  )
}
