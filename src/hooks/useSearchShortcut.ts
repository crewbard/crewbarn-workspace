import { useEffect, useRef } from 'react'

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
 */
export function useSearchShortcut<T extends HTMLInputElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target
      if (
        target instanceof Element
        && (target.closest('input, textarea, select, [contenteditable="true"]') || target.closest('[role="dialog"]'))
      ) {
        return
      }

      const box = ref.current
      if (!box) return
      e.preventDefault()
      box.focus()
      box.select()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return ref
}

/** Escape in the search box leaves it, so "/" and the page's keys work again. */
export function leaveOnEscape(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Escape') e.currentTarget.blur()
}
