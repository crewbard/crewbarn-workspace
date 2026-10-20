import { useLayoutEffect, useRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

/**
 * Textarea that grows to fit its content — no inner scrollbar — with a
 * sensible minimum height, and still manually resizable. Job descriptions
 * (especially Service Fusion imports) can run several lines, so a fixed
 * 3-row box hides most of the note behind a tiny scroll.
 */
export function AutoTextarea({
  value,
  className = '',
  minRows = 4,
  visible = true,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; visible?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // A folded panel has no measurable scrollHeight. Keep its row-based
    // minimum and measure again when the panel becomes visible.
    if (!el.scrollHeight) return
    el.style.height = `${el.scrollHeight}px`
  }

  // Measure before paint, including when a previously hidden editor opens.
  useLayoutEffect(() => {
    if (visible) resize()
  }, [value, visible])

  // A narrower editor wraps the same text onto more lines. Re-measure when
  // its width changes (window resizing, browser zoom, or a responsive panel).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !visible || typeof ResizeObserver === 'undefined') return
    let width = el.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width
      if (nextWidth > 0 && nextWidth !== width) {
        width = nextWidth
        resize()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      onInput={resize}
      className={`${className} overflow-hidden`}
      {...props}
    />
  )
}
