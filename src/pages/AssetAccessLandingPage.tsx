import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QrScanButton } from '@/components/QrScanButton'
import { Button } from '@/components/ui/Button'
import { getPublicScan } from '@/lib/publicScan'
import type { PublicScanNode } from '@/types/publicScan'

const SAAS_LOGIN_URL = 'https://app.crewbarn.com/login'

function parseScanUrl(value: string): { tenantId: string; code: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const direct = trimmed.match(/^([a-zA-Z0-9_-]+)[\s:/|,]+([a-zA-Z0-9_-]+)$/)
  if (direct) return { tenantId: direct[1], code: direct[2] }

  // A bare code with no tenant used to be unusable here. The server resolves
  // the tenant from the code itself now, so someone reading a number off a
  // sticker can type just that.
  if (/^[a-zA-Z0-9_-]{3,}$/.test(trimmed)) return { tenantId: '', code: trimmed }

  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    const scanIndex = parts.findIndex((part) => part === 'scan')
    if (scanIndex >= 0 && parts[scanIndex + 1] && parts[scanIndex + 2]) {
      return {
        tenantId: decodeURIComponent(parts[scanIndex + 1]),
        code: decodeURIComponent(parts[scanIndex + 2]),
      }
    }
  } catch {
    return null
  }

  return null
}

function scanPath(p: { tenantId: string; code: string }): string {
  return p.tenantId
    ? `/scan/${encodeURIComponent(p.tenantId)}/${encodeURIComponent(p.code)}`
    : `/scan/${encodeURIComponent(p.code)}`
}

