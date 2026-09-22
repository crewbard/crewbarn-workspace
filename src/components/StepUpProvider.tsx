import { useEffect, useRef, useState } from 'react'
import { apiRequest, setStepUpHandler, type StepUpRequest } from '@/lib/api'

/**
 * StepUpProvider — mounts once near the app root and registers the global
 * step-up handler (CREWBARN-MANAGEMENT-SYSTEM-PLAN.md §6). When a platform
 * user acts inside a tenant without a live grant, apiRequest gets a 403
 * step_up_required and calls this handler, which pops a modal: send an
 * SMS/email code, enter it, and on success a ~30-min grant opens and the
 * original request retries automatically. Cancel abandons the access.
 *
 * One modal serves every tenant-scoped call — no per-page wiring.
 */
type Channels = { sms: boolean; email: boolean }
type StatusResp = {
  data: {
    exempt: boolean
    step_up_required: boolean
    channels: Channels
  }
}

export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [channels, setChannels] = useState<Channels>({ sms: false, email: false })
  const [channel, setChannel] = useState<'sms' | 'email'>('email')
  const [stage, setStage] = useState<'choose' | 'enter'>('choose')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  useEffect(() => {
    setStepUpHandler((req: StepUpRequest) => {
      setTenantId(req.tenantId)
      setChannels({ sms: false, email: false })
      setChannel('email')
      setStage('choose')
      setSentTo(null)
      setCode('')
      setError(null)
      setBusy(false)
      setOpen(true)
      // Discover which channels can deliver for this account.
      apiRequest<StatusResp>(`/v1/admin/tenant-access/${req.tenantId}/status`)
        .then((r) => {
          const ch = r.data.channels
          setChannels(ch)
          setChannel(ch.sms && !ch.email ? 'sms' : 'email')
        })
        .catch(() => {
          // Status failed — default to email; challenge will surface any error.
          setChannels({ sms: true, email: true })
        })
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve
      })
    })
    return () => setStepUpHandler(null)
  }, [])

  function finish(value: boolean) {
    setOpen(false)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(value)
  }

  async function sendCode() {
    setBusy(true)
    setError(null)
    try {
      const r = await apiRequest<{ data: { to_masked: string | null } }>(
        `/v1/admin/tenant-access/${tenantId}/challenge`,
        { method: 'POST', body: { channel } },
      )
      setSentTo(r.data.to_masked)
      setStage('enter')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (code.trim().length < 4) {
      setError('Enter the code from your phone or email.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiRequest(`/v1/admin/tenant-access/${tenantId}/verify`, {
        method: 'POST',
        body: { code: code.trim(), channel },
      })
      finish(true) // grant is live — the original request retries
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code is invalid or expired.')
      setBusy(false)
    }
  }

  // Esc cancels.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const noChannels = !channels.sms && !channels.email

  return (
    <>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/60 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => finish(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl"
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <span className="text-amber-600 text-lg">🔐</span>
              <h2 className="text-base font-semibold text-slate-900">Verify to open this tenant</h2>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                Opening a customer tenant requires a one-time code. This entry is
                logged and the unlock lasts about 30 minutes.
              </p>

              {stage === 'choose' && (
                <>
                  {noChannels ? (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-2">
                      No verification channel is set up for your account. Add a 2FA
                      phone or ensure platform email is configured.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      {channels.email && (
                        <button
                          type="button"
                          onClick={() => setChannel('email')}
                          className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                            channel === 'email'
                              ? 'border-amber-500 bg-amber-50 text-amber-800 font-semibold'
                              : 'border-slate-300 text-slate-700'
                          }`}
                        >
                          ✉️ Email
                        </button>
                      )}
                      {channels.sms && (
                        <button
                          type="button"
                          onClick={() => setChannel('sms')}
                          className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                            channel === 'sms'
                              ? 'border-amber-500 bg-amber-50 text-amber-800 font-semibold'
                              : 'border-slate-300 text-slate-700'
                          }`}
                        >
                          📱 Text
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {stage === 'enter' && (
                <>
                  <p className="text-xs text-slate-500">
                    Code sent{sentTo ? ` to ${sentTo}` : ''}. Enter it below.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && verify()}
                    placeholder="123456"
                    className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={busy}
                    className="text-xs text-amber-700 hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </>
              )}

              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {error}
                </p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => finish(false)}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              {stage === 'choose' ? (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy || noChannels}
                  className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={verify}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Unlock tenant'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
