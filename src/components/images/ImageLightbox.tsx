import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * ImageLightbox — full-screen viewer for the photos people text in: a keyway,
 * a lock face, a key bow with a code stamped on it, a VIN plate shot at arm's
 * length in a dark garage.
 *
 *   Zoom      wheel, pinch, double-click, +/− (up to 8×), drag to pan
 *   Rotate    90° steps — phones send sideways photos
 *   Clean up  sharpen (unsharp mask, adjustable), brighten, contrast, B&W
 *   Select    drag a box around the stamping (mouse or finger); that box is
 *             what gets read — tighter than "whatever's on screen". A box,
 *             not a freehand lasso: the crop is rectangular either way, and
 *             corner-to-corner is the more predictable gesture on a phone
 *   Read text hands the region (selection, else what's on screen) — cropped,
 *             rotated, cleaned up the same way — to the tenant's AI and lists
 *             every code it can read
 *
 * The image is laid out at its NATIVE pixel size (capped) and scaled with a
 * transform, so the sharpen filter always works on real pixels rather than on
 * a fit-to-screen downsample that the zoom then smears back up. The filters
 * are CSS `filter` + one SVG unsharp mask, run in the browser on the original
 * pixels — no server round-trip, and they work on cross-origin S3 images (a
 * canvas would be tainted; CSS filters aren't). A browser can't invent detail
 * that isn't there; that's what "Read text" is for.
 */

export type LightboxView = {
  /** Region on screen, as fractions of the full image (0–1), in the image's own orientation. */
  crop: { x: number; y: number; w: number; h: number }
  rotate: number
  sharpen: number
  brightness: number
  contrast: number
  bw: boolean
  /** What the office says is in the box, in their own words — focuses the read. Empty = anything. */
  expect: string
}

/** Suggestions only — any trade types its own ("furnace model number", "meter serial"). */
const EXPECT_SUGGESTIONS = ['VIN', 'Key code', 'Serial number', 'Model number', 'Part number', 'License plate', 'Lock cylinder code']
const EXPECT_KEY = 'crewbarn.lightbox.expect'

export type TextReading = {
  text: string
  kind: string | null
  confidence: number | null
  alternatives: string[]
  note: string | null
}
export type TextReadResult = {
  readings: TextReading[]
  notes: string | null
  model?: string | null
  /** Size of the read area in the ORIGINAL photo's pixels — small means the AI had little to go on. */
  source_px?: { w: number; h: number } | null
  /** A small copy of the cleaned crop the AI was given — "what the AI saw". */
  preview?: string | null
}

type Filters = { sharpen: number; brightness: number; contrast: number; bw: boolean }
const NO_FILTERS: Filters = { sharpen: 0, brightness: 1, contrast: 1, bw: false }
const AUTO_FILTERS: Filters = { sharpen: 1.5, brightness: 1.1, contrast: 1.25, bw: false }
const MIN_SCALE = 1
const MAX_SCALE = 8
/** Largest edge the image is laid out at; the filter cost is bounded by this. */
const LAYOUT_CAP = 2400

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
  title,
  onReadText,
}: {
  images: string[]
  /** null = closed. */
  index: number | null
  onClose: () => void
  onIndexChange?: (i: number) => void
  title?: string
  /** When given, a "Read text" button sends the current view to AI. */
  onReadText?: (url: string, view: LightboxView) => Promise<TextReadResult>
}) {
  const open = index !== null && index >= 0 && index < images.length
  const src = open ? images[index] : null

  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [rot, setRot] = useState(0)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [failed, setFailed] = useState(false)
  // No transform easing while a finger/mouse is down — it would lag the drag.
  const [interacting, setInteracting] = useState(false)
  const [reading, setReading] = useState(false)
  const [read, setRead] = useState<TextReadResult | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  // What the office says it's reading, in their own words. Remembered — a
  // locksmith reads VINs all day, an HVAC office reads model numbers.
  const [expect, setExpectState] = useState<string>(() => {
    try { return localStorage.getItem(EXPECT_KEY) ?? '' } catch { return '' }
  })
  const setExpect = (v: string) => {
    setExpectState(v)
    try { localStorage.setItem(EXPECT_KEY, v) } catch { /* private mode */ }
  }
  // Select: while on, a one-finger drag draws a box instead of panning. The
  // box being dragged is kept in frame coordinates for the overlay; on release
  // it becomes `selection`, stored as image fractions so it survives zoom/pan.
  const [lasso, setLasso] = useState(false)
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [selection, setSelection] = useState<LightboxView['crop'] | null>(null)
  // Mirror for the keyboard handler (Esc clears a selection before it closes).
  const selectionRef = useRef<LightboxView['crop'] | null>(null)
  selectionRef.current = selection

  // Fresh view for every image; the clean-up choice sticks — you usually want
  // the same treatment on the next shot from the same phone.
  const resetView = useCallback(() => {
    setScale(1)
    setTx(0)
    setTy(0)
    setRot(0)
  }, [])
  useEffect(() => {
    resetView()
    setNat(null)
    setFailed(false)
    setRead(null)
    setReadError(null)
    setSelection(null)
    setDragRect(null)
  }, [src, resetView])

  // Frame size drives the fit scale; keep it current across resizes/rotation.
  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el || !open) return
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const go = useCallback(
    (delta: number) => {
      if (!open || images.length < 2) return
      const next = (index + delta + images.length) % images.length
      onIndexChange?.(next)
    },
    [open, index, images.length, onIndexChange],
  )

  /** Zoom so the point under the cursor stays put. `px,py` are relative to the frame's center. */
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor))
      const ratio = next / s
      setTx((x) => px - (px - x) * ratio)
      setTy((y) => py - (py - y) * ratio)
      if (next === MIN_SCALE) {
        setTx(0)
        setTy(0)
      }
      return next
    })
  }, [])

  const framePoint = useCallback((clientX: number, clientY: number) => {
    const r = frameRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) }
  }, [])

  // Keyboard: Esc, arrows, + / -, r, 0.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') { if (selectionRef.current) { setSelection(null); setDragRect(null) } else onClose() }
      else if (e.key === 's' || e.key === 'S' || e.key === 'l' || e.key === 'L') setLasso((v) => !v)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === '+' || e.key === '=') zoomAt(1.25, 0, 0)
      else if (e.key === '-') zoomAt(1 / 1.25, 0, 0)
      else if (e.key === 'r' || e.key === 'R') setRot((d) => (d + 90) % 360)
      else if (e.key === '0') resetView()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, go, zoomAt, resetView])

  // Wheel zoom. React registers wheel as passive, so preventDefault (no page
  // scroll behind the overlay) needs a manual non-passive listener.
  useEffect(() => {
    const el = frameRef.current
    if (!el || !open) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = framePoint(e.clientX, e.clientY)
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, framePoint, zoomAt])

  // Pointer handling: one finger/mouse drags (or draws a box, in select
  // mode), two fingers pinch either way.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number } | null>(null)
  const dragged = useRef(false)
  /** Corner-to-corner box being drawn, frame coords: [start, current]. */
  const drawing = useRef<{ start: [number, number]; end: [number, number] } | null>(null)

  const rectOf = (a: [number, number], b: [number, number]) => ({
    x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]),
  })

  /** Frame point (relative to the frame's top-left) for a pointer event. */
  function framePos(clientX: number, clientY: number): [number, number] {
    const r = frameRef.current?.getBoundingClientRect()
    return r ? [clientX - r.left, clientY - r.top] : [0, 0]
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragged.current = false
    setInteracting(true)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) }
      // A second finger means pinch, not draw.
      drawing.current = null
      setDragRect(null)
    } else if (lasso) {
      const p = framePos(e.clientX, e.clientY)
      drawing.current = { start: p, end: p }
      setDragRect(null)
    }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    if (drawing.current && pointers.current.size === 1) {
      drawing.current.end = framePos(e.clientX, e.clientY)
      setDragRect(rectOf(drawing.current.start, drawing.current.end))
      dragged.current = true
      return
    }
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (dist > 0 && pinch.current.dist > 0) {
        const mid = framePoint((a.x + b.x) / 2, (a.y + b.y) / 2)
        zoomAt(dist / pinch.current.dist, mid.x, mid.y)
      }
      pinch.current = { dist }
      dragged.current = true
      return
    }
    if (pointers.current.size === 1 && scale > 1) {
      const dx = cur.x - prev.x
      const dy = cur.y - prev.y
      if (Math.abs(dx) + Math.abs(dy) > 0) dragged.current = true
      setTx((x) => x + dx)
      setTy((y) => y + dy)
    }
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) setInteracting(false)
    if (drawing.current && pointers.current.size === 0) {
      const r = rectOf(drawing.current.start, drawing.current.end)
      drawing.current = null
      setDragRect(null)
      // A tap (no real box) clears instead.
      if (r.w < 8 || r.h < 8) { setSelection(null); return }
      const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h
      setSelection(fractionBox([[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [x - frame.w / 2, y - frame.h / 2] as [number, number])))
      dragged.current = true
    }
  }
  function onFrameClick(e: React.MouseEvent<HTMLDivElement>) {
    // Backdrop click closes; a drag that ends on the backdrop doesn't, and
    // in select mode a click is a (cleared) selection, not a close.
    if (dragged.current || lasso) return
    if (e.target === e.currentTarget) onClose()
  }
  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (lasso) return
    const p = framePoint(e.clientX, e.clientY)
    if (scale > 1.01) resetView()
    else zoomAt(2.5, p.x, p.y)
  }

  // ── geometry ──
  // Layout size: native pixels, capped. Fit: shrink/grow to the frame, aware
  // of rotation. Rendered = translate · scale(fit·zoom) · rotate about center.
  const base = nat ? Math.min(1, LAYOUT_CAP / Math.max(nat.w, nat.h)) : 1
  const lw = nat ? nat.w * base : 0
  const lh = nat ? nat.h * base : 0
  const sideways = rot % 180 !== 0
  const fit = nat && frame.w && frame.h ? Math.min(frame.w / (sideways ? lh : lw), frame.h / (sideways ? lw : lh)) : 1
  const ready = !!nat && frame.w > 0 && frame.h > 0

  /**
   * The image-fraction box that covers the given frame points (relative to
   * the frame's center): undo translate & scale, undo rotate, clamp. Used for
   * both "what's on screen" (the four frame corners) and a lasso's box.
   */
  function fractionBox(points: Array<[number, number]>): LightboxView['crop'] {
    if (!ready) return { x: 0, y: 0, w: 1, h: 1 }
    const s = fit * scale
    const rad = (-rot * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [fx, fy] of points) {
      const ux = (fx - tx) / s
      const uy = (fy - ty) / s
      const qx = ux * cos - uy * sin + lw / 2
      const qy = ux * sin + uy * cos + lh / 2
      minX = Math.min(minX, qx); maxX = Math.max(maxX, qx)
      minY = Math.min(minY, qy); maxY = Math.max(maxY, qy)
    }
    const x0 = Math.max(0, minX) / lw, y0 = Math.max(0, minY) / lh
    const x1 = Math.min(lw, maxX) / lw, y1 = Math.min(lh, maxY) / lh
    if (!(x1 > x0) || !(y1 > y0)) return { x: 0, y: 0, w: 1, h: 1 }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }

  /** The part of the image on screen right now, as 0–1 fractions of the full image. */
  function visibleRegion(): LightboxView['crop'] {
    return fractionBox([[-frame.w / 2, -frame.h / 2], [frame.w / 2, -frame.h / 2], [-frame.w / 2, frame.h / 2], [frame.w / 2, frame.h / 2]])
  }

  /** Where an image-fraction box sits on screen right now (frame top-left coords) — the overlay follows zoom/pan/rotate. */
  function frameBox(c: LightboxView['crop']): { x: number; y: number; w: number; h: number } | null {
    if (!ready) return null
    const s = fit * scale
    const rad = (rot * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [qx, qy] of [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]]) {
      const ux = qx * lw - lw / 2
      const uy = qy * lh - lh / 2
      const fx = (ux * cos - uy * sin) * s + tx + frame.w / 2
      const fy = (ux * sin + uy * cos) * s + ty + frame.h / 2
      x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, fy); y1 = Math.max(y1, fy)
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }

  async function readText() {
    if (!src || !onReadText || reading) return
    setReading(true)
    setReadError(null)
    try {
      const res = await onReadText(src, { crop: selection ?? visibleRegion(), rotate: rot, sharpen: filters.sharpen, brightness: filters.brightness, contrast: filters.contrast, bw: filters.bw, expect: expect.trim().slice(0, 80) })
      setRead(res)
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Could not read the photo.')
    } finally {
      setReading(false)
    }
  }

  if (!open || !src) return null

  const sharpenOn = filters.sharpen > 0
  const cssFilter = [
    sharpenOn ? 'url(#cb-lightbox-sharpen)' : '',
    filters.brightness !== 1 ? `brightness(${filters.brightness})` : '',
    filters.contrast !== 1 ? `contrast(${filters.contrast})` : '',
    filters.bw ? 'grayscale(1)' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const anyFilter = cssFilter !== ''
  const selectionBox = selection ? frameBox(selection) : null
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-30'
  const chip = (on: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${on ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col bg-slate-950/95 text-white" role="dialog" aria-modal="true" aria-label="Image viewer">
      {/* Unsharp mask: out = (1+k)·src − k·blur(src). Radius grows a little with strength. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="cb-lightbox-sharpen" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={0.8 + filters.sharpen * 0.4} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k1="0" k2={1 + filters.sharpen} k3={-filters.sharpen} k4="0" />
        </filter>
      </svg>

      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1 truncate text-sm text-white/80">
          {title ?? 'Photo'}
          {images.length > 1 && <span className="ml-2 text-white/50">{index + 1} / {images.length}</span>}
        </div>
        <button type="button" onClick={() => zoomAt(1 / 1.25, 0, 0)} disabled={scale <= MIN_SCALE} className={iconBtn} aria-label="Zoom out" title="Zoom out (−)">−</button>
        <span className="w-12 text-center text-xs tabular-nums text-white/70">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomAt(1.25, 0, 0)} disabled={scale >= MAX_SCALE} className={iconBtn} aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button type="button" onClick={() => setRot((d) => (d + 90) % 360)} className={iconBtn} aria-label="Rotate" title="Rotate (R)">↻</button>
        {onReadText && (
          <button
            type="button"
            onClick={() => { setLasso((v) => !v); if (lasso) { setSelection(null); setDragRect(null) } }}
            className={`${iconBtn} w-auto px-3 text-xs font-semibold ${lasso ? 'bg-amber-400 text-slate-900 hover:bg-amber-300' : ''}`}
            aria-pressed={lasso}
            title="Select area (S): drag a box around the stamping, then Read selection"
          >
            Select
          </button>
        )}
        <a href={src} target="_blank" rel="noreferrer" className={`${iconBtn} hidden sm:flex`} aria-label="Open original in a new tab" title="Open original">↗</a>
        <button type="button" onClick={onClose} className={iconBtn} aria-label="Close" title="Close (Esc)">✕</button>
      </div>

      <div
        ref={frameRef}
        className={`relative min-h-0 flex-1 select-none overflow-hidden ${lasso ? 'cursor-crosshair' : scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onFrameClick}
        onDoubleClick={onDoubleClick}
      >
        {!ready && !failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Loading…</div>}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            This image can't be loaded.&nbsp;<a href={src} target="_blank" rel="noreferrer" className="underline">Open it directly</a>.
          </div>
        )}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
          onError={() => setFailed(true)}
          className="absolute left-1/2 top-1/2 max-w-none"
          style={{
            width: lw || undefined,
            height: lh || undefined,
            marginLeft: -lw / 2,
            marginTop: -lh / 2,
            transform: `translate(${tx}px, ${ty}px) scale(${fit * scale}) rotate(${rot}deg)`,
            transition: interacting ? 'none' : 'transform 120ms ease-out',
            filter: cssFilter || undefined,
            opacity: ready ? 1 : 0,
          }}
        />
        {(dragRect || selectionBox) && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {selectionBox && (
              <>
                <path
                  d={`M0 0H${frame.w}V${frame.h}H0Z M${selectionBox.x} ${selectionBox.y}h${selectionBox.w}v${selectionBox.h}h${-selectionBox.w}Z`}
                  fill="rgba(2,6,23,0.55)"
                  fillRule="evenodd"
                />
                <rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.w} height={selectionBox.h} fill="none" stroke="#fbbf24" strokeWidth="2" />
              </>
            )}
            {dragRect && (
              <rect x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h} fill="rgba(251,191,36,0.12)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 4" />
            )}
          </svg>
        )}
        {lasso && !selection && !dragRect && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-amber-400/90 px-3 py-1 text-xs font-semibold text-slate-900">Drag a box around the numbers</div>
        )}
        {images.length > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1) }} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-lg hover:bg-black/70" aria-label="Previous">‹</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-lg hover:bg-black/70" aria-label="Next">›</button>
          </>
        )}
      </div>

      {(read || readError) && (
        <div className="max-h-[38vh] overflow-y-auto border-t border-white/10 bg-slate-900/80 px-3 py-2 text-sm sm:px-4">
          {readError && <div className="text-amber-300">{readError}</div>}
          {read && (read.preview || read.source_px) && (
            <div className="mb-2 flex items-start gap-3">
              {read.preview && <img src={read.preview} alt="What the AI saw" className="max-h-24 max-w-[40%] rounded border border-white/20 object-contain" />}
              <div className="text-xs text-white/60">
                <div className="font-semibold text-white/80">What the AI saw</div>
                {read.source_px && (
                  <div>
                    {read.source_px.w}×{read.source_px.h} px of the original
                    {Math.min(read.source_px.w, read.source_px.h) < 120 && (
                      <span className="text-amber-300"> — very small. Characters this size are usually unreadable; lasso a larger area, zoom the original, or ask for a closer photo.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {read && read.readings.length === 0 && <div className="text-white/70">Nothing legible in this area{read.notes ? ` — ${read.notes}` : ''}. Lasso a bigger area, or ask the customer for a closer, straight-on photo.</div>}
          {read && read.readings.length > 0 && (
            <ul className="space-y-1.5">
              {read.readings.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-base font-semibold tracking-wider text-amber-300">{r.text}</span>
                  {r.kind && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-white/70">{r.kind.replace(/_/g, ' ')}</span>}
                  {r.confidence !== null && <span className="text-xs tabular-nums text-white/50">{r.confidence}%</span>}
                  {r.alternatives.length > 0 && <span className="text-xs text-white/60">or {r.alternatives.map((a) => <code key={a} className="mx-0.5 rounded bg-white/10 px-1">{a}</code>)}</span>}
                  {r.note && <span className="text-xs text-white/50">{r.note}</span>}
                  <CopyButton text={r.text} />
                </li>
              ))}
            </ul>
          )}
          {read?.notes && read.readings.length > 0 && <div className="mt-1.5 text-xs text-white/50">{read.notes}</div>}
          {read?.model && <div className="mt-1 text-[11px] text-white/40">Read by {read.model} — your AI setting; mini/flash models step up to the full-size one for reads.</div>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-3 py-2 sm:px-4">
        <Slider label="Sharpen" value={filters.sharpen} min={0} max={4} step={0.25} display={filters.sharpen === 0 ? 'off' : `${filters.sharpen}×`} onChange={(v) => setFilters((f) => ({ ...f, sharpen: v }))} />
        <Slider label="Brighten" value={filters.brightness} min={0.5} max={2} step={0.05} display={`${Math.round(filters.brightness * 100)}%`} onChange={(v) => setFilters((f) => ({ ...f, brightness: v }))} />
        <Slider label="Contrast" value={filters.contrast} min={0.5} max={2.5} step={0.05} display={`${Math.round(filters.contrast * 100)}%`} onChange={(v) => setFilters((f) => ({ ...f, contrast: v }))} />
        <button type="button" onClick={() => setFilters((f) => ({ ...f, bw: !f.bw }))} className={chip(filters.bw)} aria-pressed={filters.bw}>B&amp;W</button>
        <button type="button" onClick={() => setFilters((f) => ({ ...AUTO_FILTERS, bw: f.bw }))} className={chip(false)} title="Sharpen 1.5×, brighten 110%, contrast 125%">Auto</button>
        {anyFilter && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="rounded-md px-2 py-1 text-xs text-white/70 underline-offset-2 hover:underline">Original</button>
        )}
        {selection && (
          <button type="button" onClick={() => { setSelection(null); setDragRect(null) }} className="rounded-md px-2 py-1 text-xs text-white/70 underline-offset-2 hover:underline">Clear selection</button>
        )}
        {onReadText && (
          <label className="ml-auto flex items-center gap-1.5 text-xs">
            <span className="text-white/70">What is it?</span>
            <input
              value={expect}
              onChange={(e) => setExpect(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void readText() } }}
              list="cb-read-expect"
              maxLength={80}
              placeholder="VIN, key code, model number…"
              className="w-44 rounded-md border border-white/20 bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
              aria-label="What is being read"
            />
            <datalist id="cb-read-expect">
              {EXPECT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>
        )}
        {onReadText && (
          <button
            type="button"
            onClick={readText}
            disabled={reading || !ready}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            title={selection ? 'Sends the selected area' : "Sends what's on screen right now — zoom in on the stamping, or select it"}
          >
            {reading ? 'Reading…' : selection ? 'Read selection' : read ? 'Read again' : 'Read text with AI'}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-14 text-white/70">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-24 cursor-pointer accent-amber-400 sm:w-28" aria-label={label} />
      <span className="w-9 tabular-nums text-white/50">{display}</span>
    </label>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1200)
        })
      }}
      className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white hover:bg-white/20"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}
