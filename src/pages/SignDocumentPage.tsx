import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL } from '@/lib/api'
import { markdownToHtml } from '@/lib/extractedDocumentPdf'

interface PreviewResp {
  data: {
    role: string
    signer_label: string | null
    doc_title: string
    doc_text: string
    expires_at: string | null
  }
}

/**
 * Public signing page — /sign/:token.
 *
 * Unauth. Shows the document content, highlights the slot this signer
 * is responsible for, lets them draw a signature on a canvas, submits.
 * Backend records the captured PNG data URL + IP + timestamp.
 *
 * The editor's PDF render picks up the signature and composites it into
 * the placeholder slot on the next render.
 */
export function SignDocumentPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [preview, setPreview] = useState<PreviewResp['data'] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Load preview once.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`${API_URL}/v1/sign/${token}`, {
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
    return () => { cancelled = true }
  }, [token])

  // Canvas drawing — inline, no deps.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.2

    let drawing = false
    let last: { x: number; y: number } | null = null

    function pos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect()
      const point = 'touches' in e ? e.touches[0] : e
      return {
        x: ((point.clientX - rect.left) / rect.width) * canvas!.width,
        y: ((point.clientY - rect.top) / rect.height) * canvas!.height,
      }
    }

    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      drawing = true
      last = pos(e)
      setHasDrawn(true)
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing || !last) return
      e.preventDefault()
      const next = pos(e)
      ctx!.beginPath()
      ctx!.moveTo(last.x, last.y)
      ctx!.lineTo(next.x, next.y)
      ctx!.stroke()
      last = next
    }
    function end(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      drawing = false
      last = null
    }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [preview])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function submit() {
    if (!canvasRef.current || !hasDrawn) {
      setSubmitError('Please draw your signature first.')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const resp = await fetch(`${API_URL}/v1/sign/${token}`, {
        method: 'POST',
        body: JSON.stringify({ signature_data_url: dataUrl }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setSubmitError(body?.message ?? 'Submission failed.')
        return
      }
      setSuccess(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDecline() {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const resp = await fetch(`${API_URL}/v1/sign/${token}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: declineReason.trim() || null }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setSubmitError(body?.message ?? 'Decline failed.')
        return
      }
      setDeclined(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Decline failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">⚠</div>
          <h1 className="text-xl font-semibold text-navy-900">Signing link not usable</h1>
          <p className="text-sm text-slate-600 mt-2">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!preview) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-sm text-slate-500">Loading…</div>
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">✓</div>
          <h1 className="text-xl font-semibold text-navy-900">Signature captured</h1>
          <p className="text-sm text-slate-600 mt-2">Thank you. You can close this page.</p>
        </div>
      </div>
    )
  }

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">✗</div>
          <h1 className="text-xl font-semibold text-navy-900">Decline recorded</h1>
          <p className="text-sm text-slate-600 mt-2">
            We&apos;ve let the sender know. You can close this page.
          </p>
        </div>
      </div>
    )
  }

  // Highlight the signer's slot in the preview by wrapping its token
  // before passing to the markdown renderer.
  const slotToken = `[[signature:${preview.role}]]`
  const highlightedText = preview.doc_text.replaceAll(
    slotToken,
    `**↓ YOUR SIGNATURE GOES HERE (${preview.role}) ↓**`,
  )

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-semibold text-navy-900">{preview.doc_title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              You&apos;ve been asked to sign as <strong>{preview.signer_label ?? preview.role}</strong>.
            </p>
          </div>
          <div className="text-lg font-bold text-amber-600">
            Crew<span className="text-navy-800">Barn</span>
          </div>
        </div>

        <div
          className="px-6 py-5 prose prose-sm max-w-none border-b border-slate-200"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(highlightedText) }}
        />

        <div className="px-6 py-5">
          <h2 className="text-sm font-semibold text-navy-900 mb-2">Your signature</h2>
          <div className="border-2 border-slate-300 rounded bg-white">
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              className="w-full h-44 touch-none cursor-crosshair"
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={clearCanvas}
              className="text-amber-700 hover:underline"
            >
              Clear and redraw
            </button>
            <span>Use mouse, finger, or stylus.</span>
          </div>

          {submitError && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!hasDrawn || submitting}
            className="mt-4 w-full text-sm px-4 py-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Sign and submit'}
          </button>

          <button
            type="button"
            onClick={() => setShowDecline(true)}
            disabled={submitting}
            className="mt-2 w-full text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Decline to sign
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-3">
            By signing you indicate intent to authorize the actions described in this document.
            Internal sign-off only; not a legally-binding e-signature.
          </p>
        </div>
      </div>

      {showDecline && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-navy-900">Decline to sign</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-700">
                The sender will be notified. You can include a reason (optional).
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={3}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                disabled={submitting}
                className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDecline}
                disabled={submitting}
                className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Confirm decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
