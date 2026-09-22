import { useEffect, useRef } from 'react'
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
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Grow on every value change — typing, and the initial value on load.
  useEffect(resize, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      onInput={resize}
      className={className}
      {...props}
    />
  )
}
