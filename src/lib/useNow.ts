import { useEffect, useState } from 'react'

/**
 * The current time for rendering. Reading Date.now() while rendering gives a
 * different answer on every render (React treats it as impure); this reads it
 * once and, with `everyMs`, again on a timer so "x minutes ago" style checks
 * still move on their own.
 */
export function useNow(everyMs = 0): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!everyMs) return
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}
