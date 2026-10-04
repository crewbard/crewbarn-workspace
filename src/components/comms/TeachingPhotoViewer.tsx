import { useId, useRef, useState, type PointerEvent } from 'react'
import { IconZoomIn, IconZoomOut, IconRestore } from '@tabler/icons-react'

/** Display adjustments only: the source photo and teaching payload are never modified. */
export function TeachingPhotoViewer({ url, photoNumber }: { url: string; photoNumber: number }) {
  const id = useId()
  const viewport = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [contrast, setContrast] = useState(100)
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const changeZoom = (next: number) => setZoom(Math.max(1, Math.min(4, next)))
  const reset = () => {
    setZoom(1)
    setContrast(100)
    viewport.current?.scrollTo({ left: 0, top: 0 })
  }
  const buttonClass = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-white/20 px-2 hover:bg-white/10 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
  return <section aria-label="Photo view controls" className="min-w-0 bg-slate-950 text-white lg:sticky lg:top-0 lg:self-start">
    <div className="flex flex-wrap items-center gap-3 border-b border-white/15 p-3 text-xs">
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} aria-label="Zoom out" disabled={zoom <= 1} onClick={() => changeZoom(zoom - 0.25)}><IconZoomOut size={18} /></button>
        <label htmlFor={`${id}-zoom`} className="sr-only">Photo zoom</label>
        <input id={`${id}-zoom`} type="range" min={1} max={4} step={0.25} value={zoom} onChange={e => changeZoom(Number(e.target.value))} className="w-20 accent-amber-500" />
        <output htmlFor={`${id}-zoom`} className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</output>
        <button type="button" className={buttonClass} aria-label="Zoom in" disabled={zoom >= 4} onClick={() => changeZoom(zoom + 0.25)}><IconZoomIn size={18} /></button>
      </div>
      <label htmlFor={`${id}-contrast`} className="flex items-center gap-2">Contrast
        <input id={`${id}-contrast`} type="range" min={50} max={200} step={5} value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-20 accent-amber-500" />
        <output htmlFor={`${id}-contrast`} className="w-9 tabular-nums">{contrast}%</output>
      </label>
      <button type="button" className={`${buttonClass} gap-1.5`} onClick={reset}><IconRestore size={16} /> Reset</button>
    </div>
    <div ref={viewport} tabIndex={0} aria-label="Photo viewport; drag or scroll to explore when zoomed in"
      onPointerDown={event => {
        // Keep native touch scrolling and scrollbar dragging intact.
        if (event.pointerType !== 'mouse' || event.button !== 0 || zoom <= 1 || event.target === event.currentTarget) return
        event.preventDefault()
        const node = event.currentTarget
        node.focus({ preventScroll: true })
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop }
        node.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={event => {
        const start = drag.current
        if (!start || start.pointerId !== event.pointerId) return
        if ((event.buttons & 1) === 0) { stopDrag(event); return }
        event.currentTarget.scrollLeft = start.left - (event.clientX - start.x)
        event.currentTarget.scrollTop = start.top - (event.clientY - start.y)
      }}
      onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}
      className={`h-[55vh] select-none overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${zoom > 1 ? dragging ? 'cursor-grabbing' : 'cursor-grab' : ''}`}>
      <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
        <img src={url} alt={`Conversation photo ${photoNumber}`} draggable={false} className="h-full w-full max-w-none object-contain" style={{ filter: `contrast(${contrast}%)` }} />
      </div>
    </div>
    <p className="border-t border-white/15 px-3 py-2 text-[11px] text-slate-400">Drag, scroll or swipe to explore when zoomed. View adjustments only — original photo unchanged.</p>
  </section>
}
