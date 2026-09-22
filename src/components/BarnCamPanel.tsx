import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  apiRequest,
  API_URL,
  getStoredToken,
  getActingTenant,
} from '@/lib/api'
import { AttachmentOverlay } from '@/components/ui/AttachmentOverlay'

/**
 * BarnCam is camera-first proof-of-work capture for photos and videos on
 * work orders and estimates. Documents belong in the separate document
 * workflow, not in BarnCam.
 */

interface AttachmentRow {
  id: string
  kind: 'image' | 'video' | 'document'
  original_filename: string
  mime_type: string | null
  size_bytes: number
  url: string | null
  share_with_customer: boolean
  captured_at: string | null
  captured_lat: number | null
  captured_lng: number | null
  uploaded_by_account_id: string | null
  uploaded_by_platform_customer_id: string | null
  created_at: string | null
}

type Geo = { lat: number; lng: number } | null

function getGeo(): Promise<Geo> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

async function stampImage(file: File, caption: string): Promise<Blob> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas context')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const lines = caption.split('\n').filter(Boolean)
  const fontSize = Math.max(16, Math.round(canvas.width * 0.025))
  const lineH = Math.round(fontSize * 1.35)
  const pad = Math.round(fontSize * 0.6)
  const barH = pad * 2 + lines.length * lineH

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH)
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  ctx.font = `${fontSize}px -apple-system, system-ui, sans-serif`
  lines.forEach((line, i) => {
    ctx.fillText(line, pad, canvas.height - barH + pad + i * lineH)
  })

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
      'image/jpeg',
      0.9
    )
  )
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  const tenant = getActingTenant()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (tenant) headers['X-Act-As-Tenant'] = tenant
  return headers
}

export function BarnCamPanel({
  basePath,
  cacheKey,
}: {
  basePath: string
  cacheKey: QueryKey
}) {
  const qc = useQueryClient()
  const attachmentsPath = `${basePath}/attachments`
  const [overlay, setOverlay] = useState<{ url: string; filename: string; kind: 'image' } | null>(null)
  const [shareNew, setShareNew] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const q = useQuery({
    queryKey: cacheKey,
    queryFn: () => apiRequest<{ data: AttachmentRow[] }>(attachmentsPath),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: cacheKey })

  async function handleCapture(files: File[]) {
    if (files.length === 0) return
    setBusy(true)
    setError(null)

    try {
      setStatus('Getting location...')
      const geo = await getGeo()

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setStatus(`Uploading ${i + 1} of ${files.length}...`)
        const capturedAt = new Date().toISOString()
        const isImage = file.type.startsWith('image/')

        const caption = [
          new Date(capturedAt).toLocaleString(),
          geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : null,
        ]
          .filter(Boolean)
          .join('\n')

        let uploadBlob: Blob = file
        let uploadName = file.name || (isImage ? 'photo.jpg' : 'video.mp4')
        if (isImage) {
          try {
            uploadBlob = await stampImage(file, caption)
            uploadName = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
          } catch {
            uploadBlob = file
          }
        }

        const fd = new FormData()
        fd.append('photos[]', uploadBlob, uploadName)
        fd.append('captured_at', capturedAt)
        fd.append('share_with_customer', shareNew ? '1' : '0')
        if (geo) {
          fd.append('captured_lat', String(geo.lat))
          fd.append('captured_lng', String(geo.lng))
        }

        const res = await fetch(`${API_URL}${attachmentsPath}`, {
          method: 'POST',
          headers: authHeaders(),
          body: fd,
        })
        if (!res.ok) {
          const text = await res.text()
          let message = `Upload failed (${res.status})`
          try {
            message = JSON.parse(text)?.message ?? message
          } catch {
            // Keep fallback message.
          }
          throw new Error(message)
        }
      }

      setStatus(null)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Capture failed.')
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`${attachmentsPath}/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })

  const toggleShare = useMutation({
    mutationFn: ({ id, share }: { id: string; share: boolean }) =>
      apiRequest(`${attachmentsPath}/${id}`, {
        method: 'PATCH',
        body: { share_with_customer: share },
      }),
    onSuccess: refresh,
  })

  const items = q.data?.data ?? []
  const media = items.filter((a) => a.kind === 'image' || a.kind === 'video')

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">BarnCam</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {media.length === 0
                ? 'Capture on-site photos and video stamped with time and location.'
                : `${media.length} media item${media.length === 1 ? '' : 's'} captured.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shareNew}
                onChange={(e) => setShareNew(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              Share new with customer
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold">
              <input
                type="file"
                accept="image/*,video/*"
                capture="environment"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) void handleCapture(files)
                  e.target.value = ''
                }}
                className="hidden"
                disabled={busy}
              />
              <span>{busy ? status ?? 'Working...' : 'Capture'}</span>
            </label>
          </div>
        </div>
        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mt-3">
            {error}
          </div>
        )}
      </section>

      {media.length > 0 && (
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {media.map((a) => (
              <div
                key={a.id}
                className="relative group bg-slate-900 rounded-lg overflow-hidden aspect-square"
              >
                {a.kind === 'video' ? (
                  a.url ? (
                    <video src={a.url} controls preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                      Video unavailable
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      a.url && setOverlay({ url: a.url, filename: a.original_filename, kind: 'image' })
                    }
                    className="block w-full h-full"
                  >
                    {a.url ? (
                      <img
                        src={a.url}
                        alt={a.original_filename}
                        className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                        Image unavailable
                      </div>
                    )}
                  </button>
                )}

                {(a.captured_at || a.captured_lat != null) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5 pointer-events-none">
                    <div className="text-[10px] leading-tight text-white/90">
                      {a.captured_at && <div>{new Date(a.captured_at).toLocaleString()}</div>}
                      {a.captured_lat != null && a.captured_lng != null && (
                        <div>
                          {a.captured_lat.toFixed(4)}, {a.captured_lng.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleShare.mutate({ id: a.id, share: !a.share_with_customer })}
                  disabled={toggleShare.isPending}
                  title={a.share_with_customer ? 'Shared with customer' : 'Private - click to share'}
                  className={`absolute top-1.5 left-1.5 min-w-7 h-7 rounded-full text-xs flex items-center justify-center px-2 transition-opacity ${
                    a.share_with_customer
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/90 text-slate-600 opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label="Toggle customer sharing"
                >
                  {a.share_with_customer ? 'Shared' : 'Share'}
                </button>

                <button
                  type="button"
                  onClick={() => remove.mutate(a.id)}
                  disabled={remove.isPending}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label="Delete"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {q.isSuccess && media.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
          Nothing yet. Use <strong>Capture</strong> to add on-site photos or video.
        </div>
      )}

      {overlay && (
        <AttachmentOverlay
          url={overlay.url}
          filename={overlay.filename}
          kind={overlay.kind}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