export function AssetAccessLandingPage() {
  const navigate = useNavigate()
  const [scanInput, setScanInput] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const parsed = useMemo(() => parseScanUrl(scanInput), [scanInput])
  const canContinue = !!parsed && accessCode.trim().length > 0

  // Arriving with a code in the URL — a redirect, or a short link — should
  // preload the field so the preview below appears without any typing.
  const [params] = useSearchParams()
  useEffect(() => {
    const seed = params.get('scan') ?? params.get('code') ?? params.get('next')
    if (seed && !scanInput) setScanInput(seed)
    // Seeding once on arrival; retyping is the user's business after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  /*
   * Show what was scanned BEFORE asking for anything.
   *
   * A login form that appears after scanning a sticker on a wall is
   * indistinguishable from a phishing page — the one thing that separates them
   * is proving the tag resolved to a real record first. This also answers the
   * inspector's actual question (is it in date) without an account at all,
   * which is often the whole visit.
   */
  const [preview, setPreview] = useState<PublicScanNode | null>(null)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'missing'>('idle')

  useEffect(() => {
    if (!parsed) {
      setPreview(null)
      setPreviewState('idle')
      return
    }
    let cancelled = false
    setPreviewState('loading')
    const t = setTimeout(() => {
      getPublicScan(parsed.code, parsed.tenantId || undefined)
        .then((node) => {
          if (cancelled) return
          setPreview(node)
          setPreviewState('idle')
        })
        .catch(() => {
          if (cancelled) return
          setPreview(null)
          setPreviewState('missing')
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [parsed?.tenantId, parsed?.code])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!parsed) {
      setError('Paste the QR scan link, or enter TENANT-ID / ASSET-CODE.')
      return
    }
    if (!accessCode.trim()) {
      setError('Enter the security key the asset owner gave you.')
      return
    }
    setError(null)
    navigate(`${scanPath(parsed)}?access_code=${encodeURIComponent(accessCode.trim())}`)
  }

  const openScannedQr = (value: string) => {
    const parsedScan = parseScanUrl(value)
    if (!parsedScan) {
      setScanError('That QR code was not a CrewBarn asset scan link.')
      return
    }
    setScanError(null)
    navigate(scanPath(parsedScan))
  }

  const fillSecurityScan = (value: string) => {
    setScanInput(value)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="text-xl font-black tracking-tight">
            Crew<span className="text-amber-500">Barn</span>
          </div>
          <a className="text-sm font-semibold text-amber-700 hover:text-amber-800" href={SAAS_LOGIN_URL}>
            Staff sign in
          </a>
        </div>
      </header>

      {(previewState === 'loading' || preview || previewState === 'missing') && (
        <div className="mx-auto max-w-5xl px-5 pt-6">
          <ScannedPreview state={previewState} node={preview} onOpen={() => parsed && navigate(scanPath(parsed))} />
        </div>
      )}

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Asset access</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Open a CrewBarn asset record
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Use this page only for asset QR codes and one-time security keys. If you are trying to manage
            CrewBarn jobs, customers, accounting, or settings, use the normal SaaS login.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-950">Public QR scan</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Scan the asset label with a phone camera. Public records show safe asset details only.
              </p>
              <QrScanButton
                onScan={openScannedQr}
                buttonLabel="Open camera"
                buttonClassName="mt-4 w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
              />
              {scanError && <p className="mt-2 text-xs text-red-600">{scanError}</p>}
            </div>
            <a
              href={SAAS_LOGIN_URL}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="text-sm font-bold text-slate-950">CrewBarn SaaS login</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Staff and admins sign in at app.crewbarn.com, not the assets subdomain.
              </p>
            </a>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Security key access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Approved users can unlock secured details with the scan link and the one-time key from the asset owner.
          </p>

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">QR scan link or tenant/code</span>
              <div className="mt-1 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  placeholder="https://assets.crewbarn.com/scan/tenant_.../ASSET123"
                  value={scanInput}
                  onChange={(event) => {
                    setScanInput(event.target.value)
                    setError(null)
                  }}
                />
                <QrScanButton
                  onScan={fillSecurityScan}
                  buttonLabel="Scan"
                  buttonClassName="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-amber-400 hover:bg-amber-50"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Security key</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                inputMode="numeric"
                placeholder="6-digit access code"
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(event.target.value)
                  setError(null)
                }}
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={!canContinue}>
              Unlock secured asset
            </Button>
          </form>
        </section>
      </main>
    </div>
  )
}

/**
 * "You scanned …" — identity and compliance, before any form.
 *
 * Compliance colour comes from the server's own verdict rather than being
 * recomputed here, for the same reason the scan page does it: two surfaces
 * deriving compliance separately is how an overdue asset ended up rendering
 * green in the first place.
 */
function ScannedPreview({
  state,
  node,
  onOpen,
}: {
  state: 'idle' | 'loading' | 'missing'
  node: PublicScanNode | null
  onOpen: () => void
}) {
  if (state === 'loading') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
        Looking that tag up…
      </div>
    )
  }

  if (state === 'missing' || !node) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        No CrewBarn record matches that tag. Check the code, or use the full link printed on the
        label.
      </div>
    )
  }

  const asset = node as PublicScanNode & {
    code?: string | null
    report?: { compliance?: { state: string; label: string } | null } | null
    servicer?: { name: string } | null
    breadcrumb?: { name: string }[]
  }
  const compliance = asset.report?.compliance ?? null
  const tone =
    compliance?.state === 'overdue'
      ? 'bg-rose-100 text-rose-800'
      : compliance?.state === 'due' || compliance?.state === 'due_soon'
        ? 'bg-amber-100 text-amber-800'
        : compliance?.state === 'current'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-slate-100 text-slate-600'

  const where = (asset.breadcrumb ?? []).map((b) => b.name).filter(Boolean).join(' › ')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">You scanned</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xl font-black tracking-tight text-slate-950">{node.name}</span>
        {compliance && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>
            {compliance.label}
          </span>
        )}
        {node.is_secured && (
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
            Secured
          </span>
        )}
      </div>
      {(where || asset.servicer?.name) && (
        <p className="mt-1 text-sm text-slate-600">
          {[where, asset.servicer?.name].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {asset.code && (
          <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
            {asset.code}
          </span>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
        >
          Open the record
        </button>
      </div>
    </div>
  )
}
