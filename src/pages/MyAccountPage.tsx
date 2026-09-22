import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

/**
 * My Account — the signed-in user's own login details.
 *
 * Email is READ-ONLY here (changing it is a support/admin action). The user
 * can change their password (requires the current one) and jump to 2FA.
 *   POST /v1/auth/change-password { current_password, password, password_confirmation }
 */
export function MyAccountPage() {
  const { account, refreshAccount } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const name =
    [account?.extension?.first_name, account?.extension?.last_name].filter(Boolean).join(' ') || '—'
  const role = account?.is_platform_admin
    ? 'Platform admin'
    : account?.extension?.role || account?.account_type || 'Member'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next.length < 8) {
      setMsg({ ok: false, text: 'New password must be at least 8 characters.' })
      return
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: 'New password and confirmation do not match.' })
      return
    }
    setBusy(true)
    try {
      await apiRequest('/v1/auth/change-password', {
        method: 'POST',
        body: { current_password: current, password: next, password_confirmation: confirm },
      })
      setMsg({ ok: true, text: 'Password updated.' })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message || 'Could not update password.' })
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">My account</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your sign-in details. Email can't be changed here — contact support if it needs to change.
        </p>
      </div>

      {/* Read-only profile */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <Row label="Name" value={name} />
        <Row label="Email" value={account?.email ?? '—'} />
        <Row label="Role" value={role} />
      </div>

      {/* Profile photo — shows on the dispatch-map avatar + top bar + mobile app. */}
      <ProfilePhotoCard
        avatarUrl={account?.avatar_url ?? null}
        initials={name !== '—' ? name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() : (account?.email ?? 'U').slice(0, 2).toUpperCase()}
        onChanged={refreshAccount}
      />

      {/* Change password */}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-navy-900">Change password</h2>
        {msg && (
          <div
            className={`text-sm rounded-md px-3 py-2 ${
              msg.ok
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {msg.ok ? '✓ ' : '✗ '}
            {msg.text}
          </div>
        )}
        <Field label="Current password">
          <input
            type="password"
            autoComplete="current-password"
            className={inputCls}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !current || !next || !confirm}
            className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>

      {/* 2FA shortcut */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-navy-900">Two-factor authentication</div>
          <div className="text-xs text-slate-500">Add an authenticator app or SMS/email codes.</div>
        </div>
        <Link to="/me/security" className="text-sm font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap">
          Manage 2FA →
        </Link>
      </div>
    </div>
  )
}

/**
 * Profile photo upload — multipart POST /v1/me/avatar (fetch, not apiRequest,
 * which JSON-encodes bodies). The photo becomes the tech's avatar marker on
 * the dispatch map, the top-bar avatar, and the mobile app.
 */
function ProfilePhotoCard({
  avatarUrl,
  initials,
  onChanged,
}: {
  avatarUrl: string | null
  initials: string
  onChanged: () => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Picked file as a data URL — non-null opens the circle-crop modal.
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  async function send(method: 'POST' | 'DELETE', fd?: FormData) {
    setBusy(true)
    setErr(null)
    try {
      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const res = await fetch(`${API_URL}/v1/me/avatar`, { method, headers, body: fd })
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`
        try {
          const j = await res.json()
          if (j?.message) msg = j.message
        } catch { /* not JSON */ }
        throw new Error(msg)
      }
      await onChanged()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-base font-semibold text-navy-900">Profile photo</h2>
      <p className="text-xs text-slate-500 mt-0.5">
        Shows on the dispatch map, the top bar, and the mobile app. JPG/PNG up to 5&nbsp;MB.
      </p>
      {err && (
        <div className="mt-3 text-sm rounded-md px-3 py-2 bg-red-50 text-red-800 border border-red-200">
          ✗ {err}
        </div>
      )}
      <div className="mt-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-amber-400 bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              // Open the circle-crop step instead of uploading full-frame —
              // faces aren't always centered, so let them frame the circle.
              const reader = new FileReader()
              reader.onload = () => setCropSrc(String(reader.result))
              reader.onerror = () => setErr('Could not read that image — try a different one.')
              reader.readAsDataURL(f)
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Working…' : avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void send('DELETE')}
              className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {cropSrc && (
        <AvatarCropModal
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onSave={(blob) => {
            setCropSrc(null)
            const fd = new FormData()
            fd.append('avatar', blob, 'avatar.jpg')
            void send('POST', fd)
          }}
        />
      )}
    </div>
  )
}

/**
 * Circle-crop step for the profile photo — drag to position, slider/wheel to
 * zoom, everything outside the circle is dimmed. Exports the circle's square
 * bounding box as a 512px JPEG via canvas (the map/top-bar/mobile all render
 * it round, so square-out is exactly what the circle shows).
 */
function AvatarCropModal({
  src,
  onCancel,
  onSave,
}: {
  src: string
  onCancel: () => void
  onSave: (blob: Blob) => void
}) {
  const VIEW = 280 // crop viewport (square, circle inscribed), CSS px
  const OUT = 512 // exported image size

  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1) // 1 = photo just covers the circle
  const [offset, setOffset] = useState({ x: 0, y: 0 }) // screen px from center
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [loadErr, setLoadErr] = useState(false)

  // Scale at zoom=1: the photo exactly covers the viewport.
  const coverScale = imgSize ? Math.max(VIEW / imgSize.w, VIEW / imgSize.h) : 1
  const scale = coverScale * zoom

  // Keep the photo covering the whole circle — clamp the pan so no blank
  // edge can be dragged inside the viewport.
  const clampOffset = (o: { x: number; y: number }, s: number) => {
    if (!imgSize) return o
    const maxX = Math.max(0, (imgSize.w * s - VIEW) / 2)
    const maxY = Math.max(0, (imgSize.h * s - VIEW) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    }
  }

  const applyZoom = (z: number) => {
    const nz = Math.min(4, Math.max(1, z))
    setZoom(nz)
    setOffset((o) => clampOffset(o, coverScale * nz))
  }

  const save = () => {
    const img = imgRef.current
    if (!img || !imgSize) return
    // Viewport top-left in source-image coordinates.
    const srcX = imgSize.w / 2 - (VIEW / 2 + offset.x) / scale
    const srcY = imgSize.h / 2 - (VIEW / 2 + offset.y) / scale
    const srcSize = VIEW / scale
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff' // PNG transparency → white, not black, in the JPEG
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT)
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob)
      },
      'image/jpeg',
      0.85,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="text-base font-semibold text-navy-900">Crop your photo</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Drag to position · pinch, scroll, or use the slider to zoom.
        </p>

        {loadErr ? (
          <div className="mt-4 text-sm rounded-md px-3 py-2 bg-red-50 text-red-800 border border-red-200">
            ✗ Couldn't open that image — try a JPG or PNG.
          </div>
        ) : (
          <div
            className="relative mx-auto mt-4 overflow-hidden rounded-lg bg-slate-900 touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY }
            }}
            onPointerMove={(e) => {
              if (!drag.current) return
              const dx = e.clientX - drag.current.x
              const dy = e.clientY - drag.current.y
              drag.current = { x: e.clientX, y: e.clientY }
              setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, scale))
            }}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
            onWheel={(e) => {
              e.preventDefault()
              applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget
                setImgSize({ w: el.naturalWidth, h: el.naturalHeight })
              }}
              onError={() => setLoadErr(true)}
              className="absolute left-1/2 top-1/2 max-w-none"
              style={
                imgSize
                  ? {
                      width: imgSize.w * scale,
                      height: imgSize.h * scale,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    }
                  : { visibility: 'hidden' }
              }
            />
            {/* Circle mask — dims everything the avatar won't show. */}
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white/90"
              style={{
                inset: 0,
                boxShadow: '0 0 0 9999px rgba(15,23,42,.6)',
              }}
            />
          </div>
        )}

        <input
          type="range"
          min={100}
          max={400}
          value={zoom * 100}
          onChange={(e) => applyZoom(Number(e.target.value) / 100)}
          disabled={loadErr}
          className="mt-4 w-full accent-amber-500"
          aria-label="Zoom"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!imgSize || loadErr}
            className="px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm text-navy-900 font-medium truncate">{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
