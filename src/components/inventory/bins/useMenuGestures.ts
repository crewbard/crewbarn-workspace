/** Long press on touch, right-click with a mouse, Shift+F10 / menu key on a keyboard. */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 500

export type MenuOpener = (id: string, at: { x: number; y: number }) => void

export function useMenuGestures(id: string, onMenu: MenuOpener) {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const clear = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null }
  return {
    fired,
    handlers: {
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); onMenu(id, { x: e.clientX, y: e.clientY }) },
      onPointerDown: (e: PointerEvent) => {
        fired.current = false
        if (e.pointerType !== 'touch') return
        start.current = { x: e.clientX, y: e.clientY }
        clear()
        timer.current = window.setTimeout(() => {
          fired.current = true
          if (navigator.vibrate) navigator.vibrate(12)
          onMenu(id, start.current!)
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e: PointerEvent) => {
        if (!start.current || !timer.current) return
        if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) clear()
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault()
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          onMenu(id, { x: r.left + 12, y: r.bottom })
        }
      },
    },
  }
}

