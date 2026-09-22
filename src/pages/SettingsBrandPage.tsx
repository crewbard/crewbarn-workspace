import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken } from '@/lib/api'

/**
 * Tool Shed → General → Brand & Logo.
 *
 * Surfaces the tenant logo + brand primary colour that templates pick up
 * via `{{company.logo}}` and `{{company.brand_color}}` merge tags. Logo
 * upload goes to R2 at a stable path via a multipart POST; the colour is
 * a hex string saved on tenant_settings.
 *
 *   GET    /v1/tenant-settings/brand
 *   POST   /v1/tenant-settings/brand/logo   (multipart file=…)
 *   PATCH  /v1/tenant-settings/brand        { brand_primary_color }
 *   DELETE /v1/tenant-settings/brand/logo
 */

interface BrandPayload {
  logo_url: string | null
  brand_primary_color: string | null
}

const COLOR_PRESETS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#0f172a']

export function SettingsBrandPage() {
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const brand = useQuery({
    queryKey: ['tenant-brand'],
    queryFn: () => apiRequest<{ data: BrandPayload }>('/v1/tenant-settings/brand'),
  })

  const [color, setColor] = useState<string>('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  // Seed local colour state once data lands so the swatch picker reflects
  // what's saved without re-running on every refetch.
  const data = brand.data?.data
  const savedColor = data?.brand_primary_color ?? null
  if (data && color === '' && savedColor) {
    // Avoid useEffect dance — set once on first read; React will batch
    // this with the parent render.
    setColor(savedColor)
  }

  const saveColor = useMutation({
    mutationFn: (next: string | null) =>
      apiRequest<{ data: BrandPayload }>('/v1/tenant-settings/brand', {
        method: 'PATCH',
        body: { brand_primary_color: next },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-brand'] }),
  })

  const deleteLogo = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { logo_url: null } }>('/v1/tenant-settings/brand/logo', {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-brand'] }),
  })

  const handleUpload = async (file: File) => {
    setUploadError(null)
    setUploadBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = getStoredToken()
      const res = await fetch(`${API_URL}/v1/tenant-settings/brand/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Upload failed (${res.status})`)
      }
      qc.invalidateQueries({ queryKey: ['tenant-brand'] })
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploadBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (brand.isLoading) {
    return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-500">Loading…</div>
  }

  const logoUrl = data?.logo_url ?? null
  const colorDirty = color && color !== savedColor

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Brand &amp; Logo</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your logo and brand colour appear on customer-facing docs (estimates,
          invoices, emails) anywhere a template uses{' '}
          <code className="text-[12px] bg-slate-100 px-1 rounded">{'{{company.logo}}'}</code>
          {' '}or{' '}
          <code className="text-[12px] bg-slate-100 px-1 rounded">{'{{company.brand_color}}'}</code>.
        </p>
      </div>

      {/* Logo */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Logo</h2>
        <p className="text-xs text-slate-500 mb-4">
          PNG, JPG, WebP, or SVG. Max 5 MB. Best at a transparent background, ~600 px wide.
        </p>

        <div className="flex items-start gap-6">
          <div className="w-40 h-32 border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[11px] text-slate-400">No logo yet</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploadBusy}
                className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
              >
                {uploadBusy ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Remove the logo? Templates that use {{company.logo}} will render without one.')) {
                      deleteLogo.mutate()
                    }
                  }}
                  disabled={deleteLogo.isPending}
                  className="text-sm px-4 py-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            {uploadError && (
              <p className="text-xs text-red-600 mt-2">{uploadError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Brand colour */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Brand colour</h2>
        <p className="text-xs text-slate-500 mb-4">
          Used as the accent in customer-facing emails and documents.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              title={hex}
              className={[
                'w-10 h-10 rounded-full border-2 transition',
                color.toLowerCase() === hex.toLowerCase()
                  ? 'border-slate-900 ring-2 ring-slate-200'
                  : 'border-slate-200 hover:border-slate-400',
              ].join(' ')}
              style={{ background: hex }}
            />
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="color"
              value={color || '#000000'}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-md border border-slate-300 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#000000"
              maxLength={7}
              className="w-28 px-3 py-2 text-sm border border-slate-300 rounded-md font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={() => saveColor.mutate(color || null)}
            disabled={!colorDirty || saveColor.isPending}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-40"
          >
            {saveColor.isPending ? 'Saving…' : 'Save colour'}
          </button>
          {savedColor && (
            <button
              type="button"
              onClick={() => {
                setColor('')
                saveColor.mutate(null)
              }}
              disabled={saveColor.isPending}
              className="text-sm px-3 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
