import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL } from '@/lib/api'
import { SafeHtml } from '@/components/SafeHtml'
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad'

/**
 * Public service-agreement signing page. No auth — the token in the URL
 * is the credential. Customer reviews the body, signs, types name +
 * optional role; we record IP + UA server-side for audit.
 */

interface AgreementPreview {
  id: string
  title: string
  body_html: string
  status: string
  expires_at: string | null
  is_expired: boolean
  customer_signed_at: string | null
  fully_signed_at: string | null
  declined_at: string | null
  voided_at: string | null
  company: {
    name: string
    phone: string | null
    email: string | null
    logo_url: string | null
    primary_color: string | null
  }
  job_title: string | null
}

export default function SignAgreementPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [preview, setPreview] = useState<AgreementPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerRole, setSignerRole] = useState('')
  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const padRef = useRef<SignaturePadHandle>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`${API_URL}/v1/sign/agreements/${token}`, {
          headers: { Accept: 'application/json' },
        })
        const body = await resp.json().catch(() => ({}))
        if (cancelled) return
        if (!resp.ok) {
          setLoadError(body?.message ?? 'Invalid link.')
          return
        }
        setPreview(body.data)
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Failed to load.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function submitSign() {
    setSubmitError(null)
    if (!padRef.current || padRef.current.isEmpty()) {
      setSubmitError('Please sign in the box above.')
      return
    }
    if (!signerName.trim()) {
      setSubmitError('Please type your printed name.')
      return
    }
    setSubmitting(true)
    try {
      const sig = padRef.current.toDataUrl()
      const resp = await fetch(`${API_URL}/v1/sign/agreements/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          signature: sig,
          signer_name: signerName.trim(),
          signer_role: signerRole.trim() || null,
        }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setSubmitError(body?.message ?? 'Could not record signature.')
        return
      }
      // Refresh preview so the success state renders
      const fresh = await fetch(`${API_URL}/v1/sign/agreements/${token}`, {
        headers: { Accept: 'application/json' },
      })
      const freshBody = await fresh.json().catch(() => ({}))
      setPreview(freshBody.data)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDecline() {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const resp = await fetch(`${API_URL}/v1/sign/agreements/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ reason: declineReason.trim() || null }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setSubmitError(body?.message ?? 'Could not record decline.')
        return
      }
      const fresh = await fetch(`${API_URL}/v1/sign/agreements/${token}`, {
        headers: { Accept: 'application/json' },
      })
      const freshBody = await fresh.json().catch(() => ({}))
      setPreview(freshBody.data)
      setShowDecline(false)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return <CenterCard>{loadError}</CenterCard>
  }
  if (!preview) {
    return <CenterCard>Loading…</CenterCard>
  }

  // Status-based content
  if (preview.is_expired || preview.status === 'expired') {
    return (
      <CenterCard>
        <h1 className="text-xl font-bold text-navy-900 mb-2">This link has expired</h1>
        <p className="text-sm text-slate-600">
          The agreement is no longer available for signing. Contact{' '}
          {preview.company.name} for a new link.
        </p>
      </CenterCard>
    )
  }
  if (preview.status === 'declined') {
    return (
      <CenterCard>
        <h1 className="text-xl font-bold text-navy-900 mb-2">Agreement declined</h1>
        <p className="text-sm text-slate-600">
          You declined this agreement on{' '}
          {preview.declined_at && new Date(preview.declined_at).toLocaleDateString()}.
        </p>
      </CenterCard>
    )
  }
  if (preview.status === 'void') {
    return (
      <CenterCard>
        <h1 className="text-xl font-bold text-navy-900 mb-2">Agreement was withdrawn</h1>
        <p className="text-sm text-slate-600">
          {preview.company.name} withdrew this agreement. Contact them with any questions.
        </p>
      </CenterCard>
    )
  }
  if (preview.status === 'customer_signed' || preview.status === 'fully_signed') {
    return (
      <CenterCard>
        <h1 className="text-xl font-bold text-navy-900 mb-2">
          {preview.status === 'fully_signed'
            ? 'Agreement signed by both parties'
            : 'Signature received'}
        </h1>
        <p className="text-sm text-slate-600">
          Thanks for signing the {preview.title}.{' '}
          {preview.status === 'customer_signed' &&
            `${preview.company.name} will counter-sign shortly. You can close this page.`}
        </p>
      </CenterCard>
    )
  }

  // status === 'sent' — render the sign UI
  const primary = preview.company.primary_color || '#f59e0b'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          {preview.company.logo_url && (
            <img
              src={preview.company.logo_url}
              alt={preview.company.name}
              className="h-8 max-w-[140px] object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy-900 truncate">
              {preview.company.name}
            </div>
            {(preview.company.phone || preview.company.email) && (
              <div className="text-[11px] text-slate-500 truncate">
                {[preview.company.phone, preview.company.email].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        {/* Title + body */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-navy-900 mb-1">{preview.title}</h1>
          {preview.job_title && (
            <p className="text-sm text-slate-500 mb-4">For: {preview.job_title}</p>
          )}
          {/* Public, unauthenticated page — sanitize the agreement body. */}
          <SafeHtml className="prose prose-sm max-w-none" html={preview.body_html} />
        </section>

        {/* Signature pad */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-navy-900 mb-1">Your signature</h2>
          <p className="text-xs text-slate-500 mb-4">
            By signing below, you agree to the terms above. We'll record your name,
            timestamp, and IP address for our records.
          </p>
          <SignaturePad ref={padRef} height={160} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Printed name <span className="text-rose-600">*</span>
              </span>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                maxLength={200}
                className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Title / role (optional)
              </span>
              <input
                type="text"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                maxLength={100}
                placeholder="e.g. Property Manager, Owner"
                className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
          </div>

          {submitError && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mt-3">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              className="text-xs text-rose-700 hover:underline"
            >
              Decline this agreement
            </button>
            <button
              type="button"
              onClick={submitSign}
              disabled={submitting}
              style={{ background: primary }}
              className="text-sm px-5 py-2.5 rounded text-white font-semibold disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Sign agreement'}
            </button>
          </div>
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          Powered by CrewBarn
        </p>
      </main>

      {showDecline && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowDecline(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-navy-900 mb-1">
              Decline agreement
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {preview.company.name} will be notified. You can add an optional reason.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Optional — why are you declining?"
              className="w-full text-sm rounded border border-slate-300 px-3 py-2"
            />
            {submitError && (
              <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mt-2">
                {submitError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDecline}
                disabled={submitting}
                className="text-sm px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
              >
                {submitting ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-w-md w-full p-6 text-center">
        {children}
      </div>
    </div>
  )
}
