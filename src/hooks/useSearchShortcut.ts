import { useEffect, useRef } from 'react'
import { FOCUS_PAGE_SEARCH_EVENT, addPageSearch, shortcutHostActive } from '@/lib/shortcutBus'

/**
 * "/" jumps to this page's search box, from anywhere on the page.
 *
 * Not Ctrl K: on Connect that already opens Find a setting, and the
 * catalogs are listed there too -- one key doing two things depending on
 * which site you are on is worse than a second key. "/" is the one most
 * people already know from search boxes elsewhere.
 *
 * Ignored while somebody is typing in another field, so a "/" in a part
 * number or a note goes where it was typed. Escape in the box leaves it.
 *
 * In the work app the keyboard shortcuts own the key (someone may have
 * moved it or turned shortcuts off) and ask this box to take the focus.
 */
export function useSearchShortcut<T extends HTMLInputElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const focusBox = () => {
      const box = ref.current
      if (!box) return
      box.focus()
      box.select()
    }
    const onKey = (e: KeyboardEvent) => {
      if (shortcutHostActive()) return
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target
      if (
        target instanceof Element
        && (target.closest('input, textarea, select, [contenteditable="true"]') || target.closest('[role="dialog"]'))
      ) {
        return
      }

      if (!ref.current) return
      e.preventDefault()
      focusBox()
    }

    const leave = addPageSearch()
    window.addEventListener('keydown', onKey)
    window.addEventListener(FOCUS_PAGE_SEARCH_EVENT, focusBox)
    return () => {
      leave()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(FOCUS_PAGE_SEARCH_EVENT, focusBox)
    }
  }, [])

  return ref
}

/** Escape in the search box leaves it, so "/" and the page's keys work again. */
export function leaveOnEscape(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Escape') e.currentTarget.blur()
}
