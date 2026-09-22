import { useEffect, useRef } from 'react'

/**
 * Listens for a USB/Bluetooth barcode gun anywhere on the page.
 *
 * These scanners are keyboard-wedge devices: they type the payload and press
 * Enter. Nothing identifies them as a scanner, so the only way to tell one from
 * a person typing is SPEED — a gun emits characters a few milliseconds apart,
 * where a fast human manages maybe 100ms. Everything here follows from that.
 *
 * Why a global listener and not an input box: at a receiving bench the whole
 * point is to scan without touching the mouse first. Requiring focus in a field
 * would mean click, scan, click, scan.
 *
 * Typing in a real field is left alone. If someone is filling in a form, their
 * keystrokes belong to that field, and a scan fired while they are mid-word
 * would both steal the input and act on a half-read code.
 */

interface Options {
  /** Ignored while the user is typing in a field. Default true. */
  respectInputFocus?: boolean
  /** Max gap between characters to still count as one scan. */
  maxGapMs?: number
  /** Shorter than this and it is almost certainly stray keys, not a code. */
  minLength?: number
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useHardwareScanner(onScan: (payload: string) => void, options: Options = {}) {
  const { respectInputFocus = true, maxGapMs = 35, minLength = 4 } = options

  // Kept in refs, not state: a scan is ~10 keystrokes in ~100ms, and
  // re-rendering on each one would be pure waste.
  const buffer = useRef('')
  const lastKeyAt = useRef(0)
  const cb = useRef(onScan)

  useEffect(() => {
    cb.current = onScan
  }, [onScan])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (respectInputFocus && isTypingTarget(e.target)) return

      const now = Date.now()
      const gap = now - lastKeyAt.current
      lastKeyAt.current = now

      // A slow keystroke starts a new buffer rather than extending the old one,
      // so stray typing can never accumulate into a phantom scan.
      if (gap > maxGapMs) buffer.current = ''

      if (e.key === 'Enter') {
        const payload = buffer.current
        buffer.current = ''
        if (payload.length >= minLength) {
          // Only swallow the Enter once it has produced a real scan — otherwise
          // a plain Enter press on the page would stop working.
          e.preventDefault()
          cb.current(payload)
        }
        return
      }

      // Printable characters only. Shift/Alt/arrows carry no payload, and
      // letting them through would corrupt the code.
      if (e.key.length === 1) buffer.current += e.key
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [respectInputFocus, maxGapMs, minLength])
}
