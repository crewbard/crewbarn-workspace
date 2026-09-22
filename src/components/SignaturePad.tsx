import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'

/**
 * Reusable signature pad — black ink on a white canvas, mouse + touch input.
 *
 * Lifted from SignDocumentPage so we can reuse it for inspection finalize
 * (and future: estimate sign-off, etc.). Exposes an imperative API via
 * ref:
 *   sigRef.current?.toDataUrl()   // 'data:image/png;base64,...' (transparent
 *                                 //  bg, black ink) — null if empty
 *   sigRef.current?.clear()       // wipes the canvas
 *   sigRef.current?.isEmpty()     // bool, no strokes
 *
 * `onChange` fires once when the user first draws (use to enable the
 * Submit button). It does NOT fire on every stroke.
 */

export interface SignaturePadHandle {
  toDataUrl: () => string | null
  clear: () => void
  isEmpty: () => boolean
}

interface Props {
  /** Pixel height of the drawing surface. Width fills the container. */
  height?: number
  /** Fires when the canvas transitions from empty → drawn. */
  onChange?: (hasDrawn: boolean) => void
  /** Hint label below the line (e.g. "Sign above"). */
  hint?: string
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 140, onChange, hint = 'Sign above' },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasDrawn, setHasDrawn] = useState(false)

  useImperativeHandle(ref, () => ({
    toDataUrl: () => {
      const c = canvasRef.current
      if (!c || !hasDrawn) return null
      // Trim transparent margins so the PDF gets a tight crop.
      return c.toDataURL('image/png')
    },
    clear: () => {
      const c = canvasRef.current
      if (!c) return
      c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
      setHasDrawn(false)
      onChange?.(false)
    },
    isEmpty: () => !hasDrawn,
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Match canvas pixel size to its CSS size for crisp lines on HiDPI.
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.2

    let drawing = false
    let last: { x: number; y: number } | null = null
    let drawnLocal = false

    function pos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const r = canvas!.getBoundingClientRect()
      const p = 'touches' in e ? e.touches[0] : (e as MouseEvent)
      return {
        x: p.clientX - r.left,
        y: p.clientY - r.top,
      }
    }

    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      drawing = true
      last = pos(e)
      if (!drawnLocal) {
        drawnLocal = true
        setHasDrawn(true)
        onChange?.(true)
      }
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
  }, [onChange])

  function clearCanvas() {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setHasDrawn(false)
    onChange?.(false)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px`, touchAction: 'none' }}
        className="bg-white border border-slate-300 rounded cursor-crosshair"
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-slate-500">{hint}</span>
        {hasDrawn && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
})
