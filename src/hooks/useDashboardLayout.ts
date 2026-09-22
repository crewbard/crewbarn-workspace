import { useCallback, useEffect, useState } from 'react'

/**
 * useDashboardLayout — which widgets are on the dashboard and in what order,
 * persisted per-browser (localStorage). Mirrors the theme/appearance pattern:
 * instant, no round-trip. Each tenant/user picks the blocks they want and
 * drags them into the order they like.
 *
 * Stored value: an ordered array of widget IDs. Unknown IDs (a widget that
 * was removed from the registry) are filtered out on read; new default
 * widgets are NOT auto-added so a user's curated layout stays put.
 */
const STORAGE_KEY = 'crewbarn_dashboard_v1'

export interface DashboardLayout {
  /** Ordered widget IDs currently on the board. */
  widgets: string[]
  /** Add a widget (appended) if not already present. */
  addWidget: (id: string) => void
  /** Remove a widget. */
  removeWidget: (id: string) => void
  /** Replace the full ordered list (used by drag-reorder). */
  setOrder: (ids: string[]) => void
  /** Reset to the default set. */
  reset: () => void
}

function read(defaults: string[]): string[] {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed
    }
    return defaults
  } catch {
    return defaults
  }
}

export function useDashboardLayout(
  defaults: string[],
  validIds: string[],
): DashboardLayout {
  const validSet = new Set(validIds)
  const [widgets, setWidgets] = useState<string[]>(() =>
    read(defaults).filter((id) => validSet.has(id)),
  )

  const persist = useCallback((next: string[]) => {
    setWidgets(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* private mode — state still updates in-memory */
    }
  }, [])

  const addWidget = useCallback(
    (id: string) => {
      setWidgets((curr) => {
        if (curr.includes(id)) return curr
        const next = [...curr, id]
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [],
  )

  const removeWidget = useCallback(
    (id: string) => {
      setWidgets((curr) => {
        const next = curr.filter((w) => w !== id)
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [],
  )

  const reset = useCallback(() => persist(defaults), [persist, defaults])

  // Cross-tab sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setWidgets(read(defaults).filter((id) => validSet.has(id)))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { widgets, addWidget, removeWidget, setOrder: persist, reset }
}
