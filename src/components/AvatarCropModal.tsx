import { useRef, useState } from 'react'

/**
 * Circle-crop step for an avatar photo — drag to position, slider/wheel to
 * zoom, everything outside the circle is dimmed. Exports the circle's square
 * bounding box as a 512px JPEG via canvas (everything renders it round, so
 * square-out is exactly what the circle shows). Shared by the user profile
 * photo and customer avatars.
 */
export function AvatarCropModal({
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
