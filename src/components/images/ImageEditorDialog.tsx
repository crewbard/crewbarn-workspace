import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

/**
 * Crop, size and (optionally) cut out the background of an image BEFORE it is
 * uploaded.
 *
 * Three problems, one dialog:
 *
 *   Uniformity — the server scales images down but preserves aspect ratio, so a
 *   tall photo and a wide one fill their tile differently and the catalog looks
 *   ragged. A square crop is the fix, and it belongs here rather than on the
 *   server because only the person looking at the photo knows which part of it
 *   is the product.
 *
 *   Speed — a phone photo is 5–12MB. Cropping and downscaling here means ~400KB
 *   leaves the device, which matters far more on a truck than in the office.
 *
 *   Background — a cut-out product photo on white is what makes a catalog look
 *   deliberate. Removal runs IN THE BROWSER: no per-image fee, and the photo
 *   never leaves the machine.
 *
 * The background model is ~5–10MB and is loaded ONLY when the button is
 * pressed, so nobody who doesn't use it pays for it in bundle size or download.
 */

const OUTPUT_PX = 1200

export function ImageEditorDialog({
  file,
  onCancel,
  onDone,
}: {
  file: File
  /** Receives the finished image, ready to upload. */
  onDone: (result: File) => void
  onCancel: () => void
}) {
  const [src, setSrc] = useState<string>(() => URL.createObjectURL(file))
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transparent, setTransparent] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  async function handleRemoveBackground() {
    setError(null)
    setBusy('Loading the background model — first time only…')
    try {
      // Dynamic import: keeps the model and its runtime out of the main bundle
      // for everyone who never presses this.
      const { removeBackground } = await import('@imgly/background-removal')
      setBusy('Removing the background…')
      const blob = await removeBackground(src)
      URL.revokeObjectURL(src)
      setSrc(URL.createObjectURL(blob))
      // From here the image has real alpha, so the output has to be PNG —
      // JPEG has no alpha channel and would flatten it to black.
      setTransparent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the background.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSave() {
    if (!area) return
    setError(null)
    setBusy('Preparing the image…')
    try {
      const out = await renderCrop(src, area, transparent)
      onDone(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that image.')
      setBusy(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Adjust the image</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Drag to position, scroll or use the slider to zoom. Square, so every product tile matches.
          </p>
        </div>

        {/* The checkerboard reads through a cut-out, so "transparent" is
            visible rather than something you discover after saving. */}
        <div
          className="relative h-[360px] w-full"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#eef2f7 25%,transparent 25%,transparent 75%,#eef2f7 75%),linear-gradient(45deg,#eef2f7 25%,transparent 25%,transparent 75%,#eef2f7 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 8px 8px',
          }}
        >
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            restrictPosition={false}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3">
          <label className="flex flex-1 items-center gap-2 text-xs text-slate-600">
            Zoom
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </label>
          <button
            type="button"
            onClick={handleRemoveBackground}
            disabled={!!busy || transparent}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
          >
            {transparent ? '✓ Background removed' : 'Remove background'}
          </button>
        </div>

        {(busy || error) && (
          <div
            className={`px-5 py-2 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'}`}
          >
            {error ?? busy}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!!busy || !area}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Use this image
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Draw the chosen square to a canvas at a fixed size and hand back a File. */
async function renderCrop(src: string, area: Area, transparent: boolean): Promise<File> {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_PX
  canvas.height = OUTPUT_PX

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')

  // A JPEG has no alpha, and an unpainted canvas encodes as BLACK rather than
  // white. Paint white first so a normal photo never gains a black border.
  if (!transparent) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX)
  }

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_PX, OUTPUT_PX)

  const type = transparent ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, transparent ? undefined : 0.9),
  )
  if (!blob) throw new Error('Could not encode the image.')

  return new File([blob], transparent ? 'image.png' : 'image.jpg', { type })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}
